import { createServer } from 'vite';
const html =
  '<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="root"></div><script type="module" src="/tests/admin/releases-ui-entry.tsx"></script></body></html>';
const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 5396, strictPort: true },
  plugins: [
    {
      name: 'release-test-harness',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url?.startsWith('/harness')) {
            response.setHeader('Content-Type', 'text/html');
            response.end(html);
          } else next();
        });
      },
    },
  ],
  esbuild: { jsx: 'automatic' },
});
await server.listen();
