import { describe, expect, it } from 'vitest';
import registry from '../../src/catalog/generated/registry.json' with { type: 'json' };
import customCatalog from '../../src/catalog/custom-exercises.json' with { type: 'json' };
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_NAMES,
  muscleGroupOf,
  DEFAULT_HOME_PANEL_STYLE,
} from '../../src/domain/plan-upgrade';

type Row = { primaryMuscles?: string[]; secondaryMuscles?: string[] };

describe('plan upgrade contracts, UIUX20261008 V9.14', () => {
  it('maps every catalog muscle id to one of the 15 drawn regions', () => {
    const ids = new Set<string>();
    for (const row of [...(registry as Row[]), ...(customCatalog as Row[])])
      for (const id of [...(row.primaryMuscles ?? []), ...(row.secondaryMuscles ?? [])]) ids.add(id);
    const unmapped = [...ids].filter(id => !muscleGroupOf(id));
    expect(unmapped).toEqual([]);
  });
  it('names every region in both languages', () => {
    expect(MUSCLE_GROUPS).toHaveLength(15);
    for (const group of MUSCLE_GROUPS) expect(MUSCLE_GROUP_NAMES[group].every(Boolean)).toBe(true);
  });
  it('defaults the home panel to the big-number style', () => {
    expect(DEFAULT_HOME_PANEL_STYLE).toBe('hero');
  });
});
