import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4027,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8035" },
  },
  preview: {
    host: "0.0.0.0",
    port: 4027,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8035" },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
