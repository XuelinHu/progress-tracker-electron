const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const test = require("node:test");
const { makeMockState } = require("./mock-large-state.cjs");

const rootDir = path.resolve(__dirname, "..");
const env = { ...process.env };
for (const line of fs.readFileSync(path.join(rootDir, ".env"), "utf8").split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator > 0) env[line.slice(0, separator)] = line.slice(separator + 1).trim();
}

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body == null ? null : JSON.stringify(options.body);
    const req = http.request({ hostname: "127.0.0.1", port, path: pathname, method: options.method || "GET", headers: body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {} }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

test("large canonical mock state round-trips without duplicate or implicit records", async (t) => {
  const port = await availablePort();
  const stateId = `mock-large-${process.pid}-${Date.now()}`;
  const child = spawn(process.execPath, ["scripts/preview-server.cjs"], {
    cwd: rootDir,
    env: { ...env, APP_STATE_ID: stateId, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  t.after(async () => {
    child.kill("SIGTERM");
    const { Pool } = require("pg");
    const pool = new Pool({ host: env.PGHOST || "127.0.0.1", port: Number(env.PGPORT || 5432), database: env.PGDATABASE || "progress_tracker_electron", user: env.PGUSER, password: env.PGPASSWORD, max: 1 });
    await pool.query("DELETE FROM app_state WHERE id = $1", [stateId]).catch(() => {});
    await pool.end();
  });
  const state = makeMockState({ records: 250 });
  let write;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      write = await request(port, "/api/state", { method: "PUT", body: state });
      if (write.status === 200) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(write.status, 200);
  let read;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { read = await request(port, "/api/state"); if (read.status === 200) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(read.status, 200);
  const saved = read.data.state;
  assert.equal(saved.records.length, 250);
  assert.equal(saved.calendarItems.length, 500);
  assert.equal(saved.graph.nodes.length, 250);
  assert.equal(saved.graph.edges.length, 249);
  assert.ok(saved.records.every((record) => Array.isArray(record.tasks) && Array.isArray(record.dateEvents)));
  assert.ok(saved.records.every((record) => !Object.hasOwn(record, "todo") && !Object.hasOwn(record, "todoHistory") && !Object.hasOwn(record, "dateHistory")));
  assert.equal(new Set(saved.records.map((record) => record.id)).size, 250);
  assert.equal(new Set(saved.calendarItems.map((item) => item.id)).size, 500);
  assert.equal(saved.records.reduce((sum, record) => sum + record.tasks.length, 0), 1250);
  assert.equal(saved.records.reduce((sum, record) => sum + record.dateEvents.length, 0), 750);
});
