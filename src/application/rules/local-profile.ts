import type {EngineProfileFields} from '../engine-profile';
import {bodyValuesSchema,type BodyValues,type BodyField} from '../../domain/body-profile';
import type { CoachProfile } from '../../domain/v8/contracts';
import { sessionDuration } from './session-duration';
import { EQUIPMENT, equipmentLabel } from '../../catalog/taxonomy';

const counts: Record<string,number> = {一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,once:1,twice:2};
const quantity = '(?:[1-7]|[一二两三四五六七]|one|two|three|four|five|six|seven|once|twice)';
const countValue = (value:string) => counts[value.toLowerCase()] ?? Number(value);
type PreferredDay=NonNullable<CoachProfile['preferredDays']>[number];
const chineseDays:Record<string,PreferredDay>={一:'mon',二:'tue',三:'wed',四:'thu',五:'fri',六:'sat',日:'sun',天:'sun'};

/** Explicit preferred weekdays; an occasional weekend session is not a weekly commitment. */
export function preferredTrainingDays(text:string):PreferredDay[] {
 const match=text.match(/(?:周|星期)?([一二三四五六日天](?:[、，,和及与\s]*[一二三四五六日天]){2,6})(?=\s*(?:晚上|早上|上午|下午|可以|能练|有空|锻炼|训练|[,，。；;]|$))/);
 if(match){const days=[...match[1]].map(day=>chineseDays[day]).filter((day):day is PreferredDay=>Boolean(day));return [...new Set(days)]}
 const english=[...text.toLowerCase().matchAll(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/g)].map(match=>(({monday:'mon',tuesday:'tue',wednesday:'wed',thursday:'thu',friday:'fri',saturday:'sat',sunday:'sun'} as Record<string,PreferredDay>)[match[1]]??match[1]) as PreferredDay);
 return [...new Set(english)];
}
/** Explicit frequencies only; never interpret session minutes as weekly counts. */
export function weeklyFrequency(text:string):number {
 const normalized=text.toLowerCase();
 const days=preferredTrainingDays(text);
 if(days.length)return days.length;
 const segments=[...normalized.matchAll(new RegExp(`(?:工作日|平日|周末|weekdays?|weekends?)\\s*(${quantity})\\s*(?:次|times?)?`,'g'))];
 if(segments.length===2&&/工作日|平日|weekday/.test(normalized)&&/周末|weekend/.test(normalized)&&!/周末偶尔|偶尔.*周末|weekends? sometimes|occasionally.*weekends?/.test(normalized))return Math.min(7,segments.reduce((sum,m)=>sum+countValue(m[1]),0));
 const before=normalized.match(new RegExp(`(?:每周|一周|weekly|per week|week)\\s*(${quantity})`));
 const after=normalized.match(new RegExp(`(${quantity})\\s*(?:次|times?)?\\s*(?:a week|per week|weekly|每周)`));
 const training=normalized.match(new RegExp(`(?:每周|一周)\\s*(${quantity})\\s*(?:练|训练)`));
 return countValue(before?.[1]??after?.[1]??training?.[1]??'2');
}

/** A typed "other" area that names a supported joint also gets that joint's automatic swaps. */
export function cautionFields(cautions: CoachProfile['cautions'], note?: string): Pick<CoachProfile, 'cautions' | 'cautionNote'> {
  const text = cautions.includes('other') ? note?.trim() : undefined;
  if (!text) return { cautions };
  const named: CoachProfile['cautions'] = [/膝|knee/i.test(text) && 'knee', /腰|背|back/i.test(text) && 'back', /肩|shoulder/i.test(text) && 'shoulder', /腕|wrist/i.test(text) && 'wrist'].filter(Boolean) as CoachProfile['cautions'];
  return { cautions: [...new Set([...cautions, ...named])], cautionNote: text };
}

/** Conservative local proposal parameters; original answers remain intact. */
export function localProfile(answers: { goalText: string; scheduleOriginalText: string; placeEquipmentText: string; adultConfirmed: boolean; cautions: CoachProfile['cautions']; cautionNote?: string } & EngineProfileFields): CoachProfile & EngineProfileFields {
  const minutes = sessionDuration(answers.scheduleOriginalText) ?? 30;
  const equipment = EQUIPMENT.filter(key => key !== 'none' && [key, equipmentLabel(key, 'zh'), equipmentLabel(key, 'en')].some(label => {
    const text=answers.placeEquipmentText.toLowerCase(),at=text.indexOf(label.toLowerCase());
    return at>=0&&!/(?:没有|没带|不用|不使用|无|\bno\b|without|don't have|do not have)[^,，;；。]*$/i.test(text.slice(0,at));
  }));
  if (/健身房|gym|器械都有/i.test(answers.placeEquipmentText) && !equipment.length&&!/没有|无器械|\bno\b|without|don't have|do not have/i.test(answers.placeEquipmentText)) equipment.push('dumbbell', 'barbell', 'flat-bench', 'cable', 'lat-pulldown-machine', 'chest-press-machine', 'stationary-bike');

  const places = [ /在家|家里|家中|居家|home/i.test(answers.placeEquipmentText) && 'home', /健身房|gym/i.test(answers.placeEquipmentText) && 'gym', /户外|outdoor/i.test(answers.placeEquipmentText) && 'outdoor' ].filter(Boolean);
  if (!places.length) throw new Error('LOCAL_PLACE_UNRESOLVED');
  const preferredDays=preferredTrainingDays(answers.scheduleOriginalText);
  const {goal,level,constraints,population,screening,preferences,birthYearMonth,equipmentLoadsKg,painState,healthStorageConsent}=answers;
  return { ...Object.fromEntries(Object.entries({goal,level,constraints,population,screening,preferences,birthYearMonth,equipmentLoadsKg,painState,healthStorageConsent}).filter(([,value])=>value!==undefined)), goalText: answers.goalText, scheduleOriginalText: answers.scheduleOriginalText,
    weeklyTarget: weeklyFrequency(answers.scheduleOriginalText),
    ...(preferredDays.length?{preferredDays}:{}),
    sessionMinutes: minutes,
    place: places.length > 1 ? 'mixed' : places[0] as CoachProfile['place'], equipment: ['none', ...equipment],
    placeEquipmentOriginalText: answers.placeEquipmentText,
    adultConfirmed: answers.adultConfirmed, ...cautionFields(answers.cautions, answers.cautionNote), confirmedAt: new Date().toISOString() };
}

/** Parse explicit everyday quantities locally; never infer health or fill absent measurements. */
export function parseBodyText(text:string):BodyValues {
 const values:BodyValues={};let remaining=text;
 if(/不愿透露|不想说|prefer not|rather not/i.test(text))values.biologicalSex='不愿透露';
 else if(/女|\bfemale\b|\bwoman\b/i.test(text))values.biologicalSex='女性';
 else if(/男|\bmale\b|\bman\b/i.test(text))values.biologicalSex='男性';
 const meter=text.match(/(?:一米([一二三四五六七八九十零〇\d]{1,3})|1\s*米\s*(\d{1,2}))/);
 if(meter){const digits:Record<string,string>={零:'0',〇:'0',一:'1',二:'2',三:'3',四:'4',五:'5',六:'6',七:'7',八:'8',九:'9'};const suffix=(meter[1]??meter[2]).replace(/[零〇一二三四五六七八九]/g,char=>digits[char]);const cm=100+(suffix.length===1?Number(suffix)*10:Number(suffix));if(bodyValuesSchema.safeParse({heightCm:cm}).success)values.heightCm=cm;remaining=remaining.replace(meter[0],' ')}
 const patterns:[BodyField,RegExp][]=[['age',/(?:年龄|age)\s*[:：]?\s*(\d+(?:\.\d+)?)/i],['age',/(\d+(?:\.\d+)?)\s*(?:岁|years?(?: old)?|yo)/i],['waistCm',/(?:腰围|waist)\s*[:：]?\s*(\d+(?:\.\d+)?)/i],['heightCm',/(?:身高|height)\s*[:：]?\s*(\d+(?:\.\d+)?)/i],['weightKg',/(?:体重|weight)\s*[:：]?\s*(\d+(?:\.\d+)?)/i],['heightCm',/(\d+(?:\.\d+)?)\s*(?:厘米|cm)/i],['weightKg',/(\d+(?:\.\d+)?)\s*(?:公斤|千克|kg|kilograms?)/i],['weightKg',/(\d+(?:\.\d+)?)\s*斤/i]];
 for(const [key,pattern] of patterns){if(key==='weightKg'&&values.weightKg!==undefined)continue;const match=remaining.match(pattern);if(!match)continue;const parsed=bodyValuesSchema.safeParse({[key]:Number(match[1])*(/斤$/.test(match[0])&&!/公斤$/.test(match[0])?0.5:1)});if(parsed.success)Object.assign(values,parsed.data);remaining=remaining.replace(match[0],' ')}
 const bare=remaining.split(/[，,、;；\s]+/).filter(part=>/^\d+$/.test(part)).map(Number);
 if(bare.length===1&&values.age===undefined&&values.heightCm===undefined&&values.weightKg===undefined&&bare[0]>=12&&bare[0]<=70)values.age=bare[0];
 // A lone unlabelled 100–230 value after explicit age/weight is a conventional centimetre height.
 if(values.heightCm===undefined&&bare.length===1&&(values.age!==undefined||values.weightKg!==undefined)&&bare[0]>=100&&bare[0]<=230)values.heightCm=bare[0];
 if(bare.length===3&&values.age===undefined&&values.heightCm===undefined&&values.weightKg===undefined){const parsed=bodyValuesSchema.safeParse({age:bare[0],heightCm:bare[1],weightKg:bare[2]});if(parsed.success)Object.assign(values,parsed.data)}
 return values;
}
