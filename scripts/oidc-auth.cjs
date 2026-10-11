const OIDC_ISSUER = (process.env.OIDC_ISSUER || "https://192.168.1.9:8042/realms/front").replace(/\/$/, "");
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || "progress-tracker-electron-web";

let josePromise;
let remoteJwks;

async function verifyAccessToken(token, options = {}) {
  if (typeof token !== "string" || token.length < 20 || token.length > 16_384) {
    throw new Error("无效的 OIDC 访问令牌");
  }
  const issuer = options.issuer || OIDC_ISSUER;
  const clientId = options.clientId || OIDC_CLIENT_ID;
  josePromise ||= import("jose");
  const { createRemoteJWKSet, jwtVerify } = await josePromise;
  const jwks = options.jwks || (remoteJwks ||= createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`)));
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: "account", algorithms: ["RS256"] });
  if (payload.azp !== clientId || typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("访问令牌未签发给本应用");
  }
  return { subject: payload.sub, username: String(payload.preferred_username || "").slice(0, 50) };
}

function getBearerToken(req) {
  const authorization = String(req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

module.exports = { OIDC_ISSUER, OIDC_CLIENT_ID, verifyAccessToken, getBearerToken };
