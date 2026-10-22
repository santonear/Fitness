import type { PlannedItem, PlanVersion, SessionTemplate } from '../domain/v8/contracts';
import type { Pattern } from '../engine/contracts';
import { Rules } from '../engine/data';
import { exerciseBodyPart } from '../catalog/registry';
import { addDays, todayIn } from '../domain/local-date';

/**
 * Read-only presentation of a plan (V9 plan/home screens): session names derived from
 * the actual exercises, main body parts and a weekly calendar. Nothing here is stored.
 */
export type Weekday = NonNullable<SessionTemplate['weekday']>;
export const weekdays: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export type BodyRegion = 'legs' | 'glutes' | 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'mobility' | 'balance' | 'full';
type SessionKind = 'full' | 'lower' | 'upper' | 'core' | 'cardio' | 'mobility' | 'balance';

let rules: Rules | undefined;
const engineRules = () => (rules ??= new Rules());

const patternRegion: Partial<Record<Pattern, BodyRegion>> = {
  squat: 'legs', lunge: 'legs', hinge: 'glutes', isolation_lower: 'legs', jump_land: 'legs',
  push_horizontal: 'chest', push_vertical: 'shoulders', pull_horizontal: 'back', pull_vertical: 'back', isolation_upper: 'arms', throw_upper: 'shoulders',
  anti_extension: 'core', anti_rotation: 'core', anti_lateral_flexion: 'core', trunk_flexion: 'core', rotation: 'core',
  cardio_cyclic: 'cardio', locomotion_ground: 'cardio', mobility: 'mobility', balance: 'balance', carry: 'full', olympic: 'full',
};
const bodyPartRegion: Record<string, BodyRegion> = {
  legs: 'legs', 'upper-legs': 'legs', 'lower-legs': 'legs', glutes: 'glutes', chest: 'chest', back: 'back', shoulders: 'shoulders',
  'upper-arms': 'arms', 'lower-arms': 'arms', core: 'core', cardio: 'cardio', 'full-body': 'full',
};
const lower = new Set<BodyRegion>(['legs', 'glutes']);
const upper = new Set<BodyRegion>(['chest', 'back', 'shoulders', 'arms']);

/** Region of one planned item: engine pattern first, catalog body part as fallback. */
export function itemRegion(item: Pick<PlannedItem, 'exerciseId' | 'prescription'>): BodyRegion | undefined {
  const pattern = item.prescription?.pattern ?? engineRules().byExercise.get(item.exerciseId)?.primary_pattern;
  return (pattern && patternRegion[pattern]) || bodyPartRegion[exerciseBodyPart(item.exerciseId)];
}
const warmupOrCooldown = (item: PlannedItem) => item.prescription?.block === 'warmup' || item.prescription?.block === 'cooldown';

/** Main regions in order of how many working items train them (warm-up and cool-down excluded when others exist). */
function sessionRegions(template: Pick<SessionTemplate, 'items'>): BodyRegion[] {
  const working = template.items.filter(item => !warmupOrCooldown(item));
  const items = working.length ? working : template.items;
  const counts = new Map<BodyRegion, number>();
  for (const item of items) { const region = itemRegion(item); if (region) counts.set(region, (counts.get(region) ?? 0) + item.sets); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([region]) => region);
}

export function sessionKind(template: Pick<SessionTemplate, 'items'>): SessionKind {
  const working = template.items.filter(item => !warmupOrCooldown(item));
  const items = working.length ? working : template.items;
  const counts = { lower: 0, upper: 0, core: 0, cardio: 0, mobility: 0, balance: 0, full: 0 };
  for (const item of items) {
    const region = itemRegion(item);
    if (!region) continue;
    if (lower.has(region)) counts.lower++; else if (upper.has(region)) counts.upper++; else counts[region as 'core' | 'cardio' | 'mobility' | 'balance' | 'full']++;
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (!total) return 'full';
  const strength = counts.lower + counts.upper + counts.full + counts.core;
  if (counts.cardio * 2 >= total && counts.cardio >= strength) return 'cardio';
  if (counts.mobility * 2 >= total && !strength) return 'mobility';
  if (counts.balance + counts.mobility >= total - counts.cardio && !strength) return counts.balance >= counts.mobility ? 'balance' : 'mobility';
  if (counts.full || (counts.lower && counts.upper)) return 'full';
  if (counts.lower) return 'lower';
  if (counts.upper) return 'upper';
  if (counts.core) return 'core';
  return 'full';
}

const kindNames: Record<SessionKind, [string, string]> = {
  full: ['全身', 'Full body'], lower: ['下肢', 'Lower body'], upper: ['上肢', 'Upper body'], core: ['核心', 'Core'],
  cardio: ['有氧', 'Cardio'], mobility: ['拉伸与灵活', 'Mobility'], balance: ['平衡与稳定', 'Balance'],
};
export const regionNames: Record<BodyRegion, [string, string]> = {
  legs: ['腿部', 'Legs'], glutes: ['臀部', 'Glutes'], chest: ['胸部', 'Chest'], back: ['背部', 'Back'], shoulders: ['肩部', 'Shoulders'],
  arms: ['手臂', 'Arms'], core: ['核心', 'Core'], cardio: ['有氧', 'Cardio'], mobility: ['拉伸', 'Mobility'], balance: ['平衡', 'Balance'], full: ['全身', 'Full body'],
};
const letters = 'ABCDEFG';

/** Real session names ("全身 A", "下肢", "有氧") derived from content; repeated kinds get A/B/C. */
/** Engine/basic placeholder names ("训练", "Training", "30 分钟"); anything else is a real name and is kept verbatim. */
export const genericSessionName = (name: string) => /^\s*(?:训练|训练单|训练\s*\d+|training|workout|session|\d+\s*(?:分钟|min(?:utes)?))\s*$/i.test(name);
/**
 * Names the app itself wrote ("全身 A", "Lower body") follow the current language; a name is only
 * treated this way when it is exactly a kind name with an optional letter, so the user's own names stay verbatim.
 */
export function presetSessionName(name: string, locale: 'zh' | 'en'): string | undefined {
  const match = name.trim().match(/^(.+?)(?:\s+([A-G]))?$/);
  if (!match) return undefined;
  const kind = (Object.keys(kindNames) as SessionKind[]).find(key => kindNames[key].some(label => label.toLowerCase() === match[1].toLowerCase()));
  if (!kind) return undefined;
  const label = kindNames[kind][locale === 'zh' ? 0 : 1];
  return match[2] ? `${label} ${match[2]}` : label;
}
export function sessionNames(templates: readonly (Pick<SessionTemplate, 'id' | 'items'> & { name?: string })[], locale: 'zh' | 'en'): Map<string, string> {
  const kinds = templates.map(template => sessionKind(template));
  const totals = new Map<SessionKind, number>(), seen = new Map<SessionKind, number>();
  for (const kind of kinds) totals.set(kind, (totals.get(kind) ?? 0) + 1);
  return new Map(templates.map((template, index) => {
    const kind = kinds[index], name = kindNames[kind][locale === 'zh' ? 0 : 1];
    const order = seen.get(kind) ?? 0; seen.set(kind, order + 1);
    if (template.name && !genericSessionName(template.name)) return [template.id, presetSessionName(template.name, locale) ?? template.name];
    return [template.id, (totals.get(kind) ?? 0) > 1 ? `${name} ${letters[order] ?? order + 1}` : name];
  }));
}
export function regionLabels(template: Pick<SessionTemplate, 'items'>, locale: 'zh' | 'en', limit = 3): string[] {
  return sessionRegions(template).filter(region => region !== 'full' || sessionRegions(template).length === 1).slice(0, limit).map(region => regionNames[region][locale === 'zh' ? 0 : 1]);
}

/** Evenly spread suggestion used only when the user gave no weekdays; labelled as a suggestion in the UI. */
const spread: Record<number, readonly Weekday[]> = {
  1: ['wed'], 2: ['mon', 'thu'], 3: ['mon', 'wed', 'fri'], 4: ['mon', 'tue', 'thu', 'fri'],
  5: ['mon', 'tue', 'wed', 'fri', 'sat'], 6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], 7: weekdays,
};
interface ScheduledSession { day: Weekday; templateId: string }
interface WeekSchedule { sessions: ScheduledSession[]; chosen: boolean }
export function weekSchedule(plan: Pick<PlanVersion, 'weeklyTarget' | 'preferredDays' | 'templates'>): WeekSchedule {
  const templates = plan.templates;
  if (!templates.length) return { sessions: [], chosen: false };
  const fixed = templates.every(template => template.weekday) && new Set(templates.map(template => template.weekday)).size === templates.length;
  // Engine-assigned weekdays are a suggestion unless the user named days themselves.
  if (fixed) return { chosen: !!plan.preferredDays?.length, sessions: weekdays.flatMap(day => templates.filter(template => template.weekday === day).map(template => ({ day, templateId: template.id }))) };
  const preferred = weekdays.filter(day => plan.preferredDays?.includes(day));
  const count = Math.max(1, Math.min(7, Math.round(plan.weeklyTarget) || templates.length));
  const days = preferred.length ? preferred : spread[count] ?? spread[3];
  return { chosen: preferred.length > 0, sessions: days.map((day, index) => ({ day, templateId: templates[index % templates.length].id })) };
}
export const weekdayIndex = (date: Date, timeZone: string) => {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date).toLowerCase().slice(0, 3);
  return Math.max(0, weekdays.indexOf(name as Weekday));
};
export const weekdayLabel = (day: Weekday, locale: 'zh' | 'en', short = false) => {
  const index = weekdays.indexOf(day);
  if (locale === 'zh') return `${short ? '' : '周'}${'一二三四五六日'[index]}`;
  return (short ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])[index];
};

/**
 * Positive reasons from facts the plan already contains. Used when the stored reasons are empty
 * or only repeat engine notices, so "为什么这样排" never opens empty.
 */
export function planReasons(plan: Pick<PlanVersion, 'weeklyTarget' | 'preferredDays' | 'templates'>, locale: 'zh' | 'en'): string[] {
  const zh = locale === 'zh', schedule = weekSchedule(plan), reasons: string[] = [];
  const days = schedule.sessions.map(session => weekdays.indexOf(session.day));
  const spaced = days.length > 1 && days.every((day, index) => index === 0 || day - days[index - 1] >= 2);
  if (spaced) reasons.push(zh ? '练一天歇一天，肌肉有时间恢复。' : 'Rest days between sessions give your muscles time to recover.');
  else if (schedule.chosen) reasons.push(zh ? '按你选的日子安排。' : 'Sessions follow the days you chose.');
  const kinds = new Set(plan.templates.map(template => sessionKind(template)));
  if (kinds.has('cardio') && [...kinds].some(kind => kind !== 'cardio')) reasons.push(zh ? '力量和有氧搭配着练。' : 'Strength and cardio are mixed through the week.');
  else if (plan.templates.length > 1 && new Set(plan.templates.map(template => sessionRegions(template)[0])).size > 1) reasons.push(zh ? '每次练的重点不同，部位轮流休息。' : 'Each session has a different focus, so body parts take turns resting.');
  const minutes = plan.templates.map(template => template.estimatedMinutes);
  if (minutes.length) {
    const min = Math.min(...minutes), max = Math.max(...minutes), range = min === max ? `${min}` : `${min}–${max}`;
    const framed = plan.templates.every(template => template.items.some(item => item.prescription?.block === 'warmup') && template.items.some(item => item.prescription?.block === 'cooldown'));
    reasons.push(zh ? `每次约 ${range} 分钟${framed ? '，含热身和拉伸' : ''}。` : `About ${range} minutes each time${framed ? ', including warm-up and stretching' : ''}.`);
  }
  return reasons;
}

/* ---------- Start date (V9: the user picks when the plan starts) ---------- */
/** Local calendar date (YYYY-MM-DD) in the given time zone. */
export { todayIn as localDateIn, addDays };
export const weekdayOf = (date: string): Weekday => weekdays[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];
/** When the plan starts: the chosen date, or for older versions the day the version was created. */
export function planStartDate(version: { startDate?: string; createdAt?: string }, timeZone: string): string | undefined {
  if (version.startDate) return version.startDate;
  return version.createdAt && Number.isFinite(Date.parse(version.createdAt)) ? todayIn(timeZone, version.createdAt) : undefined;
}
/** Today plus the next `days` days, the dates offered by the start-date picker. */
export const startDateOptions = (today: string, days = 14) => Array.from({ length: days + 1 }, (_, index) => addDays(today, index));
/** "今天" / "明天" / "10月21日 周二" style label for a date relative to today. */
export function startDateLabel(date: string, today: string | undefined, locale: 'zh' | 'en', withWeekday = true): string {
  const day = weekdayLabel(weekdayOf(date), locale);
  const [, month, dayOfMonth] = date.split('-').map(Number);
  const calendar = locale === 'zh' ? `${month}月${dayOfMonth}日` : `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${dayOfMonth}`;
  const relative = !today ? '' : date === today ? (locale === 'zh' ? '今天' : 'Today') : date === addDays(today, 1) ? (locale === 'zh' ? '明天' : 'Tomorrow') : '';
  const full = withWeekday ? `${calendar} ${day}` : calendar;
  return relative ? `${relative} · ${full}` : full;
}
interface PlanWeekDay { date: string; day: Weekday }
/**
 * Dated days for a plan that has not started yet: the first plan week, from the start date. Once the plan
 * has started (or without dates) the view stays the plain Monday-to-Sunday week, so every session is listed.
 */
export function planWeekDays(startDate: string | undefined, today: string | undefined): (PlanWeekDay & { beforeStart: boolean })[] | undefined {
  if (!startDate || !today || startDate <= today) return undefined;
  return Array.from({ length: 7 }, (_, index) => { const date = addDays(startDate, index); return { date, day: weekdayOf(date), beforeStart: false }; });
}
