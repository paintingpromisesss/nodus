import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiBase = env.VITE_API_BASE ?? 'http://localhost:8888';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/health': {
          target: apiBase,
          changeOrigin: true,
        },
        '/fetch': {
          target: apiBase,
          changeOrigin: true,
        },
        '/download': {
          target: apiBase,
          changeOrigin: true,
        },
      },
    },
  };
});
