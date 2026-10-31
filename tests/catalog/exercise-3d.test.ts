import { expect, it } from 'vitest';
import models from '../../src/catalog/exercise-3d.json';
import { getExerciseGuide } from '../../src/catalog/exercise-guide';
import { isHiddenExercise } from '../../src/catalog/merged-exercises';

it('wires 3D motions only to visible catalogue exercises, by names the model route accepts', () => {
  for (const [id, model] of Object.entries(models)) {
    expect(isHiddenExercise(id)).toBe(false);
    expect(getExerciseGuide(id, 'zh').name).not.toBe(id);
    for (const sex of ['male', 'female'] as const)
      expect(model[sex]).toMatch(new RegExp(`^[a-z0-9-]+_${sex}\.[0-9a-f]{8}\.glb$`));
  }
});
