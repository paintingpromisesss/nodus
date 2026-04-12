import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/health': {
        target: process.env.VITE_API_BASE ?? 'http://localhost:8888',
        changeOrigin: true,
      },
      '/fetch': {
        target: process.env.VITE_API_BASE ?? 'http://localhost:8888',
        changeOrigin: true,
      },
      '/download': {
        target: process.env.VITE_API_BASE ?? 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
});
