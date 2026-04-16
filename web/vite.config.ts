import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = env.VITE_API_BASE || "http://localhost:8888";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy: {
        "/health": {
          target: apiBase,
          changeOrigin: true,
          secure: false,
        },
        "/fetch": {
          target: apiBase,
          changeOrigin: true,
          secure: false,
        },
        "/download": {
          target: apiBase,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
