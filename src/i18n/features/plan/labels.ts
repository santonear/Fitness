import {
  genericSessionName,
  presetSessionName,
  sessionNames,
  startDateLabel,
} from '../../../application/plan-presentation';
import { storedSummaryText } from '../../../application/preset-text';
import type { PlanVersion, SessionTemplate } from '../../../domain/v8/contracts';
import { planMessages } from './messages';
import { startDateCopy } from './start-date';
export function estimatedDurationLabel(templates: Pick<SessionTemplate, 'estimatedMinutes'>[], locale: 'zh' | 'en') {
  const values = templates.map(template => template.estimatedMinutes);
  if (!values.length) return planMessages[locale].minutes(0);
  const min = Math.min(...values),
    max = Math.max(...values);
  return min === max
    ? planMessages[locale].minutes(min)
    : `${planMessages[locale].minutes(min)} – ${planMessages[locale].minutes(max)}`;
}
/**
 * A session's display name. Durations and app-written names follow the language; placeholder names
 * ("训练", "Training") use the same content-based names as 今天 when the plan's sessions are given.
 */
export function templateLabel(
  template: Pick<SessionTemplate, 'id' | 'name'> & Partial<Pick<SessionTemplate, 'items'>>,
  locale: 'zh' | 'en',
  siblings?: readonly Pick<SessionTemplate, 'id' | 'name' | 'items'>[],
): string {
  const duration = template.name.match(/^(\d+)\s*(?:min(?:utes)?|分钟)$/i);
  if (duration) return `${duration[1]} ${locale === 'zh' ? '分钟' : 'min'}`;
  if (genericSessionName(template.name)) {
    const plan = siblings?.some(item => item.id === template.id)
      ? siblings
      : template.items
        ? [template as Pick<SessionTemplate, 'id' | 'name' | 'items'>]
        : undefined;
    return (plan && sessionNames(plan, locale).get(template.id)) || (locale === 'zh' ? '训练' : 'Training');
  }
  return presetSessionName(template.name, locale) ?? template.name;
}
/** "开始日期改为 {date}" / "Start date changed to {date}" as saved in either language. */
const startDateSummary = (['zh', 'en'] as const).map(
  key => new RegExp(`^${startDateCopy[key].summary.replace('{date}', '.+')}$`),
);
/** A start-date change saved in one language, re-rendered from the version's own start date. */
function storedLine(line: string, version: PlanVersion, locale: 'zh' | 'en'): string {
  if (version.startDate && startDateSummary.some(pattern => pattern.test(line.trim())))
    return startDateCopy[locale].summary.replace('{date}', startDateLabel(version.startDate, undefined, locale));
  return storedSummaryText(line, locale);
}
export function versionSummary(version: PlanVersion, locale: 'zh' | 'en'): string[] {
  const rule = version.reviewRule;
  if (!rule)
    return version.changeSummary.map(line =>
      storedLine(line, version, locale).replace(
        /(\d+)\s*(分钟|min(?:utes)?)/g,
        (_, n) => `${n} ${locale === 'zh' ? '分钟' : 'min'}`,
      ),
    );
  const descriptions = {
    zh: {
      time: '已将对应训练单改为短训练。',
      progression: '已按回顾建议调整动作目标。',
      frequency: '已调整每周训练次数。',
      restart: '已改为较短的训练，重新建立节奏。',
      discomfort: '已替换回顾中提到不适的动作。',
    },
    en: {
      time: 'Replaced the corresponding workout with a shorter session.',
      progression: 'Adjusted exercise targets from the review.',
      frequency: 'Adjusted the weekly training target.',
      restart: 'Switched to shorter sessions to rebuild a routine.',
      discomfort: 'Replaced the exercise associated with reported discomfort.',
    },
  };
  return [
    descriptions[locale][rule],
    locale === 'zh'
      ? `每周 ${version.weeklyTarget} 次 · 每份训练约 ${version.templates.map(t => t.estimatedMinutes).join(' / ')} 分钟`
      : `${version.weeklyTarget} sessions per week · about ${version.templates.map(t => t.estimatedMinutes).join(' / ')} min per workout`,
  ];
}
