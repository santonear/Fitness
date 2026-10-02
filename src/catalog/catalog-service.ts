import { DomainError } from '../domain/errors';
import type { CatalogFilters, Exercise, Locale } from '../domain/models';
import { exercises } from './exercises';

export function searchExercises(query: string, locale: Locale, filters: CatalogFilters): Exercise[] {
  const needle = query.trim().toLocaleLowerCase(locale);
  return exercises.filter((exercise) =>
    (!filters.category || exercise.category === filters.category) &&
    (!filters.equipment || exercise.equipment === filters.equipment) &&
    (!filters.metricType || exercise.metricType === filters.metricType) &&
    `${exercise.name.zh} ${exercise.name.en}`.toLocaleLowerCase(locale).includes(needle),
  ).map((exercise) => structuredClone(exercise));
}

export function getExercise(id: string): Exercise {
  const exercise = exercises.find((item) => item.id === id);
  if (!exercise) throw new DomainError('INVALID', 'Unknown exercise ID');
  return structuredClone(exercise);
}
