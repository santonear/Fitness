import { BirthReportControls } from './BirthReportControls';
import { exerciseById } from '../../../engine/data';
import { useMainline, workflow } from '../../mainline/context';
import { PregnancySafetyPanel } from './PregnancySafetyPanel';

/** Local safety events stay available even when plan generation is switched off. */
export function PregnancySafetyControls({ exerciseId, itemIndex }: { exerciseId?: string; itemIndex?: number }) {
  const { data, locale, busy, run, navigate } = useMainline(),
    state = data?.state,
    safety = state?.pregnancySafety;
  if (
    !data ||
    (state?.coachProfile?.population?.kind !== 'pregnant' && !safety?.providerPause && !safety?.supineAvoidSince)
  )
    return null;
  const currentSupine =
    !!data.active &&
    itemIndex !== undefined &&
    !!exerciseId &&
    !!exerciseById.get(exerciseId)?.position.includes('supine');
  return (
    <>
      <BirthReportControls />
      <PregnancySafetyPanel
        locale={locale}
        busy={busy}
        paused={!!safety?.providerPause}
        chestEmergency={!!state?.cardiacPause}
        currentSupine={currentSupine}
        supineAvoided={!!safety?.supineAvoidSince}
        onStop={keys =>
          void run(async () => {
            await workflow.reportPregnancyStop(data.active?.id, keys, data.metadata.dataRevision);
            navigate('/workout/recovery');
          })
        }
        onSupine={key =>
          void run(async () => {
            if (!data.active || itemIndex === undefined) return;
            await workflow.reportPregnancySupine(data.active.id, itemIndex, key, data.metadata.dataRevision);
          })
        }
        onConfirmProviderContacted={() =>
          void run(async () => {
            await workflow.confirmPregnancyProviderContacted(data.metadata.dataRevision);
          })
        }
      />
    </>
  );
}
