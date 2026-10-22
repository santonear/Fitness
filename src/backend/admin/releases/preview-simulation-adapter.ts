import { z } from 'zod';
import { adminJson, type AdminDatabase } from '../core/contracts';
import { registeredReleases } from './deployment';
export interface PreviewSimulationEnv {
  ADMIN_ENVIRONMENT?: string;
  ADMIN_SIMULATION_DB?: AdminDatabase;
  ADMIN_RELEASE_REGISTRY?: string;
}
/** Private service binding only. Stores a simulation choice; has no deployment API or token. */
export function createPreviewSimulationAdapter() {
  return {
    async fetch(request: Request, env: PreviewSimulationEnv): Promise<Response> {
      if (env.ADMIN_ENVIRONMENT !== 'preview' || !env.ADMIN_SIMULATION_DB)
        return adminJson({ error: 'PREVIEW_SIMULATION_UNAVAILABLE' }, 503);
      const registry = registeredReleases({ ADMIN_RELEASE_REGISTRY: env.ADMIN_RELEASE_REGISTRY }).find(
        item => item.environment === 'preview',
      );
      if (!registry?.previous) return adminJson({ error: 'PREVIEW_SIMULATION_UNREGISTERED' }, 503);
      if (request.method === 'POST' && new URL(request.url).pathname === '/probe') {
        const input = z
          .object({ url: z.string().url() })
          .strict()
          .safeParse(await request.json().catch(() => null));
        if (!input.success) return adminJson({ error: 'INVALID_PROBE' }, 400);
        const target = new URL(input.data.url),
          allowed = [registry.current.smokeOrigin, registry.previous.smokeOrigin];
        if (
          !allowed.includes(target.origin) ||
          target.username ||
          target.password ||
          target.search ||
          target.hash ||
          !['/', '/api/v1/features', '/api/v1/management/console/releases'].includes(target.pathname)
        )
          return adminJson({ error: 'UNREGISTERED_PROBE' }, 400);
        try {
          const response = await fetch(
            new Request(target, {
              redirect: 'manual',
              credentials: 'omit',
              signal: AbortSignal.timeout(10000),
              headers: { 'Cache-Control': 'no-cache' },
            }),
          );
          let location: string | undefined;
          const raw = response.headers.get('Location');
          if (raw) {
            try {
              const next = new URL(raw, target);
              if (next.protocol === 'https:' && !next.username && !next.password)
                location = next.origin + next.pathname;
            } catch {}
          }
          let featuresValid = false;
          if (target.pathname === '/api/v1/features' && response.ok) {
            try {
              const value = (await response.json()) as { flags?: unknown };
              featuresValid = !!value?.flags && typeof value.flags === 'object' && !Array.isArray(value.flags);
            } catch {}
          }
          return adminJson({ status: response.status, ...(location ? { location } : {}), featuresValid });
        } catch {
          return adminJson({ error: 'PROBE_TRANSPORT_UNAVAILABLE' }, 503);
        }
      }
      const db = env.ADMIN_SIMULATION_DB;
      if (request.method === 'GET') {
        const row = await db
          .prepare('SELECT deployment_id,changed_at,request_id FROM admin_preview_simulation WHERE id=1')
          .first<{ deployment_id: string; changed_at: string; request_id: string }>();
        return adminJson({
          mode: 'preview-simulation',
          actualDeploymentUnchanged: true,
          selectedDeploymentId: row?.deployment_id ?? null,
          changedAt: row?.changed_at ?? null,
          requestId: row?.request_id ?? null,
        });
      }
      const body = z
        .object({
          environment: z.literal('preview'),
          expectedDeployment: z.string().uuid(),
          targetDeployment: z.string().uuid(),
        })
        .strict()
        .safeParse(await request.json().catch(() => null));
      const id = request.headers.get('Idempotency-Key');
      if (
        request.method !== 'POST' ||
        new URL(request.url).pathname !== '/simulate' ||
        !body.success ||
        !id ||
        !/^[-\w]{16,80}$/.test(id)
      )
        return adminJson({ error: 'INVALID_SIMULATION_COMMAND' }, 400);
      if (
        body.data.expectedDeployment !== registry.current.deploymentId ||
        body.data.targetDeployment !== registry.previous.deploymentId
      )
        return adminJson({ error: 'UNREGISTERED_PREVIOUS_RELEASE' }, 409);
      if (registry.previous.compatibleDataVersion !== registry.dataVersion)
        return adminJson({ error: 'PREVIOUS_RELEASE_DATA_INCOMPATIBLE' }, 409);
      const receipt = await db
        .prepare('SELECT expected_id,target_id,result FROM admin_preview_simulation_receipts WHERE request_id=?')
        .bind(id)
        .first<{ expected_id: string; target_id: string; result: string }>();
      if (receipt) {
        if (receipt.expected_id !== body.data.expectedDeployment || receipt.target_id !== body.data.targetDeployment)
          return adminJson({ error: 'REQUEST_ID_CONFLICT' }, 409);
        return adminJson(JSON.parse(receipt.result));
      }
      const changedAt = new Date().toISOString();
      const result = {
        mode: 'preview-simulation',
        actualDeploymentUnchanged: true,
        selectedDeploymentId: registry.previous.deploymentId,
        changedAt,
        requestId: id,
        checks: [
          { check: 'registered_previous', status: 'passed' },
          { check: 'data_compatibility', status: 'passed' },
        ],
      };
      await db.batch([
        db
          .prepare(
            'INSERT INTO admin_preview_simulation_receipts(request_id,expected_id,target_id,result) VALUES(?,?,?,?)',
          )
          .bind(id, body.data.expectedDeployment, body.data.targetDeployment, JSON.stringify(result)),
        db
          .prepare(
            'INSERT INTO admin_preview_simulation(id,deployment_id,changed_at,request_id) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET deployment_id=excluded.deployment_id,changed_at=excluded.changed_at,request_id=excluded.request_id',
          )
          .bind(registry.previous.deploymentId, changedAt, id),
      ]);
      return adminJson(result);
    },
  };
}
export default createPreviewSimulationAdapter();
