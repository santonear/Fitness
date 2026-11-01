import models from '../../catalog/exercise-3d.json';
import type { BodyValues } from '../../domain/body-profile';
import { figureSex } from '../pages/plan-upgrade/logic';
import { lastFigureSex } from '../pages/plan-upgrade/prefs';

type Sex = 'male' | 'female';
export type Model3D = { target: number[]; poster: Record<Sex, string> } & Record<Sex, string>;
const byId: Record<string, Model3D> = models;

/** Exercises with an accepted 3D motion show only that motion or its poster, never RepDB or original pictures (Bo 2026-11-01). */
export const model3D = (id: string): Model3D | undefined => (Object.hasOwn(byId, id) ? byId[id] : undefined);
/** Same rule as the figure: profile sex, else the last male/female toggle, else male. */
export const modelSex = (biologicalSex: BodyValues['biologicalSex'] | undefined): Sex =>
  figureSex(biologicalSex, lastFigureSex());
export const modelUrl = (file: string) => `/models/${file}`;
