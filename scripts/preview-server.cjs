const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");
const { Pool } = require("pg");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
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

function createRequestId(req) {
  if (!req.requestId) {
    req.requestId = String(
      req.headers["x-request-id"] || `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    );
  }
  return req.requestId;
}

function requestContext(req, requestId) {
  return {
    requestId,
    method: req.method,
    path: req.url,
    remoteAddress: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
    contentLength: Number(req.headers["content-length"] || 0),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 180),
  };
}

function errorContext(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || "Unknown error",
    code: error?.code || "",
    detail: error?.detail || "",
    constraint: error?.constraint || "",
    table: error?.table || "",
    stack: String(error?.stack || "").split("\n").slice(0, 8).join("\n"),
  };
}

function stateSummary(state) {
  return {
    version: state?.version || null,
    records: Array.isArray(state?.records) ? state.records.length : 0,
    calendarItems: Array.isArray(state?.calendarItems) ? state.calendarItems.length : 0,
    graphNodes: Array.isArray(state?.graph?.nodes) ? state.graph.nodes.length : 0,
    graphEdges: Array.isArray(state?.graph?.edges) ? state.graph.edges.length : 0,
    statuses: Array.isArray(state?.statusOptions) ? state.statusOptions.length : 0,
  };
}

const STATE_SCHEMA_VERSION = 6;

function sortTimeline(entries = []) {
  const seen = new Set();
  return entries
    .filter((entry) => entry && (entry.summary || entry.item || entry.date || entry.createdAt))
    .filter((entry) => {
      const key = entry.id || [entry.summary || entry.item, entry.status || "", entry.createdAt || entry.date || ""].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => String(left.createdAt || left.updatedAt || left.date || "").localeCompare(
      String(right.createdAt || right.updatedAt || right.date || ""),
    ));
}

function migrateStateToV6(state) {
  if (!state || typeof state !== "object") return state;
  const now = new Date().toISOString();
  const records = Array.isArray(state.records) ? state.records.map((record) => {
    const dateHistory = record?.dateHistory && typeof record.dateHistory === "object" ? record.dateHistory : {};
    const legacyTodo = Array.isArray(record?.todoHistory) ? record.todoHistory : [];
    const existingItems = Array.isArray(record?.items) ? record.items : [];
    const migratedDateTodos = Object.entries(dateHistory).flatMap(([sourceField, entries]) =>
      (Array.isArray(entries) ? entries : []).map((entry, index) => ({
        id: String(entry?.id || `todo-date-${record?.id || "record"}-${sourceField}-${index}`),
        recordId: String(record?.id || ""),
        type: "todo",
        text: String(entry?.item || `${sourceField} Todo`),
        details: String(entry?.details || entry?.item || ""),
        date: String(entry?.date || ""),
        sourceField,
        status: "active",
        doneDate: null,
        doneAt: null,
        createdAt: entry?.createdAt || entry?.addedAt || entry?.date || now,
        updatedAt: entry?.updatedAt || entry?.createdAt || entry?.date || now,
      })),
    );
    const itemsById = new Map();
    [...existingItems, ...migratedDateTodos].forEach((item, index) => {
      const id = String(item?.id || `todo-${record?.id || "record"}-${index}`);
      const normalized = {
        ...item,
        id,
        recordId: String(item?.recordId || record?.id || ""),
        type: item?.type === "date" ? "todo" : item?.type || "todo",
        text: String(item?.text ?? item?.item ?? "").trim(),
        details: String(item?.details ?? item?.description ?? ""),
        date: String(item?.date || item?.addedDate || ""),
        sourceField: String(item?.sourceField || ""),
        status: item?.status || (item?.doneDate ? "done" : "active"),
        doneDate: item?.doneDate || null,
        doneAt: item?.doneAt || null,
        createdAt: item?.createdAt || item?.addedAt || item?.date || now,
        updatedAt: item?.updatedAt || item?.createdAt || item?.date || now,
      };
      if (normalized.text && !itemsById.has(id)) itemsById.set(id, normalized);
    });
    legacyTodo.forEach((entry, index) => {
      const id = String(entry?.id || `todo-legacy-${record?.id || "record"}-${index}`);
      if (itemsById.has(id)) return;
      itemsById.set(id, {
        id,
        recordId: String(record?.id || ""),
        type: "todo",
        text: String(entry?.item || "").trim(),
        details: String(entry?.details || entry?.description || ""),
        date: String(entry?.addedDate || entry?.date || ""),
        sourceField: String(entry?.sourceField || ""),
        status: entry?.doneDate ? "done" : "active",
        doneDate: entry?.doneDate || null,
        doneAt: entry?.doneAt || null,
        createdAt: entry?.createdAt || entry?.addedAt || entry?.addedDate || now,
        updatedAt: entry?.updatedAt || entry?.doneAt || entry?.createdAt || now,
      });
    });
    const todoItems = [...itemsById.values()].filter((item) => item.type === "todo");
    return {
      ...record,
      items: todoItems,
      todo: todoItems.map((item) => item.text).join("\n"),
      todoHistory: todoItems.map((item) => ({
        id: item.id, item: item.text, details: item.details, sourceField: item.sourceField,
        addedDate: item.date, doneDate: item.doneDate, addedAt: item.createdAt,
        doneAt: item.doneAt, createdAt: item.createdAt, updatedAt: item.updatedAt,
      })),
      history: sortTimeline(record?.history || []),
    };
  }) : [];
  const calendarItems = Array.isArray(state.calendarItems) ? state.calendarItems.map((item) => ({
    ...item,
    categoryId: item?.categoryId === "problem" ? "other" : item?.categoryId || "other",
    itemType: "todo",
    history: sortTimeline(item?.history || []),
  })) : [];
  return { ...state, version: STATE_SCHEMA_VERSION, records, calendarItems, schemaVersion: STATE_SCHEMA_VERSION };
}

function logEvent(level, event, details = {}) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  });
  (level === "error" ? console.error : console.log)(line);
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
      ;
      ALTER TABLE app_state ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 6
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
  if (!row) return { data: null, updatedAt: null };
  const data = migrateStateToV6(row.data);
  if (Number(row.data?.version || 0) < STATE_SCHEMA_VERSION) {
    const updatedAt = await writeAppState(data);
    return { data, updatedAt };
  }
  return { data, updatedAt: row.updated_at };
}

async function writeAppState(data) {
  await ensureDbSchema();
  const result = await getDbPool().query(
    `
      INSERT INTO app_state (id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, schema_version = $3, updated_at = NOW()
      RETURNING updated_at
    `,
    [appStateId, JSON.stringify(migrateStateToV6(data)), STATE_SCHEMA_VERSION],
  );
  return result.rows[0]?.updated_at ?? null;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024) {
      throw new Error("请求数据超过 20MB 限制");
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
    version: STATE_SCHEMA_VERSION,
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

async function handleApi(req, res, pathname) {
  const requestId = createRequestId(req);
  const context = requestContext(req, requestId);
  if (pathname === "/api/state" && req.method === "GET") {
    const startedAt = Date.now();
    const state = await readAppState();
    logEvent("info", "state.read.success", {
      ...context,
      durationMs: Date.now() - startedAt,
      ...stateSummary(state.data),
    });
    sendJson(res, 200, {
      ok: true,
      source: "postgresql",
      state: state.data,
      updatedAt: state.updatedAt,
    });
    return;
  }

  if (pathname === "/api/state" && ["POST", "PUT", "PATCH"].includes(req.method)) {
    const startedAt = Date.now();
    const rawBody = await readBody(req);
    const parsed = JSON.parse(rawBody);
    const summary = stateSummary(parsed);
    logEvent("info", "state.write.started", {
      ...context,
      payloadBytes: Buffer.byteLength(rawBody),
      ...summary,
    });
    try {
      const updatedAt = await writeAppState({
        ...parsed,
        version: STATE_SCHEMA_VERSION,
        persistedAt: new Date().toISOString(),
      });
      logEvent("info", "state.write.success", {
        ...context,
        durationMs: Date.now() - startedAt,
        payloadBytes: Buffer.byteLength(rawBody),
        updatedAt,
        ...summary,
      });
      sendJson(res, 200, { ok: true, source: "postgresql", updatedAt, requestId });
    } catch (error) {
      logEvent("error", "state.write.failure", {
        ...context,
        durationMs: Date.now() - startedAt,
        payloadBytes: Buffer.byteLength(rawBody),
        ...summary,
        error: errorContext(error),
      });
      throw error;
    }
    return;
  }

  if (pathname === "/api/client-log" && req.method === "POST") {
    const rawBody = await readBody(req);
    const parsed = JSON.parse(rawBody || "{}");
    logEvent(parsed.level === "error" ? "error" : "info", "client.report", {
      ...context,
      clientEvent: String(parsed.event || "unknown").slice(0, 80),
      clientRequestId: String(parsed.requestId || "").slice(0, 100),
      status: Number(parsed.status || 0),
      message: String(parsed.message || "").slice(0, 500),
      summary: parsed.summary && typeof parsed.summary === "object" ? parsed.summary : {},
    });
    sendJson(res, 202, { ok: true, requestId });
    return;
  }

  if (pathname === "/api/dav/sync" && req.method === "POST") {
    const state = await readAppState();
    if (!state.data) {
      sendJson(res, 404, { ok: false, error: "PostgreSQL 中没有可同步的应用数据" });
      return;
    }
    const result = await syncPayloadToDav(state.data);
    sendJson(res, 201, { ok: true, source: "postgresql", sync: result });
    return;
  }

  if (pathname === "/api/dav/restore" && req.method === "POST") {
    const result = await loadLatestPayloadFromDav();
    const restoredState = {
      ...result.data,
      version: STATE_SCHEMA_VERSION,
      persistedAt: new Date().toISOString(),
    };
    const updatedAt = await writeAppState(restoredState);
    sendJson(res, 200, {
      ok: true,
      source: "postgresql",
      state: restoredState,
      updatedAt,
      latest: { project: result.project, latestName: result.latestName },
    });
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
  const requestId = createRequestId(req);
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    logEvent("error", "request.failure", {
      ...requestContext(req, requestId),
      error: errorContext(error),
    });
    if (!res.headersSent) {
      sendJson(res, 500, { ok: false, error: error.message || "服务器错误", requestId });
    } else {
      res.end();
    }
  }
});

server.listen(port, host, () => {
  console.log(`科研进度管理平台 preview server listening at http://${host}:${port}`);
});

process.on("SIGTERM", async () => {
  logEvent("info", "process.sigterm", { pid: process.pid });
  await dbPool?.end().catch(() => {});
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  logEvent("error", "process.unhandledRejection", { pid: process.pid, error: errorContext(error) });
});

process.on("uncaughtException", (error) => {
  logEvent("error", "process.uncaughtException", { pid: process.pid, error: errorContext(error) });
  process.exitCode = 1;
});
