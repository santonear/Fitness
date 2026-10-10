import type { CoachProfile } from '../../domain/v8/contracts';
import { mapSchedule } from './map-schedule';

/** Conservative local proposal parameters; original answers remain intact. */
export function localProfile(answers: { goalText: string; scheduleOriginalText: string; placeEquipmentText: string; adultConfirmed: boolean; cautions: CoachProfile['cautions'] }): CoachProfile {
  const mapped = mapSchedule(answers.scheduleOriginalText);
  const single = answers.scheduleOriginalText.match(/(?:^|[^\d])(\d{1,3})\s*(?:分钟|minutes?|mins?)/i);
  const range = answers.scheduleOriginalText.match(/(\d{1,3})\s*(?:[-–—~～至到]|to)\s*(\d{1,3})\s*(?:分钟|minutes?|mins?)/i);
  const minutes = range ? Number(range[1]) : Number(single?.[1] ?? 30);
  const frequency = answers.scheduleOriginalText.match(/(?:每周|weekly|week)\s*([1-7])/i);
  const places = [ /在家|家里|家中|居家|home/i.test(answers.placeEquipmentText) && 'home', /健身房|gym/i.test(answers.placeEquipmentText) && 'gym', /户外|outdoor/i.test(answers.placeEquipmentText) && 'outdoor' ].filter(Boolean);
  if (!places.length) throw new Error('LOCAL_PLACE_UNRESOLVED');
  return { goalText: answers.goalText, scheduleOriginalText: answers.scheduleOriginalText,
    weeklyTarget: Number(frequency?.[1] ?? 2),
    sessionMinutes: mapped.minutes.status === 'answered' ? mapped.minutes.value : Math.min(120, Math.max(15, minutes)),
    place: places.length > 1 ? 'mixed' : places[0] as CoachProfile['place'], equipment: [answers.placeEquipmentText],
    adultConfirmed: answers.adultConfirmed, cautions: answers.cautions, confirmedAt: new Date().toISOString() };
}
