import {durationText} from '../../components/ExerciseTargets';
import type {EnginePrescription} from '../../../engine/contracts';
import {engineTrainingCopy} from '../../../i18n/features/training/engine';
export function PrescriptionDetails({prescription,locale}:{prescription?:EnginePrescription;locale:'zh'|'en'}){
 if(!prescription)return null;
 const t=engineTrainingCopy[locale],strength=['main','accessory'].includes(prescription.block);
 return <dl>{prescription.safetyCue&&<dd>{prescription.safetyCue[locale]}</dd>}{prescription.loadDescription&&<><dt>{t.load}</dt><dd>{prescription.loadDescription[locale]}</dd></>}{strength&&<><dt>{t.rest}</dt><dd>{durationText(prescription.restSeconds,locale,true)}</dd></>}{prescription.secondsPerRep!==undefined&&<><dt>{t.tempo}</dt><dd>{prescription.secondsPerRep} {t.seconds}</dd></>}<PrescriptionTempo prescription={prescription} locale={locale}/>{strength&&<><dt>RIR</dt><dd>{prescription.rir[0]}–{prescription.rir[1]}</dd></>}</dl>;
}

/** The same approved cadence applies to the action and its bodyweight ramp set. */
export function PrescriptionTempo({prescription,locale}:{prescription?:EnginePrescription;locale:'zh'|'en'}){
 if(!prescription?.tempo)return null;const t=engineTrainingCopy[locale];return <><dt>{t.eccentric} / {t.concentric} / {t.pause}</dt><dd>≈{prescription.tempo.eccentricSeconds} / ≈{prescription.tempo.concentricSeconds} / {prescription.tempo.pauseSeconds} {t.seconds}</dd></>;
}
