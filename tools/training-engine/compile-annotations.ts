import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { compileRules, writeJson } from './compile-rules.ts';
import { catalogCorrections } from '../../src/catalog/corrections.ts';

export const patterns = [
  'squat',
  'lunge',
  'hinge',
  'push_horizontal',
  'push_vertical',
  'pull_horizontal',
  'pull_vertical',
  'carry',
  'anti_extension',
  'anti_rotation',
  'anti_lateral_flexion',
  'rotation',
  'trunk_flexion',
  'isolation_upper',
  'isolation_lower',
  'locomotion_ground',
  'jump_land',
  'throw_upper',
  'olympic',
  'cardio_cyclic',
  'mobility',
  'balance',
] as const;
export const flags = [
  'static_standing_hold',
  'low_intensity',
  'postpartum_safe',
  'deep_knee_flexion',
  'loaded_spinal_flexion',
  'loaded_spinal_rotation',
  'overhead_load',
  'heavy_axial_load',
  'valsalva_prone',
  'balance_demand',
  'unstable_surface',
  'jumping',
  'running',
  'high_fall_risk',
  'grip_intensive',
  'wrist_extension_loaded',
  'kneeling_on_knee',
] as const;
// Published tokens include physical supports and alternatives outside the old UI equipment list.
export const equipment = [
  'none',
  'stability-ball',
  'resistance-band',
  'loop-band',
  'yoga-mat-optional',
  'flat-bench',
  'anchor-point',
  'barbell',
  'squat-rack',
  'box-or-step',
  'dumbbell',
  'cable',
  'leg-press',
  'ez-bar',
  'kettlebell',
  'hack-squat',
  'plates',
  'other-machine',
  'leg-curl',
  'leg-extension',
  'wall',
  'pull-up-bar',
  'lat-pulldown-machine',
  'adjustable-bench',
  'smith-machine',
  'rings',
  'rope',
  'sled',
  'suspension-trainer',
  'chest-press-machine',
  'dip-station',
  'shoulder-press-machine',
  'ab-wheel',
  'medicine-ball',
  'air-bike',
  'battle-rope',
  'elliptical',
  'treadmill',
  'jump-rope',
  'stair-climber',
  'stationary-bike',
  'calf-machine',
  'rowing-machine',
  'ski-erg',
  'chair',
  'door-anchor',
  'wedge',
  'partner',
  'trap-bar',
  'beam',
  'landmine-attachment',
  'room-corner',
  'bench-with-uprights',
  'parallettes',
  'captains-chair',
  'vertical-pole',
  'slam-ball',
  'post',
  'heavy-kettlebell',
  'wrist-roller (stick + cord)',
  'rail',
  'table',
  'towel',
  'backpack',
  'water-bottles',
  'pushup-handles',
  'back-extension-machine',
  'counter',
] as const;
const range = z
  .tuple([z.number().nonnegative(), z.number().nonnegative()])
  .refine(([min, max]) => min <= max, 'Range inverted');
const dose = z
  .strictObject({
    sets: range,
    reps: range.nullable(),
    seconds: range.nullable(),
    rir: range.nullable(),
  })
  .nullable();
const joint = z.number().int().min(0).max(3);
export const annotationSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  primary_pattern: z.enum(patterns),
  secondary_patterns: z.array(z.enum(patterns)),
  modality: z.enum(['strength', 'isometric', 'plyometric', 'cardio', 'mobility', 'power']),
  laterality: z.enum(['bilateral', 'unilateral', 'alternating']),
  nsca_class: z.enum(['power', 'compound', 'isolation', 'none']),
  plane: z.enum(['sagittal', 'frontal', 'transverse', 'multi']),
  difficulty: z.number().int().min(1).max(5),
  joint_load: z.strictObject({
    knee: joint,
    back: joint,
    shoulder: joint,
    wrist: joint,
    hip: joint,
    ankle: joint,
  }),
  impact: z.number().int().min(0).max(2),
  noise: z.number().int().min(0).max(2),
  space: z.enum(['mat', 'small', 'medium', 'large']),
  position: z.array(
    z.enum([
      'standing',
      'supine',
      'prone',
      'plank',
      'kneeling',
      'seated',
      'quadruped',
      'side_lying',
      'hanging',
      'inverted',
    ]),
  ),
  flags: z.array(z.enum(flags)),
  use: z.array(z.enum(['main', 'accessory', 'warmup', 'cooldown', 'conditioning', 'skill'])),
  ladder: z.strictObject({
    id: z.enum(['push_h', 'push_v', 'squat', 'lunge', 'hinge', 'pull_v', 'pull_h', 'core_ae', 'core_lat']).nullable(),
    step: z.number().int().nonnegative(),
  }),
  default_dose: z.strictObject({ beginner: dose, intermediate: dose }),
  time: z.strictObject({
    setup_s: z.number().nonnegative(),
    s_per_rep: z.number().positive().nullable(),
    per_side: z.boolean(),
  }),
  equipment_required: z.array(z.enum(equipment)).min(1),
  equipment_alternatives: z.partialRecord(z.enum(equipment), z.array(z.enum(equipment))),
  confidence: z.enum(['high', 'medium', 'low']),
  review: z.boolean(),
  schema: z.literal('v0.2'),
  note: z.string().optional(),
  catalog_issue: z.string().nullable().optional(),
  source: z.enum(['native', 'custom']).optional(),
  excluded_cautions: z.array(z.enum(['knee', 'back', 'shoulder', 'wrist'])).optional(),
  supported_variant_available: z.boolean().optional(),
  requires_floor_transition: z.boolean().optional(),
  stretch_hold_s: z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([min, max]) => min <= max, 'Stretch hold range inverted')
    .optional(),
});
export type Annotation = z.infer<typeof annotationSchema>;
const yogaPosesSchema = z.strictObject({
  note: z.string(),
  families: z.record(z.string(), z.array(z.string().min(1)).min(1)),
  yogaOnly: z.array(z.string().min(1)),
});
const mobilityOverlaySchema = z.array(
  z.strictObject({
    slug: z.string().min(1),
    mobility_type: z.enum(['dynamic', 'static']),
    stretch_targets: z.array(z.string().min(1)).min(1).optional(),
    sourcePath: z.enum(['src/catalog/generated/details.json', 'src/catalog/custom-exercises.json']),
    stepIndexes: z.array(z.number().int().nonnegative()).min(1),
    stepsSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
);
const balanceOverlaySchema = z.array(
  z.strictObject({
    slug: z.string().min(1),
    balance: z.strictObject({
      base: z.enum(['wide', 'narrow', 'tandem', 'single_leg']),
      mode: z.enum(['static', 'dynamic']),
      hand_support: z.boolean(),
    }),
    sourcePath: z.enum(['src/catalog/generated/details.json', 'src/catalog/custom-exercises.json']),
    stepIndexes: z.array(z.number().int().nonnegative()).min(1),
    stepsSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
);
export function validateBalanceAnnotations(
  input: unknown,
  details: { slug: string; steps: string[] }[],
  annotations: Annotation[],
  customDetails: { slug: string; steps: { en: string[] } }[] = [],
) {
  const rows = balanceOverlaySchema.parse(input);
  if (new Set(rows.map(row => row.slug)).size !== rows.length) throw Error('Duplicate balance annotation');
  for (const row of rows) {
    const annotation = annotations.find(item => item.slug === row.slug),
      source =
        row.sourcePath === 'src/catalog/custom-exercises.json'
          ? customDetails.map(item => ({ slug: item.slug, steps: item.steps.en })).find(item => item.slug === row.slug)
          : details.find(item => item.slug === row.slug);
    if (
      annotation?.primary_pattern !== 'balance' ||
      !source ||
      row.stepIndexes.some(index => !source.steps[index]) ||
      (row.sourcePath === 'src/catalog/custom-exercises.json' && annotation.source !== 'custom')
    )
      throw Error('Unknown balance source: ' + row.slug);
    if (createHash('sha256').update(JSON.stringify(source.steps)).digest('hex') !== row.stepsSha256)
      throw Error('Balance source changed; re-review required: ' + row.slug);
  }
  return rows;
}
export function validateMobilityAnnotations(
  input: unknown,
  details: { slug: string; steps: string[] }[],
  annotations: Annotation[],
  targetGroups?: readonly string[],
  customDetails: { slug: string; steps: { en: string[] } }[] = [],
) {
  const rows = mobilityOverlaySchema.parse(input);
  if (new Set(rows.map(row => row.slug)).size !== rows.length) throw Error('Duplicate mobility annotation');
  for (const row of rows) {
    const annotation = annotations.find(item => item.slug === row.slug),
      source =
        row.sourcePath === 'src/catalog/custom-exercises.json'
          ? customDetails.map(item => ({ slug: item.slug, steps: item.steps.en })).find(item => item.slug === row.slug)
          : details.find(item => item.slug === row.slug);
    if (row.sourcePath === 'src/catalog/custom-exercises.json' && annotation?.source !== 'custom')
      throw Error('Unknown mobility annotation source: ' + row.slug);
    if (annotation?.modality !== 'mobility' || !source || row.stepIndexes.some(index => !source.steps[index]))
      throw Error('Unknown mobility annotation source: ' + row.slug);
    if (
      row.stretch_targets &&
      (row.mobility_type !== 'static' ||
        new Set(row.stretch_targets).size !== row.stretch_targets.length ||
        (targetGroups && row.stretch_targets.some(group => !targetGroups.includes(group))))
    )
      throw Error('Invalid explicit stretch targets: ' + row.slug);
    if (createHash('sha256').update(JSON.stringify(source.steps)).digest('hex') !== row.stepsSha256)
      throw Error('Mobility source changed; re-review required: ' + row.slug);
  }
  return rows;
}

export function validateAnnotations(input: unknown) {
  const annotations = z.array(annotationSchema).parse(input);
  if (new Set(annotations.map(row => row.id)).size !== annotations.length) throw Error('Duplicate annotation ID');
  if (new Set(annotations.map(row => row.slug)).size !== annotations.length) throw Error('Duplicate annotation slug');
  const ladders = new Map<string, Annotation[]>();
  for (const row of annotations)
    if (row.ladder.id) ladders.set(row.ladder.id, [...(ladders.get(row.ladder.id) ?? []), row]);
  for (const [id, rows] of ladders) {
    rows.sort((a, b) => a.ladder.step - b.ladder.step);
    for (let i = 1; i < rows.length; i++)
      if (rows[i].difficulty < rows[i - 1].difficulty) throw Error('Ladder difficulty inverted: ' + id);
  }
  return annotations;
}

export async function compileAnnotations(root = process.cwd()) {
  const compiledRules = await compileRules(root),
    { rulesVersion } = compiledRules;
  const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
  const source = validateAnnotations(await read('data/training-engine/annotations.json'));
  if (source.length !== 637) throw Error('Expected exactly 637 pinned source annotations');
  const native = validateAnnotations(await read('data/training-engine/native-annotations.json'));
  const registry = (await read('src/catalog/generated/registry.json')) as {
    id: string;
    slug: string;
    bodyPart?: string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
  }[];
  const core = (await read('src/catalog/generated/core.json')) as {
    id: string;
    slug: string;
    name: { zh: string; en: string };
    metricType: string;
    equipment: string;
  }[];
  if (
    registry.length !== source.length ||
    source.some(row => !registry.some(entry => entry.id === row.id && entry.slug === row.slug))
  )
    throw Error('Source annotation/catalog ID mismatch');
  const nativeNames: Record<string, { zh: string; en: string }> = {
    'native-goblet-squat': { zh: '高脚杯深蹲', en: 'Goblet squat' },
    'native-bodyweight-squat': { zh: '徒手深蹲', en: 'Bodyweight squat' },
    'native-self-resisted-row': { zh: '自阻力划船', en: 'Self-resisted Row' },
  };
  let custom: Annotation[] = [];
  try {
    custom = validateAnnotations(await read('data/training-engine/custom-annotations.json'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const customCatalog = (await read('src/catalog/custom-exercises.json')) as {
    id: string;
    slug: string;
    steps: { en: string[] };
    name: { zh: string; en: string };
    metricType: string;
    equipment: string;
    bodyPart?: string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
  }[];
  const annotations = validateAnnotations([
    ...native,
    ...source.filter(row => !native.some(item => item.id === row.id)),
    ...custom,
  ]);
  const details = (await read('src/catalog/generated/details.json')) as {
    entries: { slug: string; steps: string[] }[];
  };
  const groups = (
    compiledRules.rules.find(rule => rule.id === 'dose.muscle_groups')!.value as { target_groups: string[] }
  ).target_groups;
  const mobility = validateMobilityAnnotations(
    await read('data/training-engine/mobility-annotations.json'),
    details.entries,
    annotations,
    groups,
    customCatalog,
  );
  const balance = validateBalanceAnnotations(
    await read('data/training-engine/balance-annotations.json'),
    details.entries,
    annotations,
    customCatalog,
  );
  const exercises = annotations.map(row => {
    const entry = core.find(entry => entry.id === row.id) ?? customCatalog.find(entry => entry.id === row.id),
      muscles = registry.find(entry => entry.id === row.id) ?? customCatalog.find(entry => entry.id === row.id);
    const correction = catalogCorrections[row.slug];
    const { note: _, schema: __, catalog_issue: ___, ...runtimeAnnotation } = row;
    const mobilityEntry = mobility.find(item => item.slug === row.slug);
    return {
      ...runtimeAnnotation,
      ...(balance.find(item => item.slug === row.slug)
        ? { balance: balance.find(item => item.slug === row.slug)!.balance }
        : {}),
      ...(mobilityEntry
        ? {
            mobility_type: mobilityEntry.mobility_type,
            ...(mobilityEntry.stretch_targets ? { stretch_targets: mobilityEntry.stretch_targets } : {}),
          }
        : {}),
      name: correction?.name ?? entry?.name ?? nativeNames[row.slug],
      metricType:
        entry?.metricType ??
        (row.modality === 'isometric'
          ? 'duration'
          : row.equipment_required.some(eq => ['dumbbell', 'barbell', 'kettlebell'].includes(eq))
            ? 'reps_load'
            : 'reps'),
      ...(muscles?.bodyPart ? { bodyPart: muscles.bodyPart } : {}),
      primaryMuscles: muscles?.primaryMuscles ?? [],
      secondaryMuscles: muscles?.secondaryMuscles ?? [],
      equipment: correction?.equipment ?? entry?.equipment ?? row.equipment_required[0],
      source: row.source ?? 'repdb',
    };
  });
  // Yoga families tag known poses; yoga-only poses stay out of every other goal's exercise pool.
  const yoga = yogaPosesSchema.parse(await read('data/training-engine/yoga-poses.json')),
    family = new Map(Object.entries(yoga.families).flatMap(([name, slugs]) => slugs.map(slug => [slug, name]))),
    known = new Set(exercises.map(row => row.slug));
  for (const slug of [...family.keys(), ...yoga.yogaOnly])
    if (!known.has(slug)) throw Error('Unknown yoga pose: ' + slug);
  if (family.size !== Object.values(yoga.families).flat().length) throw Error('Duplicate yoga pose');
  const tagged = exercises.map(row => (family.has(row.slug) ? { ...row, yoga_family: family.get(row.slug)! } : row)),
    general = tagged.filter(row => !yoga.yogaOnly.includes(row.slug)),
    yogaExercises = tagged.filter(row => yoga.yogaOnly.includes(row.slug));
  const index = (keys: (row: (typeof exercises)[number]) => string[]) => {
    const result: Record<string, string[]> = {};
    for (const row of general) for (const key of keys(row)) (result[key] ??= []).push(row.id);
    return result;
  };
  const output = {
    rulesVersion,
    exercises: general,
    yogaExercises,
    byPattern: index(row => [row.primary_pattern, ...row.secondary_patterns]),
    byEquipment: index(row => row.equipment_required),
    byFlag: index(row => row.flags),
    byLadder: index(row => (row.ladder.id ? [row.ladder.id] : [])),
    counts: {
      repdb: source.length,
      native: native.length,
      custom: custom.length,
      total: exercises.length,
    },
  };
  await writeJson(resolve(root, 'src/engine/generated/exercise-index.json'), output);
  console.log(
    `Training exercise index: ${source.length} source + ${native.length} native + ${custom.length} custom = ${exercises.length}`,
  );
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await compileAnnotations();
