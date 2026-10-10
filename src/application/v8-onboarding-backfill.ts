import { validV4Answer, type Answer } from '../domain/onboarding-v4';
import type { CoachProfile } from '../domain/v8/contracts';

/** Read-only projection. Keep the original twelve answers, including unknowns, in their original store. */
export function backfillOnboarding(answers: Record<string, Answer>, locale: 'zh'|'en') {
  const value = (key: string) => { const answer = answers[key]; return answer?.status === 'answered' && validV4Answer(key, answer) ? answer.value : undefined; };
  const list = (key: string) => { const v = value(key); return Array.isArray(v) ? v : []; };
  const schedule = list('schedule');
  const scheduleText = [schedule[2] ? (locale === 'zh' ? `每周${schedule[2]}次` : `${schedule[2]} times per week`) : '', schedule[1] ? (locale === 'zh' ? `每次${schedule[1]}分钟` : `${schedule[1]} minutes per session`) : '', typeof value('preferences') === 'string' ? value('preferences') : ''].filter(Boolean).join('；');
  const safety = list('safety');
  const cautions: CoachProfile['cautions'] = [];
  for (const part of safety) {
    if (part === '无已知限制') continue;
    const mapped = /膝|knee/i.test(part) ? 'knee' : /腰|背|back/i.test(part) ? 'back' : /肩|shoulder/i.test(part) ? 'shoulder' : /腕|wrist/i.test(part) ? 'wrist' : 'other';
    if (!cautions.includes(mapped)) cautions.push(mapped);
  }
  return { goalText: list('goal').join('、'), scheduleOriginalText: scheduleText,
    placeEquipmentText: [...list('location'), ...list('equipment')].join('、'),
    // An age is not a newly given adult confirmation. Keep this unchecked until confirmed.
    adultConfirmed: false, cautions, safetyAnswered: safety.length > 0 };
}
