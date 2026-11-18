import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/assets/lg3s-world/',
  plugins: [{
    name: 'lg3s-viewer-route',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/lg3s-gb(?:\?|$)/.test(req.url)) req.url = req.url.replace('/lg3s-gb', '/live.html');
        next();
      });
    },
  }],
  build: {
    rollupOptions: {
      input: {
        live: resolve(import.meta.dirname, 'live.html'),
        pregame: resolve(import.meta.dirname, 'pregame.html'),
        rink: resolve(import.meta.dirname, 'rink-preview.html'),
      },
    },
  },
});
