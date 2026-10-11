const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");
const { userStateId } = require("./user-scope.cjs");

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

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body == null ? null : JSON.stringify(options.body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method: options.method || "GET",
        headers: {
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
          ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {}),
          ...(body ? { "x-state-revision": String(stateRevision) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const data = text ? JSON.parse(text) : null;
          if (Number.isFinite(data?.revision)) stateRevision = data.revision;
          resolve({ status: res.statusCode, data });
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
      const response = await request(port, "/api/auth/config");
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("等待测试服务启动超时");
}

let authToken = "";
let stateRevision = 0;

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
  const forbidden = /\b(?:localStorage|indexedDB|electron-store|lowdb)\b/;
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
  const env = { ...process.env };
  const database = env.PGDATABASE || "";
  if (!/_test$/i.test(database) || !env.PGHOST || !env.PGUSER || !env.PGPASSWORD) {
    t.skip("需要显式提供 PGHOST/PGUSER/PGPASSWORD 和以 _test 结尾的 PGDATABASE；未读取 .env、未连接数据库");
    return;
  }
  const jose = await import("jose");
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256");
  const jwk = await jose.exportJWK(publicKey);
  Object.assign(jwk, { kid: "storage-test-key", alg: "RS256", use: "sig" });
  const issuer = `http://127.0.0.1:${await getAvailablePort()}/realms/front`;
  const jwksServer = http.createServer((req, res) => {
    if (req.url === "/realms/front/protocol/openid-connect/certs") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404).end();
  });
  const jwksPort = Number(new URL(issuer).port);
  await new Promise((resolve) => jwksServer.listen(jwksPort, "127.0.0.1", resolve));
  const clientId = "progress-tracker-electron-web";
  authToken = await new jose.SignJWT({ azp: clientId })
    .setProtectedHeader({ alg: "RS256", kid: "storage-test-key" })
    .setIssuer(issuer).setAudience("account").setSubject("storage-regression-user")
    .setIssuedAt().setExpirationTime("5m").sign(privateKey);
  stateRevision = 0;
  const subject = "storage-regression-user";
  const stateId = `storage-regression-${process.pid}-${Date.now()}`;
  const port = await getAvailablePort();
  const apiPort = await getAvailablePort();
  const child = spawn(process.execPath, ["scripts/preview-server.cjs"], {
    cwd: rootDir,
    env: {
      ...env,
      APP_STATE_ID: stateId,
      HOST: "127.0.0.1",
      PORT: String(port),
      API_PORT: String(apiPort),
      OIDC_ISSUER: issuer,
      OIDC_CLIENT_ID: clientId,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  const pool = new Pool({
    host: env.PGHOST || "127.0.0.1",
    port: Number(env.PGPORT || 5432),
    database,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    max: 1,
  });

  t.after(async () => {
    child.kill("SIGTERM");
    await pool.query("DELETE FROM app_state WHERE id = $1 AND owner_sub = $2", [userStateId(subject, stateId), subject]).catch(() => {});
    await pool.end();
    jwksServer.close();
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

  const rowId = userStateId(subject, stateId);
  const directResult = await pool.query("SELECT data FROM app_state WHERE id = $1 AND owner_sub = $2", [rowId, subject]);
  assert.equal(directResult.rows[0]?.data?.marker, marker, JSON.stringify({
    response: writeResponse.data,
    expectedId: rowId,
    rows: (await pool.query("SELECT id, owner_sub, revision FROM app_state")).rows,
  }));

  const readResponse = await request(port, "/api/state");
  assert.equal(readResponse.status, 200, stderr);
  assert.equal(readResponse.data.source, "postgresql");
  assert.equal(readResponse.data.state.marker, marker);

  const backupResponse = await request(port, "/api/backups");
  assert.equal(backupResponse.status, 404, "本地文件备份接口不应继续存在");

  const todoState = {
    version: 10,
    marker: `${marker}-todo-normalization`,
    records: [
      {
        id: "todo-delete-regression",
        categoryId: "software",
        title: "Todo 删除回归记录",
        status: "开发完成",
        items: [
          {
            id: "legacy-completed-todo",
            recordId: "todo-delete-regression",
            type: "todo",
            text: "历史已完成 Todo",
            status: "done",
            date: "2026-08-04",
            doneDate: null,
            doneAt: null,
            createdAt: "2026-08-04T08:00:00.000Z",
          },
        ],
        // These stale fields model a Todo already deleted by the canonical UI.
        todo: "已删除 Todo 不应复生",
        todoHistory: [{ id: "deleted-todo", item: "已删除 Todo 不应复生" }],
        dateHistory: { startDate: [{ id: "deleted-date-todo", item: "已删除 Todo 不应复生" }] },
      },
    ],
    calendarItems: [{ id: "legacy-calendar-status", title: "历史日历状态", status: "结束" }],
    statusOptions: [{ id: "开发完成", label: "开发完成" }, { id: "其他", label: "其他" }],
    graph: { nodes: [], edges: [] },
  };
  const todoWriteResponse = await request(port, "/api/state", { method: "PUT", body: todoState });
  assert.equal(todoWriteResponse.status, 200, stderr);
  const todoResult = await pool.query("SELECT data FROM app_state WHERE id = $1 AND owner_sub = $2", [rowId, subject]);
  const savedTodoRecord = todoResult.rows[0]?.data?.records?.[0];
  assert.deepEqual(
    savedTodoRecord?.tasks?.map((item) => item.id),
    ["legacy-completed-todo"],
    "已删除 Todo 不得因旧兼容字段重新写入",
  );
  assert.equal(savedTodoRecord?.tasks?.[0]?.doneDate, "2026-08-04", "历史完成 Todo 必须补齐完成日期");
  assert.deepEqual(savedTodoRecord?.dateEvents, [], "日期事件应与任务分离");
  assert.equal("todo" in savedTodoRecord, false, "规范数据不得保留旧 Todo 文本字段");
  assert.equal("todoHistory" in savedTodoRecord, false, "规范数据不得保留旧 Todo 历史字段");
  assert.equal("dateHistory" in savedTodoRecord, false, "规范数据不得保留旧日期历史字段");
  assert.equal(savedTodoRecord?.status, "进行中", "已完成和暂缓以外的历史状态必须归一为进行中");
  assert.deepEqual(
    todoResult.rows[0]?.data?.statusOptions?.map((status) => status.id),
    ["进行中", "暂缓", "已完成"],
    "状态配置只能保留进行中、暂缓、已完成",
  );
  assert.deepEqual(
    todoResult.rows[0]?.data?.calendarItems?.map((item) => item.status),
    ["进行中"],
    "日历中的其他历史状态必须归一为进行中",
  );

  const canonicalState = {
    version: 11,
    marker: `${marker}-canonical-boundary`,
    records: [{
      id: "canonical-boundary",
      categoryId: "paper",
      title: "同名任务边界",
      status: "进行中",
      tasks: [{ id: "task-a", recordId: "canonical-boundary", type: "todo", text: "同名事项", status: "active" }],
      dateEvents: [{ id: "event-a", date: "2026-09-13", text: "同名事项", sourceField: "submissionDate" }],
    }],
    calendarItems: [],
    statusOptions: [],
    graph: { nodes: [], edges: [] },
  };
  const canonicalWrite = await request(port, "/api/state", { method: "PUT", body: canonicalState });
  assert.equal(canonicalWrite.status, 200, stderr);
  const canonicalRead = await request(port, "/api/state");
  const canonicalRecord = canonicalRead.data.state.records[0];
  assert.deepEqual(canonicalRecord.tasks.map((item) => item.id), ["task-a"]);
  assert.deepEqual(canonicalRecord.dateEvents.map((item) => item.id), ["event-a"]);
  assert.equal(canonicalRead.data.state.version, 12);
});
