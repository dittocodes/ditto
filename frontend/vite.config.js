import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8003';

/** SPA routes share prefixes with legacy REST paths — only proxy XHR/fetch, not full page loads. */
function proxyApiOnly() {
  return {
    target: apiTarget,
    changeOrigin: true,
    bypass(req) {
      const accept = req.headers.accept || '';
      if (req.method === 'GET' && accept.includes('text/html')) {
        return '/index.html';
      }
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [
    {
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        if (!id.includes('node_modules') && /\.js$/.test(id)) {
          return transformWithEsbuild(code, id, {
            loader: 'jsx',
            jsx: 'automatic',
          });
        }
        return null;
      },
    },
    react(),
  ],
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/auth': { target: apiTarget, changeOrigin: true },
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
      '/student': proxyApiOnly(),
      '/mentor': proxyApiOnly(),
      '/admin': proxyApiOnly(),
      '/leader': proxyApiOnly(),
      '/working-committee': proxyApiOnly(),
      '/department-faculty': proxyApiOnly(),
      '/hod': proxyApiOnly(),
      '/program-faculty': proxyApiOnly(),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  esbuild: {
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/mentor-ui'),
    },
  },
});
