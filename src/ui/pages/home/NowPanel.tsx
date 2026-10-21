import { useEffect, useMemo, useState } from 'react';
import { HomePanel } from '../../components/kit';
import { DEFAULT_HOME_PANEL_STYLE, NOW_MINUTES, type BudgetRequest, type HomePanelStyle, type NowMinutes, type NowSession } from '../../../domain/plan-upgrade';
import { buildNowSession, sessionMuscleFocus, weeklyMuscleLoad } from '../../../application/rules/plan-upgrade';
import { homePanelStyle } from '../../../persistence/plan-upgrade-store';
import type { SessionTemplate, WorkoutRecord } from '../../../domain/v8/contracts';
import { figureSex, figureShape, nowCoachLine, usedMinutes, weekSetEntries } from '../plan-upgrade/logic';
import { lastFigureSex, outlineShown } from '../plan-upgrade/prefs';
import { useMainline } from '../../mainline/context';

const nearest = (minutes: number | undefined): NowMinutes => NOW_MINUTES.reduce((best, value) => Math.abs(value - (minutes ?? 30)) < Math.abs(best - (minutes ?? 30)) ? value : best, NOW_MINUTES[0]);

/** What 今天 hands to 今天练这里: either a rules-built session or the suggested plan session. */
export interface FocusState { exerciseIds: string[]; minutes: number; templateId?: string }

/** Rules-built session for the chosen minutes; falls back to the suggested plan session when the rules give none. */
export function useNowSession(request: BudgetRequest, template: SessionTemplate | undefined, workouts: readonly WorkoutRecord[], weekDates: readonly string[], planId?: string) {
  const weekLoads = useMemo(() => weeklyMuscleLoad(weekSetEntries(workouts, weekDates)), [workouts, weekDates]);
  const built = useMemo(() => buildNowSession(request, { weekLoads, usedMinutesThisWeek: usedMinutes(workouts, weekDates), ...(planId ? { planId } : {}) }),
    [request.minutes, request.variant, request.scene, weekLoads, workouts, weekDates, planId]);
  const session: (NowSession & { templateId?: string }) | undefined = useMemo(() => {
    if (built?.exerciseIds.length) return built;
    if (!template) return undefined;
    const ids = [...new Set(template.items.map(item => item.exerciseId))];
    return { exerciseIds: ids, minutes: template.estimatedMinutes, focus: sessionMuscleFocus(ids), templateId: template.id };
  }, [built, template]);
  return { session, weekLoads };
}

/** 今天's single main action: how much time now, then start (UIUX20261008 V9.14). */
export function NowPanel({ template, weekDates, blocked, onStart }: { template?: SessionTemplate; weekDates: readonly string[]; blocked: boolean; onStart: (state: FocusState) => void }) {
  const { data, facts, locale } = useMainline();
  const [style, setStyle] = useState<HomePanelStyle>(DEFAULT_HOME_PANEL_STYLE);
  const [minutes, setMinutes] = useState<NowMinutes>(() => nearest(template?.estimatedMinutes));
  useEffect(() => { let alive = true; void homePanelStyle().then(value => { if (alive) setStyle(value); }).catch(() => undefined); return () => { alive = false; }; }, []);
  const request = useMemo<BudgetRequest>(() => ({ minutes }), [minutes]);
  const { session, weekLoads } = useNowSession(request, template, data?.workouts ?? [], weekDates, data?.plan?.id);
  const values = data?.profile?.bodyDetails?.values;
  const shape = outlineShown() ? figureShape(values, figureSex(values?.biologicalSex, lastFigureSex())) : undefined;
  const focus = session?.focus ?? { primary: [], secondary: [], byExercise: {} };
  return <HomePanel style={style} minutes={minutes} onMinutes={setMinutes} focus={focus} weekLoads={weekLoads}
    weekDone={facts?.complete ?? 0} weekTarget={data?.version?.weeklyTarget ?? 0} {...(shape ? { shape } : {})}
    coachLine={nowCoachLine(minutes, session?.exerciseIds.length ?? 0, weekLoads, locale)}
    onStart={() => { if (!blocked && session) onStart({ exerciseIds: session.exerciseIds, minutes: session.templateId ? session.minutes : minutes, ...(session.templateId ? { templateId: session.templateId } : {}) }); }}/>;
}
