import type { ReleaseCommand, ReleaseOverview } from './types';
export function PreviewSimulationCard({
  data,
  zh,
  busy,
  stage,
}: {
  data: ReleaseOverview;
  zh: boolean;
  busy: boolean;
  stage: (command: Omit<ReleaseCommand, 'requestId'>) => void;
}) {
  const entry = data.registered.find(item => item.environment === 'preview');
  if (data.environment !== 'preview' || !data.previewSimulation || !entry?.previous) return null;
  return (
    <section className="admin-card">
      <h2>{zh ? '预览回滚模拟' : 'Preview rollback simulation'}</h2>
      <p>
        {zh
          ? '只验证已登记版本的选择和数据兼容性，不改变实际 Cloudflare 部署。实际线上检查结果在下方单独显示。'
          : 'Validates registered version selection and data compatibility without changing the actual Cloudflare deployment. Live checks are shown separately below.'}
      </p>
      <p>
        {zh ? '模拟目标' : 'Simulation target'}：{entry.previous.id}
      </p>
      <p role="status">
        {data.previewSimulation.changedAt
          ? zh
            ? '模拟验证已完成，实际部署未改变。'
            : 'Simulation completed; actual deployment is unchanged.'
          : zh
            ? '尚未模拟。'
            : 'Not simulated yet.'}
      </p>
      <button
        disabled={busy}
        onClick={() =>
          stage({
            path: 'simulate-rollback',
            body: {
              environment: 'preview',
              expectedCurrent: entry.current.id,
              target: entry.previous!.id,
              confirmed: true,
            },
            title: zh ? '确认模拟回滚' : 'Confirm simulated rollback',
            impact: zh
              ? '仅保存模拟选择，不切换实际代码、不回退数据库。'
              : 'Save only the simulated selection. Actual code and database stay unchanged.',
          })
        }
      >
        {zh ? '模拟回滚' : 'Simulate rollback'}
      </button>
    </section>
  );
}
