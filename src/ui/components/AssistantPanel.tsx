import { clearBodyReferral } from '../../assistant/body-change-session';
import { isFeatureEnabled } from '../../application/feature-flags';
import { EngineLocalActions } from './EngineLocalActions';
import { assistantApplyErrorCopy } from '../../assistant/application-error';
import { AssistantAttachment } from './AssistantAttachment';
import { displayTimeZone } from '../../coach/disclosure-format';
import { ExerciseGuidePanel } from './ExerciseGuide';
import { fill } from '../../i18n/features/onboarding/entry';
import { Fragment, useEffect } from 'react';
import type { CoachPanelProps } from './CoachPanel';
import { Button, Composer, MorphPanel } from './common';
import { Yaya } from './Yaya';
import { ChoiceChip } from './kit/primitives';
import { assistantPreferences, confirmedPreferenceChanges } from '../../persistence/assistant-preferences';
import { engineCopy } from '../../coach/engine-copy';
import { exercises } from '../../catalog/exercises';
import { store, fresh } from './assistant/assistant-store';
import { useAssistantState } from './assistant/useAssistantState';
import { assistantSend } from './assistant/assistant-send';
import { assistantLocal } from './assistant/assistant-local';
import { assistantView } from './assistant/assistant-view';
import './AssistantPanel.css';
/** Historical conversations contain text only: restoring them cannot revive actionable candidates. */
export function AssistantPanel(props: CoachPanelProps) {
  const s = useAssistantState(props);
  const send = assistantSend(s);
  const { localGenerate, localAction } = assistantLocal(s);
  const {
    open,
    onClose,
    request,
    onApply,
    initialSend,
    locale,
    t,
    chat,
    rows,
    setRows,
    text,
    setText,
    busy,
    setBusy,
    applying,
    setApplying,
    body,
    history,
    error,
    setError,
    pending,
    setPending,
    candidate,
    setCandidate,
    saved,
    setSaved,
    historyOpen,
    setHistoryOpen,
    remembered,
    setRemembered,
    localReply,
    bodyFields,
    engineEnabled,
    localNotices,
    setLocalNotices,
    health,
    candidateAnchor,
    guide,
    setGuide,
    guideOpen,
    setGuideOpen,
    guideTrigger,
    toolsOpen,
    setToolsOpen,
    toolsTrigger,
    onlyToday,
    setOnlyToday,
    retryMessage,
    intentStatus,
    applyLock,
    privacy,
    fallbackTrigger,
    controller,
    lock,
    sequence,
    consumed,
    end,
    select,
  } = s;
  useEffect(() => {
    if (open && initialSend && !consumed.current.has(initialSend.nonce)) {
      consumed.current.add(initialSend.nonce);
      void send(initialSend.message, initialSend.request, initialSend.expectedRevision);
    }
  }, [open, initialSend?.nonce]);
  useEffect(() => {
    if (engineEnabled || (!request?.trainingEngine && !candidate?.request.trainingEngine)) return;
    sequence.current++;
    controller.current?.abort();
    lock.current = false;
    setBusy(false);
    setPending(false);
    setCandidate(undefined);
    setLocalNotices([]);
  }, [engineEnabled, request?.trainingEngine, candidate?.request.trainingEngine]);
  const {
    templates,
    contextSummary,
    bodyLabels,
    canApply,
    rememberedText,
    bodyChangeCard,
    chatT,
    coachT,
    showTools,
    consent,
    summaryLine,
    onlyTodayText,
  } = assistantView(s);
  return (
    <>
      <MorphPanel
        open={open}
        onClose={onClose}
        triggerRef={props.triggerRef ?? fallbackTrigger}
        title={t.title}
        closeLabel={t.close}
      >
        <div className="assistant-panel">
          <div className="assistant-head">
            <Yaya pose={busy ? 'think' : 'head'} size={42} mode="disc" alt="" />
            <div className="assistant-head-text">
              <span>{chatT.scope}</span>
            </div>
            <div className="assistant-toolbar">
              <Button disabled={busy || applying} onClick={() => select(fresh())}>
                {t.new}
              </Button>
              <Button
                disabled={busy || applying}
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                {t.history}
              </Button>
              {showTools && (
                <Button
                  disabled={busy || applying}
                  onClick={event => {
                    toolsTrigger.current = event.currentTarget;
                    setToolsOpen(true);
                  }}
                >
                  {chatT.tools}
                </Button>
              )}
            </div>
          </div>
          {props.localOnly && props.unavailableReason && (
            <p className="assistant-banner" role="status">
              <span>
                {chatT.localOnly} · {props.unavailableReason}
              </span>
              {props.onActivate && <Button onClick={props.onActivate}>{chatT.activate}</Button>}
            </p>
          )}
          <div className="assistant-scroll">
            {privacy && <p className="assistant-privacy">{t.privacy}</p>}
            {historyOpen && (
              <ul className="assistant-history">
                {rows.map(row => (
                  <li key={row.id}>
                    <Button disabled={busy || applying} onClick={() => select(row)}>
                      <span className="assistant-history-title">{row.title}</span>
                      <time dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleString(locale)}</time>
                    </Button>
                    <Button
                      disabled={busy || applying}
                      aria-label={`${t.remove}: ${row.title}`}
                      onClick={() =>
                        void store.remove(row.id).then(async () => {
                          clearBodyReferral(row.id);
                          setRows(await store.list());
                          if (row.id === chat.id) select(fresh());
                        })
                      }
                    >
                      {t.remove}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div role="log" aria-label={t.title} aria-live="polite" className="assistant-messages">
              {chat.messages.map((message, index) => (
                <Fragment key={index}>
                  {index === chat.messages.length - 1 && message.role === 'assistant' && bodyChangeCard}
                  <div className={`assistant-bubble assistant-bubble--${message.role}`}>
                    <span className="assistant-speaker">{message.role === 'user' ? t.you : t.title}</span>
                    <p>{message.content}</p>
                  </div>
                </Fragment>
              ))}
              {chat.messages.at(-1)?.role !== 'assistant' && bodyChangeCard}
              {guide && (
                <div className="assistant-bubble assistant-bubble--assistant">
                  <Button
                    onClick={event => {
                      guideTrigger.current = event.currentTarget;
                      setGuideOpen(true);
                    }}
                  >
                    {fill(chatT.guide, { name: exercises.find(e => e.id === guide)?.name[locale] ?? '' })}
                  </Button>
                </div>
              )}
            </div>
            {pending && (
              <p role="status" className="assistant-pending">
                {t.pending}
              </p>
            )}
            {candidate && templates.length > 0 && (
              <section ref={candidateAnchor} className="assistant-attachment">
                <AssistantAttachment candidate={candidate} locale={locale} minutes={props.templateMinutes} />
                {canApply && (
                  <Button
                    disabled={busy || applying || saved || (candidate.request.trainingEngine && !engineEnabled)}
                    onClick={() => {
                      if (!candidate || applyLock.current) return;
                      if (candidate.request.trainingEngine && !isFeatureEnabled('trainingEngine')) {
                        setCandidate(undefined);
                        setError(t.disabled);
                        return;
                      }
                      applyLock.current = true;
                      setApplying(true);
                      void onApply(candidate)
                        .then(async () => {
                          setSaved(true);
                          if (props.rememberOnApply === false) return;
                          const userMessage =
                            chat.messages.filter(message => message.role === 'user').at(-1)?.content ?? '';
                          const items = confirmedPreferenceChanges(candidate.request, candidate.response, userMessage);
                          if (!items.length) return;
                          try {
                            const notes = await assistantPreferences.save(items, locale);
                            if (notes.length) {
                              setRemembered({
                                ids: notes.map(note => note.id),
                                items: notes.map(note => ({ kind: note.kind!, value: note.value! })),
                              });
                              await props.onPreferencesChanged?.();
                            }
                          } catch {
                            setError(t.storage);
                          }
                        })
                        .catch(error => setError(assistantApplyErrorCopy(error, locale)))
                        .finally(() => {
                          applyLock.current = false;
                          setApplying(false);
                        });
                    }}
                  >
                    {saved ? t.saved : (props.applyLabel ?? t.apply)}
                  </Button>
                )}
                {onlyToday && candidate.request.task === 'MODIFY_PLAN' && !saved && (
                  <Button
                    disabled={busy || applying}
                    onClick={() => {
                      setText(onlyTodayText);
                      setCandidate(undefined);
                      setOnlyToday(false);
                    }}
                  >
                    {locale === 'zh' ? '只改今天' : 'Only today'}
                  </Button>
                )}
              </section>
            )}
            {remembered && (
              <p role="status" className="assistant-remembered">
                {locale === 'zh' ? '记住：' : 'Remembered: '}
                {rememberedText}{' '}
                <Button
                  onClick={() =>
                    void assistantPreferences
                      .remove(remembered.ids)
                      .then(async () => {
                        setRemembered(undefined);
                        await props.onPreferencesChanged?.();
                      })
                      .catch(() => setError(t.storage))
                  }
                >
                  {locale === 'zh' ? '撤销' : 'Undo'}
                </Button>
              </p>
            )}
            {intentStatus && <p role="status">{intentStatus}</p>}
            {retryMessage && (
              <p role="status">
                {engineEnabled
                  ? engineCopy('assistant.copy.engine_noop', locale)
                  : locale === 'zh'
                    ? '这次没能生成调整，点重试。'
                    : 'No adjustment was generated this time. Tap to retry.'}{' '}
                <Button disabled={busy} onClick={() => void send(retryMessage)}>
                  {locale === 'zh' ? '重试' : 'Retry'}
                </Button>
              </p>
            )}
            {!candidate?.enginePlan &&
              localNotices.slice(0, 3).map((notice, index) => (
                <p key={index} role="status">
                  {notice}
                </p>
              ))}
            <div ref={end} />
          </div>
          <div className="assistant-input">
            {!chat.messages.length && (
              <div className="assistant-quick" role="group" aria-label={chatT.quick}>
                {chatT.prompts.map(prompt => (
                  <ChoiceChip
                    key={prompt}
                    size="sm"
                    selected={false}
                    disabled={busy || applying}
                    onClick={() => setText(prompt)}
                  >
                    {prompt}
                  </ChoiceChip>
                ))}
              </div>
            )}
            <details className="assistant-share">
              <summary>
                {chatT.share}
                <span className="assistant-summary">{summaryLine}</span>
              </summary>
              {consent}
              {health && request?.engineProfile && (
                <details>
                  <summary>{t.details}</summary>
                  <pre>{JSON.stringify(request.engineProfile, null, 2)}</pre>
                </details>
              )}
              <details className="assistant-details">
                <summary>{t.details}</summary>
                <dl>
                  <dt>{locale === 'zh' ? '你的消息' : 'Your message'}</dt>
                  <dd>{text.trim()}</dd>
                  <dt>{coachT.fields.timeZone}</dt>
                  <dd>
                    {displayTimeZone(request?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, locale)}
                  </dd>
                  {contextSummary && (
                    <>
                      <dt>{locale === 'zh' ? '当前页面资料' : 'Current page context'}</dt>
                      <dd>{contextSummary}</dd>
                    </>
                  )}
                  {body && request?.body && (
                    <>
                      <dt>{coachT.fields.body}</dt>
                      <dd>
                        {Object.keys(request.body).filter(key => !bodyFields || bodyFields.includes(key)).length}{' '}
                        {locale === 'zh' ? '项' : 'fields'}
                      </dd>
                    </>
                  )}
                  {body &&
                    request?.body &&
                    Object.entries(request.body)
                      .filter(([key]) => !bodyFields || bodyFields.includes(key))
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{bodyLabels[key as keyof typeof bodyLabels] ?? key}</dt>
                          <dd>{String(value)}</dd>
                        </div>
                      ))}
                  {history && request?.history && (
                    <>
                      <dt>{locale === 'zh' ? '训练历史' : 'Training history'}</dt>
                      <dd>
                        {request.history.length} {locale === 'zh' ? '字' : 'characters'}
                      </dd>
                    </>
                  )}
                </dl>
              </details>
            </details>
            <Composer
              value={text}
              onChange={setText}
              onSend={() => void send()}
              label={t.input}
              sendLabel={t.send}
              busy={busy}
              disabled={busy || applying}
              locale={locale}
            />
            {busy && <Button onClick={() => controller.current?.abort()}>{t.stop}</Button>}
            {error && <p role="alert">{error}</p>}
            {(localReply || !request || props.localOnly) && (
              <div className="assistant-local">
                {localReply && !(props.localOnly && props.unavailableReason) && (
                  <p role="status">
                    {t.local}
                    {props.unavailableReason && ` · ${props.unavailableReason}`}
                  </p>
                )}
                {props.onLocalReview && <Button onClick={props.onLocalReview}>{coachT.localReview}</Button>}
                {props.onLocalPlan && <Button onClick={props.onLocalPlan}>{coachT.localPlan}</Button>}
              </div>
            )}
          </div>
        </div>
      </MorphPanel>
      {showTools && request && (
        <MorphPanel
          open={toolsOpen}
          onClose={() => setToolsOpen(false)}
          triggerRef={toolsTrigger}
          title={chatT.toolsTitle}
          closeLabel={t.close}
          placement="bottom"
        >
          <div className="assistant-tools">
            <EngineLocalActions
              request={request}
              locale={locale}
              busy={busy || applying || !request.engineProfile}
              onAction={action => {
                setToolsOpen(false);
                void localAction(action);
              }}
              onGuide={id => {
                setGuide(id);
                guideTrigger.current = toolsTrigger.current;
                setToolsOpen(false);
                setGuideOpen(true);
              }}
              onGenerate={() => {
                setToolsOpen(false);
                void localGenerate();
              }}
            />
          </div>
        </MorphPanel>
      )}
      <ExerciseGuidePanel
        id={guide}
        locale={locale}
        open={guideOpen && !!guide}
        onClose={() => setGuideOpen(false)}
        triggerRef={guideTrigger}
      />
    </>
  );
}
