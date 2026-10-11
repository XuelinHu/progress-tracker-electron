import { defineConfig } from "vite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

const useHttps = process.env.DEV_HTTPS === "1";
const httpsPort = 4093;
const apiPort = process.env.API_PORT || 8035;
const apiTarget = process.env.VITE_API_TARGET || `http://127.0.0.1:${apiPort}`;
const tlsDirectory = resolve(process.cwd(), "../identity-service/tls/apps/progress-tracker-electron");
const tlsCert = resolve(tlsDirectory, "server.crt");
const tlsKey = resolve(tlsDirectory, "server.key");

if (useHttps && !(existsSync(tlsCert) && existsSync(tlsKey))) {
  throw new Error(`HTTPS requires the LAN development certificate in ${tlsDirectory}`);
}

const apiProxy = {
  "/api": {
    target: apiTarget,
    changeOrigin: true,
    ws: true,
  },
};

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: useHttps ? httpsPort : 4027,
    strictPort: true,
    ...(useHttps ? { https: { cert: tlsCert, key: tlsKey } } : {}),
    proxy: apiProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: useHttps ? httpsPort : 4027,
    strictPort: true,
    ...(useHttps ? { https: { cert: tlsCert, key: tlsKey } } : {}),
    proxy: apiProxy,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
