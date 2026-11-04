import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Development: `npm run dev` serves the UI on http://localhost:5173 and forwards /api to the backend.
// The backend must be running (`npm run api` in the backend folder). Change the target with BACKEND_URL in .env.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.BACKEND_URL || "http://127.0.0.1:8787";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { "/api": { target: backend, changeOrigin: true } },
    },
    preview: {
      port: 4173,
      proxy: { "/api": { target: backend, changeOrigin: true } },
    },
    build: { outDir: "dist", sourcemap: false },
  };
});
