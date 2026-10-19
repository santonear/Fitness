import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sendAssistant, AssistantError } from '../../../assistant/client';
import { accessCopy } from '../../../application/ai-access';
import { dietModules } from '../../../application/nutrition-module';
import { nutritionAdviceCopy } from '../../../i18n/features/nutrition/advice';
import { assistantCopy } from '../../../i18n/features/coach/assistant';
import { Card, ChoiceChip, PrimaryButton, Yaya } from '../../components/kit';
import { Composer } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useFeature } from '../../useFeature';
import { useAccessStatus } from '../../useAccessStatus';
import { NutritionRecords } from './NutritionRecords';
import { repository } from '../../../persistence/repository';
import './nutrition.css';

type Message = { role: 'user' | 'assistant'; content: string };

/**
 * 营养建议: an AI conversation scoped to everyday food, intake and nutrition (request topic
 * `nutrition`, no training context, no records sent, no cards), plus the local 饮食记录.
 * Future diet-module entries appear through `dietModules()` (src/application/nutrition-module.ts).
 */
export function NutritionAdvicePage() {
  const c = useMainline(), locale = c.locale, t = nutritionAdviceCopy[locale], a = assistantCopy[locale];
  const aiEnabled = useFeature('aiAssistantV2'), access = useAccessStatus(aiEnabled);
  const recordsEnabled = useFeature('nutrition'), [hasRecords, setHasRecords] = useState(false);
  useEffect(() => { void repository.db.nutritionRecords.count().then(count => setHasRecords(count > 0)).catch(() => setHasRecords(false)); }, []);
  const [query, setQuery] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]), [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const conversation = useRef(crypto.randomUUID()), controller = useRef<AbortController | null>(null);
  const invalid = !!access.status && (access.status.qualification !== 'active' || !access.status.sessionValid), disabled = access.status?.aiEnabled === false;
  const available = aiEnabled && !invalid && !disabled;
  const reason = !aiEnabled || disabled ? accessCopy[locale].reasons.disabled : invalid ? accessCopy[locale].reasons.invalid : undefined;
  // A quick question from the 芽芽 orb arrives as ?ask=…; it only fills the box, the user still sends it.
  useEffect(() => { const ask = query.get('ask'); if (ask) { setText(ask.slice(0, 400)); setQuery({}, { replace: true }); } }, []);
  useEffect(() => () => controller.current?.abort(), []);
  const send = async (message = text) => {
    if (busy || !message.trim() || !available) return;
    const history: Message[] = [...messages, { role: 'user', content: message.trim().slice(0, 4000) }];
    setMessages([...history, { role: 'assistant', content: '' }]); setText(''); setBusy(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    let reply = '';
    try {
      await sendAssistant({
        version: 'fitness-assistant-v2', requestId: crypto.randomUUID(), conversationId: conversation.current, locale,
        timeZone: c.data?.profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        adultConfirmed: c.data?.state?.coachProfile?.adultConfirmed ?? false, topic: 'nutrition',
        consent: { body: false, history: false }, messages: history.slice(-20),
      }, abort.signal, event => {
        if (event.type === 'text_delta') { reply += event.delta; setMessages([...history, { role: 'assistant', content: reply }]); }
      });
    } catch (reason) {
      if (!abort.signal.aborted) {
        const code = reason instanceof Error ? reason.message : '';
        setError(code === 'DAILY_MESSAGE_LIMIT' ? a.limit + (reason instanceof AssistantError && reason.resetAt ? new Date(reason.resetAt).toLocaleString(locale) : '—')
          : code === 'QUALIFICATION_REQUIRED' ? a.invalid : code === 'AI_DISABLED' ? a.disabled : code === 'CONCURRENT_REQUEST' ? a.concurrent
          : code === 'NETWORK_ERROR' || reason instanceof TypeError ? a.network : a.model);
      }
    } finally {
      setMessages(reply ? [...history, { role: 'assistant', content: reply.slice(0, 16000) }] : history);
      setBusy(false);
    }
  };
  const modules = dietModules().flatMap(module => module.entries());
  return <main className="v9-nutrition">
    <header className="v9-nutrition-head">
      <PrimaryButton tone="text" size="sm" onClick={() => c.navigate('/settings')}>{t.back}</PrimaryButton>
      <h1 className="v9-display">{t.title}</h1><p>{t.intro}</p>
    </header>
    <Card variant="raised" padding="md" as="section" className="v9-nutrition-chat" aria-labelledby="v9-nutrition-chat-title">
      <div className="v9-nutrition-chat-head"><Yaya pose={busy ? 'think' : 'head'} size={42} mode="disc" alt="" /><div><h2 id="v9-nutrition-chat-title">{t.chatTitle}</h2><span>{t.scope}</span></div>
        {messages.length > 0 && <PrimaryButton tone="quiet" size="sm" disabled={busy} onClick={() => { setMessages([]); setError(''); conversation.current = crypto.randomUUID(); }}>{t.fresh}</PrimaryButton>}</div>
      {!available && <p className="v9-nutrition-banner" role="status"><span>{t.unavailable}{reason ? ` · ${reason}` : ''}</span>{aiEnabled && invalid && <PrimaryButton tone="quiet" size="sm" onClick={() => c.navigate('/trial')}>{t.activate}</PrimaryButton>}</p>}
      <p className="v9-nutrition-note">{t.privacy}</p>
      {messages.length > 0 && <div role="log" aria-label={t.chatTitle} aria-live="polite" className="v9-nutrition-log">{messages.map((message, index) =>
        <div key={index} className="v9-nutrition-bubble" data-role={message.role}><span className="v9-nutrition-speaker">{message.role === 'user' ? t.you : t.yaya}</span><p>{message.content}</p></div>)}</div>}
      {!messages.length && <div className="v9-nutrition-quick" role="group" aria-label={t.quick}>{t.prompts.map(prompt => <ChoiceChip key={prompt} size="sm" selected={false} disabled={busy || !available} onClick={() => setText(prompt)}>{prompt}</ChoiceChip>)}</div>}
      <Composer value={text} onChange={setText} onSend={value => void send(value)} label={t.input} sendLabel={t.send} busy={busy} disabled={busy || !available} />
      {busy && <PrimaryButton tone="quiet" size="sm" onClick={() => controller.current?.abort()}>{t.stop}</PrimaryButton>}
      {error && <p role="alert">{error}</p>}
    </Card>
    {modules.map(entry => <Card key={entry.id} variant="raised" padding="md" as="section" className="v9-nutrition-module">
      <h2>{entry.title[locale]}</h2>{entry.description && <p>{entry.description[locale]}</p>}
      <PrimaryButton tone="quiet" size="sm" onClick={() => c.navigate(entry.route)}>{entry.title[locale]}</PrimaryButton>
    </Card>)}
    {(recordsEnabled || hasRecords) && <Card variant="raised" padding="md" as="section" className="v9-nutrition-section" aria-labelledby="v9-nutrition-records-title">
      <h2 id="v9-nutrition-records-title">{t.records}</h2>
      <NutritionRecords />
    </Card>}
  </main>;
}
