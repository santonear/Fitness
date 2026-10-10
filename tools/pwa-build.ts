import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';

/** One complete, versioned shell; never discovers URLs from user/API traffic. */
export function pwaBuild(): Plugin {
  return {
    name: 'fitness-offline-shell',
    enforce: 'post',
    apply: 'build',
    async generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(name => /\.(?:js|css|woff2?)$/.test(name)).map(name => `/${name}`).sort();
      const revision = createHash('sha256');
      for (const name of Object.keys(bundle).sort()) {
        const item = bundle[name];
        revision.update(name).update(item.type === 'chunk' ? item.code : item.source);
      }
      const source = await readFile(new URL('../public/pwa/sw-template.js', import.meta.url), 'utf8');
      revision.update(source);
      this.emitFile({ type: 'asset', fileName: 'fitness-sw.js', source: source
        .replace('__FITNESS_REVISION__', revision.digest('hex').slice(0, 20))
        .replace('__FITNESS_ASSETS__', JSON.stringify(['/', '/manifest.webmanifest', '/pwa/icon.svg', '/pwa/icon-192.png', '/pwa/icon-512.png', ...assets])) });
    },
  };
}
