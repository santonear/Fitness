import type { MutableRefObject } from 'react';
import { TEXT_LIMITS, type TextIssue } from '../../../domain/input-guard';
import type { ApplicationKind } from '../../../backend/trial-applications';
import { FieldIssue } from '../common/FieldIssue';
import { SecurityCheck } from './SecurityCheck';
import { PrimaryButton } from '../kit';

/** The trial application form (new, extension or replacement), shown after 申请 is tapped. */
export function TrialApplicationForm({
  zh,
  busy,
  kind,
  name,
  setName,
  note,
  setNote,
  requestId,
  nameIssue,
  noteIssue,
  locale,
  assistantV2,
  config,
  challenge,
  proof,
  setProof,
  setForm,
  submit,
}: {
  zh: boolean;
  busy: boolean;
  kind: ApplicationKind;
  name: string;
  setName: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  requestId: MutableRefObject<string>;
  nameIssue: TextIssue | undefined;
  noteIssue: TextIssue | undefined;
  locale: 'zh' | 'en';
  assistantV2: boolean;
  config?: { available: boolean; siteKey: string | null };
  challenge: number;
  proof: string;
  setProof: (proof: string) => void;
  setForm: (open: boolean) => void;
  submit: () => Promise<void>;
}) {
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset disabled={busy}>
        <legend>
          {kind === 'extend'
            ? zh
              ? '申请延期'
              : 'Extension request'
            : kind === 'replace'
              ? zh
                ? '申请补发'
                : 'Replacement request'
              : zh
                ? '申请试用'
                : 'Trial application'}
        </legend>
        <label>
          {zh ? '称呼' : 'Name'}
          <input
            required
            maxLength={TEXT_LIMITS.name}
            value={name}
            aria-invalid={nameIssue ? true : undefined}
            onChange={e => {
              setName(e.target.value);
              requestId.current = crypto.randomUUID();
            }}
          />
        </label>
        <FieldIssue issue={nameIssue} locale={locale} max={TEXT_LIMITS.name} />
        <label>
          {zh ? '申请说明（可选，请勿填写健康或敏感信息）' : 'Note (optional; no health or sensitive information)'}
          <textarea
            maxLength={TEXT_LIMITS.note}
            value={note}
            aria-invalid={noteIssue ? true : undefined}
            onChange={e => {
              setNote(e.target.value);
              requestId.current = crypto.randomUUID();
            }}
          />
        </label>
        <FieldIssue issue={noteIssue} locale={locale} max={TEXT_LIMITS.note} />
        <p>
          {assistantV2
            ? zh
              ? '试用有效期间，AI 服务按每日消息上限使用；手动训练始终可用。'
              : 'During your trial, AI follows a daily message limit. Manual training remains available.'
            : kind === 'extend'
              ? zh
                ? '批准后延长 30 天，不重置次数或预算。'
                : 'Approval adds 30 days without resetting usage or budgets.'
              : kind === 'replace'
                ? zh
                  ? '批准补发将撤销旧浏览器资格，不延长期限或增加次数。'
                  : 'Approval revokes the old browser session without adding time or usage.'
                : zh
                  ? '批准后 7 天内领取，兑换后试用 30 天。AI 调用还受个人次数与项目预算限制。'
                  : 'Claim within 7 days of approval for a 30-day trial. Personal usage and project budget limits still apply.'}
        </p>
        <p>
          {zh
            ? '申请资料用于审核；关闭后按保留规则清理。安全验证由 Cloudflare 提供。'
            : 'Application details are used for review and cleared under the retention policy. Cloudflare provides the security check.'}
        </p>
        <details>
          <summary>{zh ? '申请资料如何保存' : 'How application details are retained'}</summary>
          <p>
            {zh
              ? '不收集邮箱或训练数据。未获批申请关闭后保留 30 天；获批申请在试用结束且相关事项处理完毕后保留 30 天，再清理申请资料。费用与必要审计记录独立保留。'
              : 'No email or training data is collected. Unapproved application details are retained for 30 days after closure; approved details for 30 days after the trial and related matters are complete. Billing and necessary audit records are retained separately.'}
          </p>
        </details>
        {config?.siteKey && <SecurityCheck key={challenge} siteKey={config.siteKey} onProof={setProof} />}
        <PrimaryButton size="md" type="submit" disabled={!proof || !!nameIssue || !!noteIssue}>
          {zh ? '提交申请' : 'Submit application'}
        </PrimaryButton>
        <PrimaryButton tone="quiet" size="md" type="button" onClick={() => setForm(false)}>
          {zh ? '‹ 返回' : '‹ Back'}
        </PrimaryButton>
      </fieldset>
    </form>
  );
}
