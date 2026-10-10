import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pwaBuild } from './tools/pwa-build';
export default defineConfig({
  plugins: [react(), pwaBuild()],
  server: { watch: { ignored: ['**/outputs/**', '**/test-results*/**', '**/.superpowers/**'] } },
  build: {
    rolldownOptions: {
      output: {
        // These remain static imports, loaded before opened-app offline use.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'storage-validation', test: /node_modules[\\/](dexie|zod)[\\/]/ },
          ],
        },
      },
    },
  },
});
