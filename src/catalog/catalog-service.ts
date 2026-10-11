import { catalogMetadata } from './registry';
import { DomainError } from '../domain/errors';
import type { CatalogFilters, Exercise, Locale } from '../domain/models';
import { exercises } from './exercises';

export type { ExerciseSearchFilters } from './exercise-guide';
import type { ExerciseSearchFilters } from './exercise-guide';
export function searchExercises(query: string, filters?: ExerciseSearchFilters): Exercise[];
export function searchExercises(query: string, locale: Locale, filters: CatalogFilters): Exercise[];
export function searchExercises(query: string, localeOrFilters: Locale | ExerciseSearchFilters = 'zh', legacyFilters: CatalogFilters = {}): Exercise[] {
  const locale = typeof localeOrFilters === 'string' ? localeOrFilters : 'zh';
  const filters = legacyFilters;
  const needle = query.trim().toLocaleLowerCase(locale);
  return exercises.filter((exercise) =>
    (!filters.category || exercise.category === filters.category) &&
    (!filters.equipment || exercise.equipment === filters.equipment) &&
    (!filters.metricType || exercise.metricType === filters.metricType) &&
    `${exercise.name.zh} ${exercise.name.en} ${(catalogMetadata.get(exercise.id)?.aliases ?? []).join(' ')}`.toLocaleLowerCase(locale).includes(needle),
  ).map((exercise) => structuredClone(exercise));
}

export function getExercise(id: string): Exercise {
  const exercise = exercises.find((item) => item.id === id);
  if (!exercise) throw new DomainError('INVALID', 'Unknown exercise ID');
  return structuredClone(exercise);
}

export function suggestExercises(query:string,filters?:ExerciseSearchFilters):Exercise[] { return searchExercises(query,filters).slice(0,5); }

