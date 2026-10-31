import data from './merged-exercises.json' with { type: 'json' };

/** Hidden duplicate → the exercise that replaces it in every new choice. */
export const mergedInto: ReadonlyMap<string, string> = new Map(data.merged.map(row => [row.hidden, row.kept]));
export const isHiddenExercise = (id: string) => mergedInto.has(id);
/** The ID to use for a new choice; old IDs stay readable everywhere else. */
export const keptExerciseId = (id: string) => mergedInto.get(id) ?? id;
