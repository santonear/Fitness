import { useId, useState } from 'react';
import { textIssue } from '../../../domain/input-guard';
import { FieldIssue } from '../../components/common/FieldIssue';
import { feedbackCopy } from '../../../i18n/features/settings/feedback';
import {
  FEEDBACK_CONTACT_MAX,
  FEEDBACK_MESSAGE_MAX,
  FeedbackSendError,
  sendFeedback,
  sentFeedback,
  type SentFeedback,
} from '../../../application/feedback';
import { PrimaryButton } from '../../components/kit';

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** 我的 → 给我们留言: free text to the operator, optional contact, and the user's own sent copies. */
export function FeedbackPanel({ locale }: { locale: 'zh' | 'en' }) {
  const t = feedbackCopy[locale],
    ids = useId();
  const [message, setMessage] = useState(''),
    [contact, setContact] = useState('');
  // One request ID per draft: a retry after a lost response is stored once; any edit starts a new one.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [history, setHistory] = useState<SentFeedback[]>(sentFeedback);
  const edit = (apply: () => void) => {
    apply();
    setRequestId(crypto.randomUUID());
    setStatus('');
  };
  const trimmed = message.trim(),
    messageIssue = textIssue(message, FEEDBACK_MESSAGE_MAX),
    contactIssue = textIssue(contact, FEEDBACK_CONTACT_MAX);
  async function submit() {
    if (!trimmed || busy || messageIssue || contactIssue) return;
    setBusy(true);
    setStatus('');
    try {
      await sendFeedback({ id: requestId, message, contact, locale });
      setMessage('');
      setContact('');
      setRequestId(crypto.randomUUID());
      setHistory(sentFeedback());
      setStatus(t.sent);
    } catch (error) {
      const reason = error instanceof FeedbackSendError ? error.reason : 'unavailable';
      setStatus(
        reason === 'rate'
          ? t.rate
          : reason === 'invalid'
            ? fill(t.invalid, { max: FEEDBACK_MESSAGE_MAX })
            : t.unavailable,
      );
    } finally {
      setBusy(false);
    }
  }
  const dateFormat = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <section className="v9-feedback" aria-labelledby={`${ids}-title`}>
      <h2 id={`${ids}-title`}>{t.row}</h2>
      <p className="v9-feedback-notice">{t.notice}</p>
      <p className="v9-feedback-muted">{t.privacy}</p>
      <form
        className="v9-feedback-form"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="v9-feedback-field">
          {t.message}
          <textarea
            value={message}
            rows={5}
            maxLength={FEEDBACK_MESSAGE_MAX}
            placeholder={t.placeholder}
            aria-invalid={messageIssue ? true : undefined}
            aria-describedby={`${ids}-count`}
            onChange={event => edit(() => setMessage(event.target.value))}
          />
        </label>
        <FieldIssue issue={messageIssue} locale={locale} max={FEEDBACK_MESSAGE_MAX} />
        <span id={`${ids}-count`} className="v9-feedback-count v9-num" aria-live="off">
          {fill(t.count, { count: message.length, max: FEEDBACK_MESSAGE_MAX })}
        </span>
        <label className="v9-feedback-field">
          {t.contact}
          <input
            value={contact}
            maxLength={FEEDBACK_CONTACT_MAX}
            autoComplete="email"
            aria-invalid={contactIssue ? true : undefined}
            aria-describedby={`${ids}-contact`}
            onChange={event => edit(() => setContact(event.target.value))}
          />
        </label>
        <FieldIssue issue={contactIssue} locale={locale} max={FEEDBACK_CONTACT_MAX} />
        <small id={`${ids}-contact`} className="v9-feedback-muted">
          {t.contactHint}
        </small>
        <PrimaryButton type="submit" size="md" disabled={!trimmed || busy || !!messageIssue || !!contactIssue}>
          {busy ? t.sending : t.send}
        </PrimaryButton>
      </form>
      <p role="status" className="v9-feedback-status">
        {status}
      </p>
      {history.length > 0 && (
        <section className="v9-feedback-history" aria-labelledby={`${ids}-history`}>
          <h3 id={`${ids}-history`}>
            {t.history}
            <small>{t.historyHint}</small>
          </h3>
          <ul>
            {history.map(item => (
              <li key={item.id}>
                <time dateTime={new Date(item.at).toISOString()}>{dateFormat.format(item.at)}</time>
                <p>{item.message}</p>
                {item.contact && (
                  <small>
                    {t.contact} · {item.contact}
                  </small>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
