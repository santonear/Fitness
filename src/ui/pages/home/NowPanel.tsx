import { useEffect, useMemo, useState } from 'react';
import { TEXT_LIMITS, textIssue } from '../../../domain/input-guard';
import { FieldIssue } from '../../components/common/FieldIssue';
import { Card, ChoiceChip, HomePanel, PrimaryButton } from '../../components/kit';
import { DEFAULT_HOME_PANEL_STYLE, NOW_MINUTES, type BudgetRequest, type HomePanelStyle, type NowMinutes, type NowSession } from '../../../domain/plan-upgrade';
import { buildNowSession, sessionMuscleFocus, weeklyMuscleLoad } from '../../../application/rules/plan-upgrade';
import { homePanelStyle } from '../../../persistence/plan-upgrade-store';
import { coachReminderService } from '../../../application/coach-reminders';
import type { SessionTemplate, WorkoutRecord } from '../../../domain/v8/contracts';
import { yayaV5 } from '../../../i18n/features/coach/yaya-v5';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { figureSex, figureShape, nowCoachLine, remindersUnused, returnLine, usedMinutes, weekSetEntries } from '../plan-upgrade/logic';
import { intention, lastFigureSex, outlineShown, setIntention } from '../plan-upgrade/prefs';
import { useMainline } from '../../mainline/context';
import { useFeature } from '../../useFeature';
import { EvidenceFold } from '../plan-upgrade/Evidence';

const nearest = (minutes: number | undefined): NowMinutes => NOW_MINUTES.reduce((best, value) => Math.abs(value - (minutes ?? 30)) < Math.abs(best - (minutes ?? 30)) ? value : best, NOW_MINUTES[0]);
type Variant = NonNullable<BudgetRequest['variant']>;
type Scene = NonNullable<BudgetRequest['scene']>;
const VARIANTS: readonly Variant[] = ['standard', 'tired', 'no-equipment'];
const SCENES: readonly Scene[] = ['commute', 'office', 'bedtime'];

/** What 今天 hands to 今天练这里: either a rules-built session or the suggested plan session. */
export interface FocusState { exerciseIds: string[]; minutes: number; templateId?: string }

/** Rules-built session for the chosen minutes, drawn from the plan's (already safety-filtered) exercises; falls back to the suggested plan session. */
export function useNowSession(request: BudgetRequest, template: SessionTemplate | undefined, workouts: readonly WorkoutRecord[], weekDates: readonly string[], options: { planId?: string; candidateIds?: readonly string[]; avoidJoints?: readonly ('knee' | 'back' | 'shoulder' | 'wrist')[]; preferTemplate?: boolean }) {
  const weekLoads = useMemo(() => weeklyMuscleLoad(weekSetEntries(workouts, weekDates)), [workouts, weekDates.join()]);
  const candidates = options.candidateIds?.join(), joints = options.avoidJoints?.join();
  const built = useMemo(() => buildNowSession(request, {
    weekLoads, usedMinutesThisWeek: usedMinutes(workouts, weekDates),
    ...(options.planId ? { planId: options.planId } : {}), ...(options.candidateIds ? { candidateIds: options.candidateIds } : {}), ...(options.avoidJoints?.length ? { avoidJoints: options.avoidJoints } : {}),
  }), [request.minutes, request.variant, request.scene, weekLoads, workouts, weekDates.join(), options.planId, candidates, joints]);
  const session: (NowSession & { templateId?: string }) | undefined = useMemo(() => {
    const planned = () => { const ids = [...new Set(template!.items.map(item => item.exerciseId))]; return { exerciseIds: ids, minutes: template!.estimatedMinutes, focus: sessionMuscleFocus(ids), templateId: template!.id }; };
    // The panel opens on the plan's own session; another time, B plan or scene asks the rules for a rebuilt one.
    if (options.preferTemplate && template && !request.scene && !request.variant) return planned();
    if (built?.exerciseIds.length) return built;
    if (!template || request.scene) return undefined;
    return planned();
  }, [built, template, request.scene, request.variant, options.preferTemplate]);
  return { session, weekLoads };
}

/** 今天's single main action: how much time now, then start (UIUX20261008 V9.14), with the M2 extras around it. */
export function NowPanel({ template, weekDates, blocked, today, onStart }: { template?: SessionTemplate; weekDates: readonly string[]; blocked: boolean; today: string; onStart: (state: FocusState) => void }) {
  const { data, facts, locale, navigate } = useMainline();
  const remindersEnabled = useFeature('trainingReminders');
  const c = planPagesCopy[locale], y = yayaV5[locale];
  const [style, setStyle] = useState<HomePanelStyle>(DEFAULT_HOME_PANEL_STYLE);
  // Untouched, the panel follows the suggested plan session (also after 换一份).
  const [pickedMinutes, setMinutes] = useState<NowMinutes>();
  const planMinutes = nearest(template?.estimatedMinutes), minutes = pickedMinutes ?? planMinutes;
  const [variant, setVariant] = useState<Variant>('standard');
  const [scene, setScene] = useState<Scene>();
  const [plan, setPlan] = useState(intention);
  const [editing, setEditing] = useState(false);
  // One main action per screen (V9.14): B plan, scenes and the intention prompt stay folded until asked for.
  const [more, setMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [returnClosed, setReturnClosed] = useState(false);
  const [reminderAsk, setReminderAsk] = useState(false);
  useEffect(() => { let alive = true; void homePanelStyle().then(value => { if (alive) setStyle(value); }).catch(() => undefined); return () => { alive = false; }; }, []);
  // v5 §15: only when the person turned reminders on themselves.
  useEffect(() => {
    if (!remindersEnabled) return;
    let alive = true;
    void coachReminderService.preferences().then(ledger => { if (alive) setReminderAsk(remindersUnused(ledger.preferences.enabled, ledger.records)); }).catch(() => undefined);
    return () => { alive = false; };
  }, [remindersEnabled]);
  const request = useMemo<BudgetRequest>(() => scene ? { minutes: 5, scene } : { minutes, ...(variant !== 'standard' ? { variant } : {}) }, [minutes, variant, scene]);
  const candidateIds = useMemo(() => [...new Set((data?.version?.templates ?? []).flatMap(item => item.items.map(row => row.exerciseId)))], [data?.version?.id]);
  const avoidJoints = (data?.state?.coachProfile?.cautions ?? []).filter((joint): joint is 'knee' | 'back' | 'shoulder' | 'wrist' => joint !== 'other');
  const { session, weekLoads } = useNowSession(request, template, data?.workouts ?? [], weekDates, { ...(data?.plan?.id ? { planId: data.plan.id } : {}), ...(candidateIds.length ? { candidateIds } : {}), avoidJoints, preferTemplate: minutes === planMinutes });
  const values = data?.profile?.bodyDetails?.values;
  const shape = outlineShown() ? figureShape(values, figureSex(values?.biologicalSex, lastFigureSex())) : undefined;
  const focus = session?.focus ?? { primary: [], secondary: [], byExercise: {} };
  const welcome = returnClosed ? undefined : returnLine(data?.workouts ?? [], today);
  const start = () => { if (!blocked && session) onStart({ exerciseIds: session.exerciseIds, minutes: session.templateId ? session.minutes : request.minutes, ...(session.templateId ? { templateId: session.templateId } : {}) }); };
  const coachLine = scene ? (scene === 'commute' ? y.fragmentStairs : y.fragmentHonest) : variant !== 'standard' ? y.bPlan : nowCoachLine(minutes, session?.exerciseIds.length ?? 0, weekLoads, locale);
  return <>
    {welcome && <Card variant="raised" padding="md" as="section" className="v9-home-panel" role="status">
      <p>{y[welcome]}</p>
      <div className="v9-home-row">
        <PrimaryButton size="sm" onClick={() => { setVariant('tired'); setScene(undefined); setMinutes(15); setReturnClosed(true); }}>{welcome === 'returnHello' ? y.returnHelloGo : y.returnEasyGo}</PrimaryButton>
        <PrimaryButton tone="quiet" size="sm" onClick={() => setReturnClosed(true)}>{welcome === 'returnHello' ? y.returnHelloLater : y.returnEasyFull}</PrimaryButton>
      </div>
    </Card>}
    {plan && !editing && <p className="v9-home-reason">{c.intentionLabel} · {plan} <PrimaryButton tone="text" size="sm" onClick={() => { setDraft(plan); setEditing(true); }}>{c.intentionEdit}</PrimaryButton></p>}
    <HomePanel style={style} locale={locale} minutes={scene ? 5 : minutes} onMinutes={value => { setScene(undefined); setMinutes(value); }} focus={focus} weekLoads={weekLoads}
      weekDone={facts?.complete ?? 0} weekTarget={data?.version?.weeklyTarget ?? 0} {...(shape ? { shape } : {})} coachLine={coachLine} disabled={blocked || !session} onStart={start}/>
    <div className="v9-home-row">
      <PrimaryButton tone="text" size="sm" aria-expanded={more || !!scene || variant !== 'standard'} onClick={() => setMore(value => !value)}>{c.moreWays}</PrimaryButton>
      {!plan && !editing && <PrimaryButton tone="text" size="sm" onClick={() => { setDraft(''); setEditing(true); }}>{c.intentionAdd}</PrimaryButton>}
    </div>
    {(more || !!scene || variant !== 'standard') && <>
      <div className="v9-home-row" role="group" aria-label={c.variantLabel}>
        {VARIANTS.map(value => <ChoiceChip key={value} size="sm" selected={!scene && variant === value} onClick={() => { setScene(undefined); setVariant(value); }}>{c.variant[value]}</ChoiceChip>)}
      </div>
      <div className="v9-home-row" role="group" aria-label={c.sceneLabel}>
        {SCENES.map(value => <ChoiceChip key={value} size="sm" selected={scene === value} onClick={() => setScene(scene === value ? undefined : value)}>{c.scene[value]}</ChoiceChip>)}
        <PrimaryButton tone="text" size="sm" onClick={() => navigate('/calm')}>{c.calm}</PrimaryButton>
      </div>
    </>}
    {scene && <EvidenceFold locale={locale} items={['fragment', 'strength']}/>}
    {editing && <Card variant="raised" padding="md" as="section" className="v9-home-panel">
      <label className="v9-home-intention"><span>{y.intentionAsk}</span><input value={draft} maxLength={TEXT_LIMITS.short} placeholder={c.intentionPlaceholder} aria-invalid={textIssue(draft, TEXT_LIMITS.short) ? true : undefined} onChange={event => setDraft(event.target.value)}/><FieldIssue issue={textIssue(draft, TEXT_LIMITS.short)} locale={locale} max={TEXT_LIMITS.short}/></label>
      <PrimaryButton tone="quiet" size="sm" disabled={!draft.trim() || !!textIssue(draft, TEXT_LIMITS.short)} onClick={() => { if (setIntention(draft)) { setPlan(draft.trim().slice(0, 80)); setEditing(false); } }}>{c.intentionSave}</PrimaryButton>
    </Card>}
    {reminderAsk && <Card variant="raised" padding="md" as="section" className="v9-home-panel">
      <p>{y.reminderUnused}</p>
      <div className="v9-home-row">
        <PrimaryButton tone="quiet" size="sm" onClick={() => navigate('/settings#reminders')}>{y.reminderMove}</PrimaryButton>
        <PrimaryButton tone="quiet" size="sm" onClick={() => void coachReminderService.preferences().then(ledger => coachReminderService.preferences({ ...ledger.preferences, enabled: false })).then(() => setReminderAsk(false)).catch(() => undefined)}>{y.reminderOff}</PrimaryButton>
      </div>
    </Card>}
  </>;
}
