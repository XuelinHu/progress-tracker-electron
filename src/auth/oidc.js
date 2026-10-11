import { createRemoteJWKSet, jwtVerify } from "jose";

const CALLBACK_PATH = "/oidc-callback";
const remoteJwksByIssuer = new Map();

function randomBase64Url(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function verifyIdToken(token, config, expectedNonce, options = {}) {
  let jwks = options.jwks;
  if (!jwks) {
    jwks = remoteJwksByIssuer.get(config.issuer);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${config.issuer}/protocol/openid-connect/certs`));
      remoteJwksByIssuer.set(config.issuer, jwks);
    }
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.issuer,
    audience: config.clientId,
    algorithms: ["RS256"],
  });
  if (payload.nonce !== expectedNonce) throw new Error("统一登录 nonce 校验失败");
  return payload;
}

export async function startOidcLogin(config) {
  const state = randomBase64Url();
  const nonce = randomBase64Url();
  const verifier = randomBase64Url(48);
  const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
  sessionStorage.setItem("progress-tracker-oidc", JSON.stringify({ state, nonce, verifier, redirectUri }));
  const authorize = new URL(`${config.issuer}/protocol/openid-connect/auth`);
  authorize.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile",
    state,
    nonce,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: "S256",
  });
  window.location.assign(authorize);
}

export async function finishOidcLogin(config) {
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  if (query.has("error")) throw new Error("统一登录未完成，请重试");
  if (!code) return null;
  const saved = JSON.parse(sessionStorage.getItem("progress-tracker-oidc") || "null");
  sessionStorage.removeItem("progress-tracker-oidc");
  if (!saved || !saved.state || saved.state !== query.get("state") || !saved.nonce) {
    throw new Error("登录校验失败，请重新登录");
  }
  const response = await fetch(`${config.issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: saved.redirectUri,
      code_verifier: saved.verifier,
    }),
  });
  const tokens = await response.json().catch(() => ({}));
  if (!response.ok || !tokens.access_token) throw new Error("统一登录令牌交换失败");
  await verifyIdToken(tokens.id_token, config, saved.nonce);
  window.history.replaceState({}, "", window.location.pathname === CALLBACK_PATH ? "/" : window.location.pathname);
  return normalizeTokenResponse(tokens);
}

export async function refreshOidcToken(config, session) {
  const response = await fetch(`${config.issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      refresh_token: session.refreshToken,
    }),
  });
  const tokens = await response.json().catch(() => ({}));
  if (!response.ok || !tokens.access_token) throw new Error("统一登录已过期");
  return normalizeTokenResponse(tokens, session.idToken);
}

export function startOidcLogout(config, session) {
  const logout = new URL(`${config.issuer}/protocol/openid-connect/logout`);
  logout.search = new URLSearchParams({
    client_id: config.clientId,
    post_logout_redirect_uri: window.location.origin,
    ...(session?.idToken ? { id_token_hint: session.idToken } : {}),
  });
  window.location.assign(logout);
}

function normalizeTokenResponse(tokens, fallbackIdToken = "") {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || "",
    idToken: tokens.id_token || fallbackIdToken,
    expiresAt: Date.now() + Math.max(1, Number(tokens.expires_in || 0)) * 1000,
  };
}
