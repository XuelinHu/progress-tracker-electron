import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;
const root = resolve(import.meta.dirname, "../..");
const identityEnv = parseEnv(await readFile(resolve(root, "identity-service/.env"), "utf8"));
const projectEnv = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
const issuer = projectEnv.OIDC_ISSUER;
const clientId = projectEnv.OIDC_CLIENT_ID;
const origin = "https://192.168.1.9:4093";
const api = `${origin}/api`;
const database = projectEnv.PGDATABASE || "";
assert.match(database, /_(dev|development|test)$/i, "OIDC E2E is restricted to an isolated database");
assert.equal(issuer, "https://192.168.1.9:8042/realms/front");
assert.equal(clientId, "progress-tracker-electron-web");
assert.ok(identityEnv.KC_BOOTSTRAP_ADMIN_USERNAME && identityEnv.KC_BOOTSTRAP_ADMIN_PASSWORD);

const realmBase = `${issuer}`;
const adminBase = `${issuer.replace(/\/realms\/front$/, "")}/admin/realms/front`;
const username = `codex-pt-smoke-${randomBytes(6).toString("hex")}`;
const password = `${randomBytes(24).toString("base64url")}aA1!`;
const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(24).toString("base64url");
const nonce = randomBytes(24).toString("base64url");
const redirectUri = `${origin}/oidc-callback`;
const cookies = new Map();
let adminToken;
let userId;
let subject;
let pool;
let passed = false;

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.trimStart().startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
}

function saveCookies(response) {
  for (const header of response.headers.getSetCookie?.() || []) {
    const pair = header.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

async function fetchWithCookies(url, init = {}, follow = false) {
  let current = new URL(url);
  let options = { ...init, redirect: "manual", headers: new Headers(init.headers || {}) };
  for (let redirects = 0; ; redirects += 1) {
    if (cookies.size) options.headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
    const response = await fetch(current, options);
    saveCookies(response);
    if (!follow || ![301, 302, 303, 307, 308].includes(response.status)) return response;
    assert.ok(redirects < 8, "OIDC authorization exceeded redirect limit");
    current = new URL(response.headers.get("location"), current);
    if ([301, 302, 303].includes(response.status)) options = { ...options, method: "GET", body: undefined };
  }
}

async function adminRequest(path, init = {}) {
  const response = await fetch(`${adminBase}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${adminToken}`, ...(init.headers || {}) },
  });
  if (!response.ok) throw new Error(`Keycloak admin API returned ${response.status}`);
  return response;
}

function htmlDecode(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&#x3D;", "=").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1].toLowerCase(), htmlDecode(match[3])]));
}

try {
  const adminResponse = await fetch(`${issuer.replace(/\/realms\/front$/, "")}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: identityEnv.KC_BOOTSTRAP_ADMIN_USERNAME,
      password: identityEnv.KC_BOOTSTRAP_ADMIN_PASSWORD,
    }),
  });
  assert.equal(adminResponse.status, 200, "Keycloak admin authentication must succeed");
  adminToken = (await adminResponse.json()).access_token;

  const createResponse = await adminRequest("/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      enabled: true,
      email: `${username}@example.invalid`,
      emailVerified: true,
      firstName: "Codex",
      lastName: "Smoke",
      requiredActions: [],
    }),
  });
  assert.equal(createResponse.status, 201, "temporary Keycloak user must be created");
  userId = createResponse.headers.get("location")?.split("/").at(-1);
  assert.ok(userId, "Keycloak must return the temporary user id");
  await adminRequest(`/users/${userId}/reset-password`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "password", value: password, temporary: false }),
  });

  const authorize = new URL(`${issuer}/protocol/openid-connect/auth`);
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const loginPage = await fetchWithCookies(authorize, {}, true);
  assert.equal(loginPage.status, 200, "OIDC authorization must reach the Keycloak login form");
  const html = await loginPage.text();
  const formTag = html.match(/<form\b[^>]*id=["']kc-form-login["'][^>]*>/i)?.[0]
    || html.match(/<form\b[^>]*>/i)?.[0];
  assert.ok(formTag, "Keycloak login form must be present");
  const action = attributes(formTag).action;
  assert.ok(action, "Keycloak login action must be present");
  const formData = new URLSearchParams();
  for (const input of html.matchAll(/<input\b[^>]*>/gi)) {
    const fields = attributes(input[0]);
    if (fields.name && fields.type === "hidden") formData.set(fields.name, fields.value || "");
  }
  formData.set("username", username);
  formData.set("password", password);
  const loginResponse = await fetchWithCookies(new URL(action, loginPage.url), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formData,
  });
  assert.ok([302, 303].includes(loginResponse.status), "temporary user login must return an authorization redirect");
  const callback = new URL(loginResponse.headers.get("location"));
  assert.equal(callback.origin, origin, `Keycloak did not return to the app callback (${callback.pathname})`);
  assert.equal(callback.pathname, "/oidc-callback");
  assert.equal(callback.searchParams.get("state"), state, "authorization callback state must match");
  const code = callback.searchParams.get("code");
  assert.ok(code, "authorization callback must contain a code");

  const tokenResponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", client_id: clientId, code, redirect_uri: redirectUri, code_verifier: verifier,
    }),
  });
  assert.equal(tokenResponse.status, 200, "PKCE authorization code exchange must succeed");
  const tokens = await tokenResponse.json();
  assert.ok(tokens.access_token && tokens.id_token, "OIDC must issue access and ID tokens");

  const meResponse = await fetch(`${api}/auth/me`, { headers: { authorization: `Bearer ${tokens.access_token}` } });
  assert.equal(meResponse.status, 200, "API must accept the Keycloak access token");
  const me = await meResponse.json();
  subject = me.subject;
  assert.ok(subject, "API identity must include the OIDC subject");

  const beforeResponse = await fetch(`${api}/state`, { headers: { authorization: `Bearer ${tokens.access_token}` } });
  assert.equal(beforeResponse.status, 200);
  const before = await beforeResponse.json();
  assert.equal(before.source, "postgresql");
  assert.equal(before.revision, 0, "new temporary subject must start without persisted state");

  const marker = `e2e-${randomBytes(12).toString("hex")}`;
  const payload = { version: 12, records: [{ id: marker, title: "OIDC PostgreSQL smoke", category: "测试" }] };
  const writeResponse = await fetch(`${api}/state`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
      "content-type": "application/json",
      "x-state-revision": String(before.revision),
    },
    body: JSON.stringify(payload),
  });
  assert.equal(writeResponse.status, 200, "authenticated API must persist state to PostgreSQL");
  const written = await writeResponse.json();
  assert.equal(written.revision, 1);
  const readResponse = await fetch(`${api}/state`, { headers: { authorization: `Bearer ${tokens.access_token}` } });
  assert.equal(readResponse.status, 200);
  const readBack = await readResponse.json();
  assert.equal(readBack.source, "postgresql");
  assert.equal(readBack.state.records[0].id, marker, "state must round-trip through PostgreSQL");
  assert.equal(readBack.revision, 1);

  pool = new Pool({
    host: projectEnv.PGHOST,
    port: Number(projectEnv.PGPORT),
    database,
    user: projectEnv.PGUSER,
    password: projectEnv.PGPASSWORD,
  });
  const row = await pool.query("SELECT owner_sub, revision FROM app_state WHERE owner_sub = $1", [subject]);
  assert.equal(row.rowCount, 1, "the authenticated subject must own exactly one PostgreSQL row");
  assert.equal(Number(row.rows[0].revision), 1);
  passed = true;
} finally {
  if (subject && pool) {
    const deleted = await pool.query("DELETE FROM app_state WHERE owner_sub = $1 RETURNING id", [subject]);
    assert.ok(deleted.rowCount <= 1, "cleanup must only remove the temporary subject row");
    if (passed) assert.equal(deleted.rowCount, 1, "temporary PostgreSQL row must be removed");
  }
  await pool?.end();
  if (userId && adminToken) {
    const deletedUser = await adminRequest(`/users/${userId}`, { method: "DELETE" });
    assert.equal(deletedUser.status, 204, "temporary Keycloak user must be removed");
    const remaining = await adminRequest(`/users?username=${encodeURIComponent(username)}&exact=true`);
    assert.deepEqual(await remaining.json(), [], "temporary Keycloak user must not remain");
  }
}
console.log("OIDC E2E passed and cleaned up: temporary Keycloak login, S256 code exchange, API bearer validation, PostgreSQL write/read.");
