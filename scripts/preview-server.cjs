const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");
const { Pool } = require("pg");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const backupDir = path.join(rootDir, "backups");
const port = Number(process.env.PORT || 4003);
const host = process.env.HOST || "0.0.0.0";

loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env"));

const appStateId = process.env.APP_STATE_ID || "main";
let dbPool = null;
let dbReadyPromise = null;

const mimeByExt = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function loadEnvFile(filePath) {
  try {
    const content = fsSync.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const separator = line.indexOf("=");
      if (separator < 1) {
        continue;
      }
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] == null) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`Failed to load .env: ${error.message}`);
    }
  }
}

function getDbPool() {
  if (!dbPool) {
    dbPool = new Pool({
      host: process.env.PGHOST || "127.0.0.1",
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || "progress_tracker_electron",
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return dbPool;
}

async function ensureDbSchema() {
  if (!dbReadyPromise) {
    dbReadyPromise = getDbPool().query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }
  await dbReadyPromise;
}

async function readAppState() {
  await ensureDbSchema();
  const result = await getDbPool().query("SELECT data, updated_at FROM app_state WHERE id = $1", [
    appStateId,
  ]);
  const row = result.rows[0];
  return row ? { data: row.data, updatedAt: row.updated_at } : { data: null, updatedAt: null };
}

async function writeAppState(data) {
  await ensureDbSchema();
  const result = await getDbPool().query(
    `
      INSERT INTO app_state (id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      RETURNING updated_at
    `,
    [appStateId, JSON.stringify(data)],
  );
  return result.rows[0]?.updated_at ?? null;
}

function isSafeBackupName(name) {
  return /^backup-\d{8}-\d{6}(?:-[a-z0-9]+)?\.json$/i.test(name);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024) {
      throw new Error("备份数据超过 20MB 限制");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function createBackupName() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `backup-${stamp}-${suffix}.json`;
}

function getDavConfig() {
  const baseUrl = process.env.DAV_URL;
  const username = process.env.DAV_USERNAME;
  const password = process.env.DAV_PASSWORD;
  const project = process.env.DAV_PROJECT || "progress-tracker";
  if (!baseUrl || !username || !password) {
    throw new Error("WebDAV 未配置，请设置 DAV_URL、DAV_USERNAME、DAV_PASSWORD");
  }
  return { baseUrl, username, password, project };
}

function encodePathSegment(segment) {
  return encodeURIComponent(segment).replace(/%20/g, "+");
}

function createDavUrl(config, segments = []) {
  const base = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
  const url = new URL(base);
  const encodedPath = segments.map(encodePathSegment).join("/");
  url.pathname = `${url.pathname.replace(/\/?$/, "/")}${encodedPath}`;
  return url;
}

function createDavAuthHeader(config) {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
}

async function davRequest(config, method, segments, body) {
  const response = await fetch(createDavUrl(config, segments), {
    method,
    headers: {
      authorization: createDavAuthHeader(config),
      ...(body == null
        ? {}
        : {
            "content-type": "application/json; charset=utf-8",
            "content-length": Buffer.byteLength(body),
          }),
    },
    body,
  });
  if (!response.ok && !(method === "MKCOL" && [405, 409].includes(response.status))) {
    const text = await response.text().catch(() => "");
    throw new Error(`WebDAV ${method} 失败：${response.status}${text ? ` ${text.slice(0, 120)}` : ""}`);
  }
  return response;
}

async function ensureDavCollection(config, segments) {
  for (let index = 1; index <= segments.length; index += 1) {
    await davRequest(config, "MKCOL", segments.slice(0, index));
  }
}

async function syncPayloadToDav(payload) {
  const config = getDavConfig();
  const syncPayload = {
    ...payload,
    version: payload.version || 5,
    syncedAt: new Date().toISOString(),
    syncSource: "progress-tracker-electron-preview",
  };
  const body = `${JSON.stringify(syncPayload, null, 2)}\n`;
  const backupName = createBackupName();
  await ensureDavCollection(config, [config.project]);
  await ensureDavCollection(config, [config.project, "backups"]);
  await davRequest(config, "PUT", [config.project, "backups", backupName], body);
  await davRequest(config, "PUT", [config.project, "latest.json"], body);
  return {
    project: config.project,
    backupName,
    latestName: "latest.json",
    size: Buffer.byteLength(body),
    syncedAt: syncPayload.syncedAt,
  };
}

async function loadLatestPayloadFromDav() {
  const config = getDavConfig();
  const response = await davRequest(config, "GET", [config.project, "latest.json"]);
  const text = await response.text();
  return {
    project: config.project,
    latestName: "latest.json",
    data: JSON.parse(text),
  };
}

async function listBackups() {
  await fs.mkdir(backupDir, { recursive: true });
  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && isSafeBackupName(entry.name))
      .map(async (entry) => {
        const filePath = path.join(backupDir, entry.name);
        const stat = await fs.stat(filePath);
        let summary = null;
        try {
          const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
          summary = {
            createdAt: parsed.createdAt || parsed.exportedAt || stat.mtime.toISOString(),
            recordCount: Array.isArray(parsed.records) ? parsed.records.length : 0,
            graphNodeCount: Array.isArray(parsed.graph?.nodes) ? parsed.graph.nodes.length : 0,
            graphEdgeCount: Array.isArray(parsed.graph?.edges) ? parsed.graph.edges.length : 0,
            statusCount: Array.isArray(parsed.statusOptions) ? parsed.statusOptions.length : 0,
          };
        } catch {
          summary = { createdAt: stat.mtime.toISOString() };
        }
        return {
          name: entry.name,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          ...summary,
        };
      }),
  );
  return files.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/state" && req.method === "GET") {
    const state = await readAppState();
    sendJson(res, 200, { ok: true, state: state.data, updatedAt: state.updatedAt });
    return;
  }

  if (pathname === "/api/state" && ["POST", "PUT", "PATCH"].includes(req.method)) {
    const parsed = JSON.parse(await readBody(req));
    const updatedAt = await writeAppState({
      ...parsed,
      version: parsed.version || 5,
      persistedAt: new Date().toISOString(),
    });
    sendJson(res, 200, { ok: true, updatedAt });
    return;
  }

  if (pathname === "/api/backups" && req.method === "GET") {
    sendJson(res, 200, { ok: true, backups: await listBackups() });
    return;
  }

  if (pathname === "/api/backups" && req.method === "POST") {
    const parsed = JSON.parse(await readBody(req));
    const payload = {
      ...parsed,
      version: parsed.version || 5,
      createdAt: new Date().toISOString(),
    };
    await fs.mkdir(backupDir, { recursive: true });
    const name = createBackupName();
    const filePath = path.join(backupDir, name);
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    const stat = await fs.stat(filePath);
    sendJson(res, 201, {
      ok: true,
      backup: { name, size: stat.size, createdAt: payload.createdAt },
    });
    return;
  }

  if (pathname === "/api/dav/sync" && req.method === "POST") {
    const parsed = JSON.parse(await readBody(req));
    const result = await syncPayloadToDav(parsed);
    sendJson(res, 201, { ok: true, sync: result });
    return;
  }

  if (pathname === "/api/dav/latest" && req.method === "GET") {
    const result = await loadLatestPayloadFromDav();
    sendJson(res, 200, { ok: true, latest: result });
    return;
  }

  const match = pathname.match(/^\/api\/backups\/([^/]+)$/);
  if (match && req.method === "GET") {
    const name = decodeURIComponent(match[1]);
    if (!isSafeBackupName(name)) {
      sendJson(res, 400, { ok: false, error: "非法备份文件名" });
      return;
    }
    const content = await fs.readFile(path.join(backupDir, name), "utf8");
    sendJson(res, 200, { ok: true, name, data: JSON.parse(content) });
    return;
  }

  if (match && req.method === "DELETE") {
    const name = decodeURIComponent(match[1]);
    if (!isSafeBackupName(name)) {
      sendJson(res, 400, { ok: false, error: "非法备份文件名" });
      return;
    }
    try {
      await fs.unlink(path.join(backupDir, name));
    } catch (error) {
      if (error?.code === "ENOENT") {
        sendJson(res, 404, { ok: false, error: "备份不存在或已被删除" });
        return;
      }
      throw error;
    }
    sendJson(res, 200, { ok: true, name });
    return;
  }

  sendJson(res, 404, { ok: false, error: "接口不存在" });
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(distDir, `.${decodeURIComponent(requested)}`);
  if (!resolved.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      throw new Error("not file");
    }
    res.writeHead(200, {
      "content-type": mimeByExt[path.extname(resolved)] || "application/octet-stream",
      "content-length": stat.size,
    });
    res.end(await fs.readFile(resolved));
  } catch {
    const indexPath = path.join(distDir, "index.html");
    const content = await fs.readFile(indexPath);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-length": content.length,
    });
    res.end(content);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "服务器错误" });
  }
});

server.listen(port, host, () => {
  console.log(`科研进度管理平台 preview server listening at http://${host}:${port}`);
  console.log(`Backups directory: ${backupDir}`);
});

process.on("SIGTERM", async () => {
  await dbPool?.end().catch(() => {});
  process.exit(0);
});
