import { answerText } from '../../../application/preset-text';
import { readBodyReferral, writeBodyReferral } from '../../../assistant/body-change-session';
import { bodyChangeCopy } from '../../../i18n/features/coach/body-change';
import coachZh from '../../../i18n/features/coach/zh.json';
import coachEn from '../../../i18n/features/coach/en.json';
import { lifestyleCopy } from '../../../i18n/features/settings/lifestyle';
import { Button } from '../common';
import { chatCopy } from '../../../i18n/features/coach/chat';
import { engineCopy } from '../../../coach/engine-copy';
import { exercises } from '../../../catalog/exercises';
import type { AssistantState } from './useAssistantState';

/** Values and fragments derived for one render of the panel; plain function, so the tree is unchanged. */
export function assistantView(s: AssistantState) {
  const {
    props,
    onClose,
    request,
    locale,
    t,
    chat,
    busy,
    applying,
    body,
    history,
    candidate,
    remembered,
    workoutContext,
    preferenceCount,
    localReply,
    bodyChange,
    setBodyChange,
    nutritionEnabled,
    diet,
    setDiet,
    setDietWithdrawn,
    bodyFields,
    setBodyFields,
    engineEnabled,
    health,
    setHealth,
    setConsent,
  } = s;
  const response = candidate?.response,
    proposal =
      response &&
      ('proposal' in response
        ? response.proposal
        : response.type === 'review_summary'
          ? response.suggestion?.proposal
          : undefined),
    templates = proposal?.templates ?? (response?.type === 'today_adjustment' ? [response.template] : []);
  const contextSummary =
    request?.task === 'MODIFY_PLAN'
      ? `${answerText(request.plan.goalText, locale)} · ${request.plan.templates.length} ${locale === 'zh' ? '份训练单' : 'training templates'}`
      : request?.task === 'ADJUST_TODAY'
        ? request.template.name
        : request?.task === 'ONBOARD_PLAN'
          ? request.profile.goalText
          : request?.task === 'PERIOD_REVIEW'
            ? `${request.facts.from} — ${request.facts.to}`
            : '';
  const bodyLabels = (locale === 'zh' ? coachZh : coachEn).detailLabels;
  const canApply =
    response &&
    (['plan_proposal', 'change_proposal', 'today_adjustment'].includes(response.type) ||
      (response.type === 'review_summary' && response.suggestion));
  const rememberedText = remembered?.items
    .map(item =>
      item.kind === 'dislike_exercise'
        ? locale === 'zh'
          ? `以后不安排 ${exercises.find(e => e.id === item.value)?.name.zh ?? item.value}`
          : `Avoid ${exercises.find(e => e.id === item.value)?.name.en ?? item.value}`
        : item.kind === 'preferred_days'
          ? locale === 'zh'
            ? '训练日已记住'
            : 'Training days remembered'
          : item.kind === 'cannot_do'
            ? item.value === 'walking_carry'
              ? locale === 'zh'
                ? '以后不安排负重行走'
                : 'Avoid walking carries'
              : locale === 'zh'
                ? '避免跳跃'
                : 'Avoid jumping'
            : item.kind === 'caution_area'
              ? locale === 'zh'
                ? '注意部位已记住'
                : 'Caution area remembered'
              : locale === 'zh'
                ? '器械已记住'
                : 'Equipment remembered',
    )
    .join(' · ');
  const bodyChangeCard = bodyChange && (
    <section className="assistant-bubble" role="status">
      <p>{bodyChangeCopy[locale][bodyChange === 'health' ? 'health' : 'population']}</p>
      <a href="/settings/engine" onClick={onClose}>
        {bodyChangeCopy[locale].update}
      </a>
      <Button
        onClick={() => {
          const row = readBodyReferral(chat.id);
          if (row) {
            row.dismissed.add(bodyChange);
            writeBodyReferral(chat.id, row);
          }
          setBodyChange(undefined);
        }}
      >
        {bodyChangeCopy[locale].dismiss}
      </Button>
    </section>
  );
  const chatT = chatCopy[locale],
    coachT = locale === 'zh' ? coachZh : coachEn;
  const showTools = engineEnabled && !!request?.trainingEngine && (props.localOnly || localReply);
  const consent = (
    <div className="assistant-consent">
      {request?.engineProfile && (
        <label>
          <input
            type="checkbox"
            checked={health}
            disabled={busy || applying}
            onChange={event => setHealth(event.target.checked)}
          />
          {engineCopy('safety.copy.send_health', locale)}
        </label>
      )}
      {request?.body && (
        <>
          <label>
            <input
              type="checkbox"
              checked={body}
              disabled={busy || applying}
              onChange={event => {
                const fields = event.target.checked ? Object.keys(request.body!) : [];
                setBodyFields(fields);
                setConsent('body', event.target.checked, fields);
              }}
            />
            {t.body}
          </label>
          <fieldset>
            <legend>{coachT.body}</legend>
            {Object.entries(request.body).map(([key, value]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  disabled={busy || applying}
                  checked={body && (bodyFields === undefined || bodyFields.includes(key))}
                  onChange={event => {
                    const current = body ? (bodyFields ?? Object.keys(request.body!)) : [];
                    const next = event.target.checked
                      ? [...new Set([...current, key])]
                      : current.filter(field => field !== key);
                    setBodyFields(next);
                    setConsent('body', next.length > 0, next);
                    try {
                      localStorage.setItem('fitness-assistant-body-consent', 'no');
                    } catch {}
                  }}
                />
                {bodyLabels[key as keyof typeof bodyLabels] ?? key} · {String(value)}
              </label>
            ))}
            <p>{coachT.bodySource}</p>
          </fieldset>
        </>
      )}
      {request?.history && (
        <label>
          <input
            type="checkbox"
            checked={history}
            disabled={busy || applying}
            onChange={event => setConsent('history', event.target.checked)}
          />
          {t.historyOpt}
        </label>
      )}
      {nutritionEnabled && (
        <label>
          <input
            type="checkbox"
            checked={diet}
            disabled={busy || applying}
            onChange={event => {
              setDiet(event.target.checked);
              if (!event.target.checked) setDietWithdrawn(true);
            }}
          />
          {lifestyleCopy[locale].dietConsent}
        </label>
      )}
    </div>
  );
  const summaryLine = `${t.summary}${contextSummary ? ` · ${contextSummary}` : ''}${workoutContext ? ` · ${locale === 'zh' ? '本次已完成' : 'Completed this workout'} ${workoutContext.completedSets.length} ${locale === 'zh' ? '组' : 'sets'}` : ''}${preferenceCount ? ` · ${locale === 'zh' ? `已记住的偏好 ${preferenceCount} 项` : `${preferenceCount} saved preferences`}` : ''}${body ? ` · ${t.body}` : ''}${history ? ` · ${t.historyOpt}` : ''}`;
  const onlyTodayText =
    locale === 'zh'
      ? '只改今天这次训练，不改整体计划。请说明你想调整的动作和时长。'
      : 'Change only today’s workout, not the overall plan. Tell me which movements and duration to adjust.';
  return {
    response,
    proposal,
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
  };
}
