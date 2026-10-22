import { toEngineProfile } from '../../../application/engine-profile';
import { calendarDay, Rules } from '../../../engine/data';
import { runGates } from '../../../engine/gates';
import { useMainline } from '../../mainline/context';

const rules = new Rules();
/** Foreground information only: no delivery schedule or background notification. */
export function PelvicFloorDailyNotice() {
  const { data, locale } = useMainline(),
    state = data?.state,
    profile = state?.coachProfile;
  const timeZone = data?.profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = calendarDay(new Date().toISOString(), timeZone);
  if (
    !data ||
    !state ||
    !profile?.healthStorageConsent ||
    !day ||
    state.cardiacPause ||
    state.trainingPause ||
    state.pregnancySafety?.providerPause ||
    state.postpartumSafety?.urgentAt ||
    state.postpartumSafety?.regression ||
    state.olderSafety?.reviewRequiredAt
  )
    return null;
  const kind = profile.population?.kind;
  if (kind !== 'pregnant' && kind !== 'postpartum') return null;
  const mapped = toEngineProfile(profile, {
    asOfDate: day,
    timeZone,
    locale,
    history: data.workouts,
    pregnancySafety: state.pregnancySafety,
    postpartumSafety: state.postpartumSafety,
    olderSafety: state.olderSafety,
    painFollowupRestrictions: state.painFollowupRestrictions,
    cautionLevels: state.cautionLevels,
    screeningEvidenceEvents: state.screeningEvidenceEvents,
  });
  if (!mapped || runGates(mapped, rules).status === 'blocked') return null;
  const key = kind === 'pregnant' ? 'pregnancy.pelvic_floor.copy' : 'postpartum.pelvic_floor.copy';
  return (
    <aside data-source-rule={key}>
      <time dateTime={day}>{day}</time>
      <p>{rules.text(key)[locale]}</p>
    </aside>
  );
}
