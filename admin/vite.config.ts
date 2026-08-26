import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 便于部署到 CloudBase 静态网站根目录（无需服务器 rewrite）
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
