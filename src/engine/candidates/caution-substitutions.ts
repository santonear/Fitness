import { ownedEquipment } from '../equipment';
import type { Caution, EngineProfile } from '../contracts';
import { condition, Rules, type Exercise, type RuleValue } from '../data';

type SubstitutionRow = {
  slug?: string;
  cue?: string;
  unless?: RuleValue;
  requires_equipment_any?: string[];
  dose?: { seconds?: { min: number; max: number } };
};

export interface CautionSubstitution {
  exercise: Exercise;
  ruleId?: string;
  row?: SubstitutionRow;
}

/** Orders an already hard-filtered pool. Source table variants can only narrow that pool. */
export function prioritizeCautionSubstitutions(
  original: Exercise,
  pool: Exercise[],
  profile: EngineProfile,
  rules: Rules,
  user: RuleValue,
): CautionSubstitution[] {
  const joints = [...new Set([...profile.cautions, ...(user.redflag_cautions ?? [])])].filter(
    joint => joint !== 'other',
  ) as Caution[];
  if (!joints.length) return pool.map(exercise => ({ exercise }));
  const core = ['anti_extension', 'anti_rotation', 'anti_lateral_flexion', 'rotation', 'trunk_flexion'].includes(
    original.primary_pattern,
  );
  const rows = joints.flatMap(joint => {
    const value = rules.get(`caution.${joint}.substitute`);
    return (
      (value.by_pattern?.[original.primary_pattern] ??
        (core ? value.by_pattern?.core : undefined) ??
        []) as SubstitutionRow[]
    ).map(row => ({ row, ruleId: `caution.${joint}.substitute` }));
  });
  const owned = new Set(
    [...ownedEquipment(profile)].map(e =>
      e === 'dumbbell' ? 'dumbbells' : e === 'pushup-handles' ? 'pushup_handles' : e,
    ),
  );
  const permitted = (row: SubstitutionRow, exercise: Exercise) => !row.unless || !condition(row.unless, exercise, user);
  const supported = (row: SubstitutionRow) =>
    !(row.requires_equipment_any && !row.requires_equipment_any.some(e => owned.has(e))) &&
    (row.cue !== 'neutral_wrist_on_handles' || owned.has('dumbbells') || owned.has('pushup_handles'));
  const choices = pool
    .filter(
      exercise => exercise.primary_pattern === original.primary_pattern && exercise.difficulty <= original.difficulty,
    )
    .flatMap(exercise => {
      const authored = rows.filter(entry => entry.row.slug === exercise.slug),
        entry = authored.find(entry => permitted(entry.row, exercise) && supported(entry.row));
      // An unavailable authored variant must not re-enter as an unannotated generic fallback.
      return authored.length && !entry
        ? []
        : [
            {
              exercise,
              ...entry,
              order: entry ? rows.indexOf(entry) : Number.MAX_SAFE_INTEGER,
            },
          ];
    });
  const lower = (e: Exercise) =>
    e.ladder.id && e.ladder.id === original.ladder.id && e.ladder.step < original.ladder.step ? 0 : 1;
  const load = (e: Exercise) => joints.reduce((sum, joint) => sum + (e.joint_load[joint] ?? 0), 0);
  const liked = (e: Exercise) => (profile.preferences.liked?.some(value => value === e.id || value === e.slug) ? 0 : 1);
  return choices.sort(
    (a, b) =>
      a.order - b.order ||
      lower(a.exercise) - lower(b.exercise) ||
      load(a.exercise) - load(b.exercise) ||
      Math.abs(a.exercise.difficulty - original.difficulty) - Math.abs(b.exercise.difficulty - original.difficulty) ||
      liked(a.exercise) - liked(b.exercise) ||
      a.exercise.id.localeCompare(b.exercise.id, 'en'),
  );
}
