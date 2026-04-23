import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Forward REST traffic to api-gateway (:8080 in docker-compose).
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
