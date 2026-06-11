import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4003,
  },
  preview: {
    host: "0.0.0.0",
    port: 4003,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
