const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const rootDir = path.resolve(__dirname, "..");
const runtimeSourceRoots = ["src", "electron"];

function walkFiles(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }
  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativePath, entry.name);
    return entry.isDirectory() ? walkFiles(child) : [child];
  });
}

function loadLocalEnv() {
  const result = { ...process.env };
  for (const name of [".env.local", ".env"]) {
    const filePath = path.join(rootDir, name);
    if (!fs.existsSync(filePath)) continue;
    for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (result[key] == null) result[key] = value;
    }
  }
  return result;
}

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body == null ? null : JSON.stringify(options.body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method: options.method || "GET",
        headers: body
          ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode, data: text ? JSON.parse(text) : null });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`测试服务提前退出：${child.exitCode}`);
    try {
      const response = await request(port, "/api/state");
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("等待测试服务启动超时");
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

test("前端运行时代码不使用浏览器或文件型业务存储", () => {
  const forbidden = /\b(?:localStorage|sessionStorage|indexedDB|electron-store|lowdb)\b/;
  const violations = runtimeSourceRoots
    .flatMap(walkFiles)
    .filter((file) => /\.(?:[cm]?js|jsx|ts|tsx)$/.test(file))
    .filter((file) => forbidden.test(fs.readFileSync(path.join(rootDir, file), "utf8")));

  assert.deepEqual(violations, [], `发现本地业务存储引用：${violations.join(", ")}`);
});

test("后端不提供本地 JSON 业务备份链路", () => {
  const source = fs.readFileSync(path.join(rootDir, "scripts/preview-server.cjs"), "utf8");
  assert.doesNotMatch(source, /\/api\/backups|backupDir|fs\.writeFile/);
});

test("状态 API 的写入和读取均以 PostgreSQL 为唯一事实源", async (t) => {
  const env = loadLocalEnv();
  const stateId = `storage-regression-${process.pid}-${Date.now()}`;
  const port = await getAvailablePort();
  const child = spawn(process.execPath, ["scripts/preview-server.cjs"], {
    cwd: rootDir,
    env: { ...env, APP_STATE_ID: stateId, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  const pool = new Pool({
    host: env.PGHOST || "127.0.0.1",
    port: Number(env.PGPORT || 5432),
    database: env.PGDATABASE || "progress_tracker_electron",
    user: env.PGUSER,
    password: env.PGPASSWORD,
    max: 1,
  });

  t.after(async () => {
    child.kill("SIGTERM");
    await pool.query("DELETE FROM app_state WHERE id = $1", [stateId]).catch(() => {});
    await pool.end();
  });

  try {
    await waitForServer(port, child);
  } catch (error) {
    throw new Error(`${error.message}${stderr ? `\n${stderr}` : ""}`);
  }
  const marker = `pg-only-${Date.now()}`;
  const state = {
    version: 5,
    marker,
    records: [],
    calendarItems: [],
    statusOptions: [],
    graph: { nodes: [], edges: [] },
  };

  const writeResponse = await request(port, "/api/state", { method: "PUT", body: state });
  assert.equal(writeResponse.status, 200, stderr);
  assert.equal(writeResponse.data.source, "postgresql");

  const directResult = await pool.query("SELECT data FROM app_state WHERE id = $1", [stateId]);
  assert.equal(directResult.rows[0]?.data?.marker, marker);

  const readResponse = await request(port, "/api/state");
  assert.equal(readResponse.status, 200, stderr);
  assert.equal(readResponse.data.source, "postgresql");
  assert.equal(readResponse.data.state.marker, marker);

  const backupResponse = await request(port, "/api/backups");
  assert.equal(backupResponse.status, 404, "本地文件备份接口不应继续存在");
});
