import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function routeHtmlPlugin(): Plugin {
  return {
    name: 'comara-html-routing',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const fullUrl = req.url || '';
        const [url, query] = fullUrl.split('?');
        const queryStr = query ? `?${query}` : '';

        if (url === '/admin' || url === '/admin/') {
          req.url = `/admin.html${queryStr}`;
        } else if (url === '/' || url === '/index.html') {
          res.writeHead(302, { Location: `/admin${queryStr}` });
          res.end();
          return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const fullUrl = req.url || '';
        const [url, query] = fullUrl.split('?');
        const queryStr = query ? `?${query}` : '';

        if (url === '/admin' || url === '/admin/') {
          req.url = `/admin.html${queryStr}`;
        } else if (url === '/' || url === '/index.html') {
          res.writeHead(302, { Location: `/admin${queryStr}` });
          res.end();
          return;
        }
        next();
      });
    },
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const adminHtml = path.resolve(distDir, 'admin.html');
      if (fs.existsSync(adminHtml)) {
        const adminDir = path.resolve(distDir, 'admin');
        if (!fs.existsSync(adminDir)) fs.mkdirSync(adminDir, { recursive: true });
        fs.copyFileSync(adminHtml, path.resolve(adminDir, 'index.html'));
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), routeHtmlPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
          admin: path.resolve(__dirname, 'admin.html'),
        },
      },
    },
  };
});
