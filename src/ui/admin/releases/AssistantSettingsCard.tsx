import { useEffect, useState, useRef } from 'react';
import { useReleases } from './use-releases';
import { adminRequest, useAdminAction, reverifyAdmin } from '../shared/api';
import { AdminDialog, AdminToast } from '../shared/components';
import { aiSwitchLabel, useAiSwitch } from '../shared/ai-switch';
import type { ConfigVersion } from '../../../backend/admin/finance/runtime';
export function AssistantSettingsCard({ language = 'zh' }: { language?: string }) {
  const zh = language.startsWith('zh'),
    r = useReleases(zh),
    a = useAdminAction();
  const [config, setConfig] = useState<ConfigVersion>(),
    [limit, setLimit] = useState(30),
    [error, setError] = useState(false),
    [confirm, setConfirm] = useState(false),
    [version, setVersion] = useState('');
  const pendingId = useRef<string | undefined>(undefined);
  const ai = useAiSwitch(),
    [switchConfirm, setSwitchConfirm] = useState(false);
  const switchIds = useRef<{ service: string; flag: string } | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void adminRequest<{ current: ConfigVersion }>('finance/config')
      .then(({ current }) => {
        if (alive) {
          setConfig(current);
          setLimit(current.config.dailyMessageLimit ?? 30);
        }
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const d = r.data,
    flag = d?.features.find(f => f.name === 'aiAssistantV2')?.states.find(s => s.environment === d.environment),
    versions = d?.registeredPromptVersions.filter(v => v.startsWith('assistant-')) ?? [],
    current =
      d?.prompts.find(p => p.task === 'ASSISTANT_CHAT' && p.environment === d.environment)?.version ?? versions[0],
    selected = version || current;
  useEffect(() => {
    const refresh = () => {
      void adminRequest<{ current: ConfigVersion }>('finance/config')
        .then(({ current }) => {
          setConfig(current);
          setLimit(current.config.dailyMessageLimit ?? 30);
        })
        .catch(() => setError(true));
    };
    window.addEventListener('fitness-admin-config-changed', refresh);
    return () => window.removeEventListener('fitness-admin-config-changed', refresh);
  }, []);
  const description = (v: string) =>
    v.includes('v3.1')
      ? zh
        ? '精简意图与计划校验'
        : 'Minimal intents and validated plans'
      : v.includes('v3.0')
        ? zh
          ? '动作目录约束与计划拼装'
          : 'Catalog constrained assembly'
        : zh
          ? '兼容的结构化对话'
          : 'Compatible structured conversation';
  async function save() {
    if (!config) return;
    pendingId.current ??= crypto.randomUUID();
    const ok = await a.run(() =>
      adminRequest(
        'finance/config',
        { expectedVersion: config.version, config: { ...config.config, dailyMessageLimit: limit } },
        pendingId.current!,
      ),
    );
    if (ok) {
      setConfig((await adminRequest<{ current: ConfigVersion }>('finance/config')).current);
      setConfirm(false);
      pendingId.current = undefined;
      window.dispatchEvent(new Event('fitness-admin-config-changed'));
    }
  }
  // Same projection as the todo page: the state the app actually serves.
  const enabled = ai.state?.effective === true;
  async function flipSwitch() {
    if (!d) return;
    switchIds.current ??= { service: crypto.randomUUID(), flag: crypto.randomUUID() };
    const target = !enabled;
    const ok = await a.run(async () => {
      if (!target)
        await adminRequest(
          'releases/flags',
          { name: 'aiAssistantV2', environment: d.environment, enabled: false },
          switchIds.current!.flag,
        );
      await adminRequest('users/action', { action: 'ai', enabled: target }, switchIds.current!.service);
      if (target)
        await adminRequest(
          'releases/flags',
          { name: 'aiAssistantV2', environment: d.environment, enabled: true, confirmed: true },
          switchIds.current!.flag,
        );
    });
    if (ok) {
      await ai.reload();
      await r.refresh();
      setSwitchConfirm(false);
      switchIds.current = undefined;
    }
  }
  return (
    <article className="admin-card">
      <h2>{zh ? '芽芽AI助手' : 'Yaya AI assistant'}</h2>
      {(error || r.error || ai.failed) && (
        <p role="alert">{zh ? '设置暂时无法读取。' : 'Settings could not be loaded.'}</p>
      )}
      <div>
        <span>{zh ? 'AI 开关' : 'AI switch'}</span>{' '}
        <strong>
          {zh ? '当前：' : 'Current: '}
          {aiSwitchLabel(ai.state, zh)}
        </strong>{' '}
        <button disabled={!flag || !ai.state || r.busy || a.busy} onClick={() => setSwitchConfirm(true)}>
          {enabled ? (zh ? '关闭 AI' : 'Turn AI off') : zh ? '开启 AI' : 'Turn AI on'}
        </button>
      </div>
      <label>
        {zh ? '提示词' : 'Prompt'}
        <select value={selected} disabled={!d || r.busy} onChange={e => setVersion(e.target.value)}>
          {versions.map(v => (
            <option key={v} value={v}>
              {v} · {description(v)}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!selected || selected === current || r.busy}
        onClick={() =>
          r.stage({
            path: 'prompts',
            body: { task: 'ASSISTANT_CHAT', environment: d!.environment, version: selected, confirmed: true },
            title: zh ? '切换提示词版本' : 'Change prompt version',
            impact: `${current} → ${selected}`,
          })
        }
      >
        {zh ? '保存提示词' : 'Save prompt'}
      </button>
      <label>
        {zh ? '每人每天消息上限' : 'Daily messages per person'}
        <input
          type="number"
          min="1"
          max="1000"
          step="1"
          value={limit}
          disabled={!config || a.busy}
          onChange={e => setLimit(Number(e.target.value))}
        />
      </label>
      <button
        disabled={
          !config ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 1000 ||
          limit === (config.config.dailyMessageLimit ?? 30) ||
          a.busy
        }
        onClick={() => setConfirm(true)}
      >
        {zh ? '保存消息上限' : 'Save message limit'}
      </button>
      {r.dialog}
      <AdminDialog
        open={switchConfirm}
        busy={a.busy}
        title={zh ? '确认修改AI开关' : 'Confirm AI switch'}
        onClose={() => setSwitchConfirm(false)}
        onConfirm={() => void flipSwitch()}
      >
        <p>
          {zh
            ? `当前：${aiSwitchLabel(ai.state, true)}。将${enabled ? '关闭' : '开启'} AI。`
            : `Current: ${aiSwitchLabel(ai.state, false)}. AI will be turned ${enabled ? 'off' : 'on'}.`}
        </p>
        <p>{zh ? '关闭后只使用本地建议。' : 'When off, only local suggestions are used.'}</p>
        {a.freshRequired && <button onClick={reverifyAdmin}>{zh ? '重新验证身份' : 'Verify identity again'}</button>}
      </AdminDialog>
      <AdminDialog
        open={confirm}
        busy={a.busy}
        title={zh ? '确认消息上限' : 'Confirm message limit'}
        onClose={() => setConfirm(false)}
        onConfirm={() => void save()}
      >
        <dl>
          <dt>{zh ? '每人每天消息上限' : 'Daily messages per person'}</dt>
          <dd>
            {zh ? '改前' : 'Before'}: {config?.config.dailyMessageLimit ?? 30} → {zh ? '改后' : 'After'}: {limit}
          </dd>
        </dl>
        {a.freshRequired && <button onClick={reverifyAdmin}>{zh ? '重新验证身份' : 'Verify identity again'}</button>}
      </AdminDialog>
      <AdminToast message={a.message} />
    </article>
  );
}
