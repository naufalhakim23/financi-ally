import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The web client is served same-origin with the API in production (a reverse
// proxy maps /api → the Go server). Dev mirrors that exactly rather than
// pointing the app at http://localhost:8080 directly: the refresh cookie is
// scoped to /api/auth, so a split-origin dev setup would behave differently
// from production in precisely the place that is hardest to debug.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      // The money logic shared with the mobile app. Imported straight from
      // source — it is plain TypeScript with no dependencies, so there is
      // nothing to build.
      "@financially/domain": new URL("../shared-context/domain", import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://localhost:8080",
        changeOrigin: false,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
