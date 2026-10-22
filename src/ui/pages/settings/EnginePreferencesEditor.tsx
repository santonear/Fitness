import { useState } from 'react';
import { exercises } from '../../../catalog/exercises';
import { engineCopy } from '../../../coach/engine-copy';
import type { EngineProfileFields } from '../../../application/engine-profile';
import zh from '../../../i18n/features/manual/zh.json';
import en from '../../../i18n/features/manual/en.json';

export function EnginePreferencesEditor({
  value,
  onChange,
  locale,
}: {
  value: EngineProfileFields;
  onChange: (value: EngineProfileFields) => void;
  locale: 'zh' | 'en';
}) {
  const [search, setSearch] = useState(''),
    preferences = value.preferences ?? { excludedExerciseIds: [], cannotDo: [] },
    copy = locale === 'zh' ? zh : en;
  const labels = {
    walking_carry: locale === 'zh' ? '以后不安排负重行走' : 'Avoid walking carries',
    jumping: locale === 'zh' ? '避免跳跃' : 'Avoid jumping',
    floor_work: engineCopy('preferences.copy.avoid_floor_work', locale),
    overhead: engineCopy('preferences.copy.avoid_overhead', locale),
    kneeling: engineCopy('preferences.copy.avoid_kneeling', locale),
  };
  const query = search.trim().toLocaleLowerCase();
  const matches = query
    ? exercises
        .filter(item => Object.values(item.name).some(name => name.toLocaleLowerCase().includes(query)))
        .slice(0, 60)
    : [];
  const rows = exercises.filter(item => preferences.excludedExerciseIds.includes(item.id) || matches.includes(item));
  return (
    <section>
      <fieldset>
        {(Object.keys(labels) as (keyof typeof labels)[]).map(key => (
          <label key={key}>
            <input
              type="checkbox"
              checked={preferences.cannotDo.includes(key)}
              onChange={event =>
                onChange({
                  ...value,
                  preferences: {
                    ...preferences,
                    cannotDo: event.target.checked
                      ? [...preferences.cannotDo, key]
                      : preferences.cannotDo.filter(item => item !== key),
                  },
                })
              }
            />
            {labels[key]}
          </label>
        ))}
      </fieldset>
      <label>
        {copy.search}
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
      </label>
      {rows.map(item => (
        <label key={item.id}>
          <input
            type="checkbox"
            checked={preferences.excludedExerciseIds.includes(item.id)}
            onChange={event =>
              onChange({
                ...value,
                preferences: {
                  ...preferences,
                  excludedExerciseIds: event.target.checked
                    ? [...preferences.excludedExerciseIds, item.id]
                    : preferences.excludedExerciseIds.filter(id => id !== item.id),
                },
              })
            }
          />
          {locale === 'zh' ? '以后不安排' : 'Avoid'} {item.name[locale]}
        </label>
      ))}
    </section>
  );
}
