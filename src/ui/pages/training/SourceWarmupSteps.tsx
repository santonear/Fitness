import { PrescriptionTempo } from './PrescriptionDetails';
import type { SessionTemplate } from '../../../domain/v8/contracts';
import { toEngineProfile } from '../../../application/engine-profile';
import { calendarDay, Rules } from '../../../engine/data';
import { sourceWarmupRamps, isRealizedBodyweightWarmup } from '../../../engine/source-warmup';
import { engineTrainingCopy } from '../../../i18n/features/training/engine';
import { useMainline } from '../../mainline/context';

const rules = new Rules();
export function SourceWarmupSteps({
  template,
  itemIndex,
  exerciseId,
  unreplayedChanges = false,
}: {
  template?: SessionTemplate;
  itemIndex: number;
  exerciseId?: string;
  unreplayedChanges?: boolean;
}) {
  const { data, locale } = useMainline(),
    profile = data?.state?.coachProfile,
    timeZone = data?.profile?.timeZone ?? 'Asia/Shanghai';
  const asOfDate = calendarDay(new Date().toISOString(), timeZone);
  if (!data || !template || !profile || !asOfDate || unreplayedChanges) return null;
  const mapped = toEngineProfile(profile, {
    asOfDate,
    timeZone,
    locale,
    history: data.workouts,
    ageYears: data.profile?.bodyDetails?.values.age,
    bodyWeightKg: data.profile?.bodyDetails?.values.weightKg,
  });
  if (!mapped) return null;
  const ramp = sourceWarmupRamps(template, mapped, rules).find(
    row => row.itemIndex === itemIndex && (!exerciseId || row.exerciseId === exerciseId),
  );
  if (!ramp || template.items[itemIndex]?.prescription?.warmupSeconds !== ramp.seconds) return null;
  if (
    ramp.kind === 'bodyweight_main' &&
    /(?:^|-)main_1$/.test(template.items[itemIndex]?.prescription?.sourcePosition ?? '') &&
    template.items.some((_, index) => isRealizedBodyweightWarmup(template, index, mapped, rules))
  )
    return null;
  const t = engineTrainingCopy[locale];
  return (
    <section aria-label={t.warmup}>
      <h3>{t.warmup}</h3>
      {ramp.kind === 'bodyweight_main' && (
        <dl>
          <PrescriptionTempo prescription={template.items[itemIndex]?.prescription} locale={locale} />
        </dl>
      )}
      <ol>
        {ramp.scheme.map((set, index) => (
          <li key={index}>
            {set.reps} {t.reps}
            {set.pct_working_load !== undefined ? ` · ${set.pct_working_load}% ${t.workingLoad}` : ''}
          </li>
        ))}
      </ol>
    </section>
  );
}
