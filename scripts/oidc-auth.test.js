import test from "node:test";
import assert from "node:assert/strict";
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose";
import { createRequire } from "node:module";
import { verifyIdToken } from "../src/auth/oidc.js";
import auth from "./oidc-auth.cjs";
import scope from "./user-scope.cjs";

const require = createRequire(import.meta.url);
const previewSource = require("node:fs").readFileSync(new URL("./preview-server.cjs", import.meta.url), "utf8");

const issuer = "https://identity.example.test/realms/front";
const clientId = "progress-tracker-electron-web";
const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
Object.assign(jwk, { kid: "test-key", alg: "RS256", use: "sig" });
const jwks = createLocalJWKSet({ keys: [jwk] });

async function token(claims = {}, tokenIssuer = issuer) {
  return new SignJWT({ ...claims, azp: claims.azp ?? clientId })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(tokenIssuer)
    .setAudience("account")
    .setSubject("immutable-subject")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(privateKey);
}

test("OIDC access token requires the exact issuer, account audience, client azp, and subject", async () => {
  const valid = await token({ preferred_username: "same-user" });
  assert.deepEqual(await auth.verifyAccessToken(valid, { issuer, clientId, jwks }), {
    subject: "immutable-subject",
    username: "same-user",
  });
  await assert.rejects(auth.verifyAccessToken(await token({ azp: "other-client" }), { issuer, clientId, jwks }));
  await assert.rejects(auth.verifyAccessToken(await token({}, "https://other.example.test"), { issuer, clientId, jwks }));
  await assert.rejects(auth.verifyAccessToken("malformed-token-value", { issuer, clientId, jwks }));
});

test("OIDC login requires a nonce-bound ID token before accepting access/refresh tokens", async () => {
  const idToken = async (claims = {}, tokenIssuer = issuer, key = privateKey) => new SignJWT({ nonce: "expected-nonce", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(tokenIssuer).setAudience(clientId).setSubject("immutable-subject")
    .setIssuedAt().setExpirationTime("2m").sign(key);
  const config = { issuer, clientId };
  assert.equal((await verifyIdToken(await idToken(), config, "expected-nonce", { jwks })).sub, "immutable-subject");
  await assert.rejects(verifyIdToken(await idToken(), config, "wrong-nonce", { jwks }), /nonce/);
  await assert.rejects(verifyIdToken(await idToken({}, "https://wrong.example.test"), config, "expected-nonce", { jwks }));
  const otherKeys = await generateKeyPair("RS256");
  await assert.rejects(verifyIdToken(await idToken({}, issuer, otherKeys.privateKey), config, "expected-nonce", { jwks }));
});

test("database keys and WebDAV folders isolate users without exposing subject text", () => {
  const firstId = scope.userStateId("subject-one");
  const secondId = scope.userStateId("subject-two");
  assert.notEqual(firstId, secondId);
  assert.equal(firstId, `main:user:${scope.userBackupSegment("subject-one")}`);
  assert.doesNotMatch(firstId, /subject-one/);
});

test("legacy shared main rows are never selected or automatically claimed", () => {
  assert.match(previewSource, /WHERE id = \$1 AND owner_sub = \$2/);
  assert.doesNotMatch(previewSource, /UPDATE\s+app_state\s+SET\s+owner_sub/i);
  assert.match(previewSource, /ownerSubHash !== userBackupSegment\(subject\)/);
});

test("state writes require a non-negative safe revision and reject stale updates", () => {
  assert.match(previewSource, /WHERE app_state\.owner_sub = EXCLUDED\.owner_sub AND app_state\.revision = \$5/);
  assert.match(previewSource, /error\.statusCode = 409/);
  assert.match(previewSource, /error\.statusCode = 400/);
});
