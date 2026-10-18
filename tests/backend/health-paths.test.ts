import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {healthPaths} from '../../src/domain/health-paths';
it('monitors use the canonical /api/v1 health paths, never the SPA root aliases',()=>{
 expect(healthPaths.health).toBe('/api/v1/health');expect(healthPaths.features).toBe('/api/v1/features');
 for(const file of ['tools/release/smoke.mjs','src/backend/admin/releases/deployment.ts','.github/workflows/deploy-cloudflare.yml','.github/workflows/rollback-production.yml']){
  const text=readFileSync(file,'utf8');
  expect(text,file).not.toMatch(/['"`(]\/(?:health|features)['"`)]/);
  expect(text,file).not.toMatch(/workers\.dev\/(?:health|features)\b/);
 }
 expect(readFileSync('docs/cloudflare-release.md','utf8')).toContain('src/domain/health-paths.ts');
 for(const file of ['tools/release/smoke.mjs','src/backend/admin/releases/deployment.ts'])expect(readFileSync(file,'utf8'),file).toContain('healthPaths');
});
