import type { Locale } from '../domain/models';
import { EXERCISE_IDS } from './exercise-ids';
import { catalogMetadata } from './registry';
import { exerciseVisual } from './exercise-visual';
import guides from './generated/guides-zh.json';
import details from './generated/details.json';
import { catalogCorrections } from './corrections';
import { exercise } from './exercise-tags';
export * from './exercise-tags';
export interface ExerciseGuide {
  name: string;
  keyPoints: string[];
  steps: string[];
  mistakes: string[];
  cautions: string[];
  media?: { src: string; alt: string; attribution: string };
}
const guideMap: Record<string, { keyPoints: string[]; steps: string[]; mistakes: string[]; cautions: string[] }> =
  guides;
const detailMap = new Map(details.entries.map(e => [e.id, e]));
/** Show approved sentences as points without rewriting the stored instruction. */
function fallbackPoints(steps: string[]): string[] {
  if (steps.length !== 1) return steps.slice(0, 2);
  return steps[0]
    .split(/(?<=[。！？])|(?<=[.!?])\s+/u)
    .filter(Boolean)
    .slice(0, 3);
}
export function getExerciseGuide(id: string, locale: Locale): ExerciseGuide {
  const e = exercise(id),
    meta = catalogMetadata.get(id),
    slug =
      meta?.slug ??
      (id === EXERCISE_IDS.gobletSquat
        ? 'goblet-squat'
        : id === EXERCISE_IDS.bodyweightSquat
          ? 'bodyweight-squat'
          : undefined),
    detail = detailMap.get(id);
  const guide =
    id === EXERCISE_IDS.selfResistedRow
      ? {
          keyPoints: ['一手轻握对侧手腕，提供轻微阻力', '活动侧肘向后拉，躯干不旋转'],
          steps: e.steps[locale],
          mistakes: locale === 'zh' ? ['用手猛拽手腕；转动身体借力。'] : ['Do not jerk the wrist or twist the torso.'],
          cautions: e.cautions[locale],
        }
      : slug
        ? guideMap[slug]
        : undefined;
  const visual = exerciseVisual(id);
  const correction = slug ? catalogCorrections[slug] : undefined;
  const steps =
    correction?.steps?.[locale] ??
    (locale === 'zh'
      ? id === EXERCISE_IDS.gobletSquat
        ? e.steps.zh
        : (guide?.steps ?? e.steps.zh)
      : (detail?.steps ?? e.steps.en));
  return structuredClone({
    name: e.name[locale],
    keyPoints:
      locale === 'zh'
        ? (guide?.keyPoints ?? fallbackPoints(steps))
        : detail?.cautions.slice(0, 2).length === 2
          ? detail.cautions.slice(0, 2)
          : fallbackPoints(steps),
    steps,
    mistakes:
      locale === 'zh'
        ? (guide?.mistakes ?? ['避免借力猛拉或追求无法控制的动作幅度。'])
        : ['Avoid jerking or using a range you cannot control.'],
    cautions: locale === 'zh' ? (guide?.cautions ?? e.cautions.zh) : (detail?.cautions ?? e.cautions.en),
    ...(visual ? { media: { ...visual, alt: e.name[locale] } } : {}),
  });
}
