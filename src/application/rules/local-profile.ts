import {bodyValuesSchema,type BodyValues,type BodyField} from '../../domain/body-profile';
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

/** Parse explicit everyday quantities locally; never infer health or fill absent measurements. */
export function parseBodyText(text:string):BodyValues {
 const values:BodyValues={};let remaining=text;
 if(/不愿透露|不想说|prefer not|rather not/i.test(text))values.biologicalSex='不愿透露';
 else if(/女|\bfemale\b|\bwoman\b/i.test(text))values.biologicalSex='女性';
 else if(/男|\bmale\b|\bman\b/i.test(text))values.biologicalSex='男性';
 const patterns:[BodyField,RegExp][]=[['age',/(?:年龄|age)\s*[:：]?\s*(\d+(?:\.\d+)?)/i],['age',/(\d+(?:\.\d+)?)\s*(?:岁|years?(?: old)?|yo)/i],['waistCm',/(?:腰围|waist)\s*[:：]?\s*(\d+(?:\.\d+)?)/i],['heightCm',/(?:身高|height)\s*[:：]?\s*(\d+(?:\.\d+)?)/i],['weightKg',/(?:体重|weight)\s*[:：]?\s*(\d+(?:\.\d+)?)/i],['heightCm',/(\d+(?:\.\d+)?)\s*(?:厘米|cm)/i],['weightKg',/(\d+(?:\.\d+)?)\s*(?:公斤|千克|kg|kilograms?)/i]];
 for(const [key,pattern] of patterns){const match=remaining.match(pattern);if(!match)continue;const parsed=bodyValuesSchema.safeParse({[key]:Number(match[1])});if(parsed.success)Object.assign(values,parsed.data);remaining=remaining.replace(match[0],' ')}
 const bare=remaining.split(/[，,、;；\s]+/).filter(part=>/^\d+$/.test(part)).map(Number);
 // A lone unlabelled 100–230 value after explicit age/weight is a conventional centimetre height.
 if(values.heightCm===undefined&&bare.length===1&&(values.age!==undefined||values.weightKg!==undefined)&&bare[0]>=100&&bare[0]<=230)values.heightCm=bare[0];
 if(bare.length===3&&values.age===undefined&&values.heightCm===undefined&&values.weightKg===undefined){const parsed=bodyValuesSchema.safeParse({age:bare[0],heightCm:bare[1],weightKg:bare[2]});if(parsed.success)Object.assign(values,parsed.data)}
 return values;
}
