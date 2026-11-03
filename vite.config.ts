import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API runs separately on 8787 (npm run api at the repo root); /api is proxied there.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": { target: process.env.VITE_API_URL ?? "http://127.0.0.1:8787", changeOrigin: true } } },
  build: { outDir: "dist", emptyOutDir: true },
});
