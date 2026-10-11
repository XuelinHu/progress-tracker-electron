const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: pathname,
      method: options.method || "GET",
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.origin ? { origin: options.origin } : {}),
        ...(options.requestedHeaders ? { "access-control-request-headers": options.requestedHeaders } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("API publishes OIDC metadata but rejects anonymous state and backup requests without touching PostgreSQL", async (t) => {
  const port = await availablePort();
  const child = spawn(process.execPath, ["scripts/preview-server.cjs", "--api-only"], {
    cwd: rootDir,
    env: {
      ...process.env,
      API_PORT: String(port),
      OIDC_ISSUER: "https://issuer.example.test/realms/front",
      OIDC_CLIENT_ID: "progress-tracker-electron-web",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  t.after(() => child.kill("SIGTERM"));

  const deadline = Date.now() + 10_000;
  let config;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`API exited early: ${stderr}`);
    try {
    config = await request(port, "/api/auth/config");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  assert.equal(config?.status, 200, stderr);
  assert.deepEqual(JSON.parse(config.body), {
    ok: true,
    issuer: "https://issuer.example.test/realms/front",
    clientId: "progress-tracker-electron-web",
  });

  for (const pathname of ["/api/state", "/api/dav/sync", "/api/dav/restore", "/api/client-log"]) {
    const response = await request(port, pathname);
    assert.equal(response.status, 401, `${pathname} must require a verified bearer token`);
  }
  const malformed = await request(port, "/api/state", { token: "not-a-valid-jwt-token-value" });
  assert.equal(malformed.status, 401, "malformed tokens must be rejected before database access");
  const preflight = await request(port, "/api/state", {
    method: "OPTIONS",
    origin: "https://192.168.1.9:4093",
    requestedHeaders: "authorization,content-type,x-state-revision",
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["access-control-allow-origin"], "https://192.168.1.9:4093");
  const deniedOrigin = await request(port, "/api/auth/config", { origin: "https://attacker.example" });
  assert.equal(deniedOrigin.status, 403);
});
