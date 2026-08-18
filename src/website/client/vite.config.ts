import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// ADR-0030: the client is a pure browser app. It talks to the local
// @cantilune/website-server over WebSocket; it never imports any
// @cantilune/* runtime package (they are Node-only). The `@shared` alias
// points at the protocol module shared with the server.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": resolve(here, "../shared"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
