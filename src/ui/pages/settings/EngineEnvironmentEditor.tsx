import { hasHouseholdSupport } from '../../../engine/equipment';
import type { EngineCoachProfile } from '../../../application/engine-profile';
import { equipmentItemSchema } from '../../../engine/contracts';
import { equipmentLabel } from '../../../catalog/taxonomy';
import zh from '../../../i18n/features/coach/zh.json';
import en from '../../../i18n/features/coach/en.json';
export function EngineEnvironmentEditor({
  value,
  onChange,
  locale,
}: {
  value: EngineCoachProfile;
  onChange: (value: EngineCoachProfile) => void;
  locale: 'zh' | 'en';
}) {
  const copy = locale === 'zh' ? zh : en;
  return (
    <section id="environment">
      <label>
        <input
          type="checkbox"
          checked={hasHouseholdSupport(value)}
          onChange={event => onChange({ ...value, householdSupport: event.target.checked })}
        />
        {locale === 'zh' ? '家里有可扶的墙或椅子' : 'A wall or chair to hold on to at home'}
      </label>
      <label>
        {copy.detailLabels.place}
        <select
          value={value.place}
          onChange={event => onChange({ ...value, place: event.target.value as EngineCoachProfile['place'] })}
        >
          {(['home', 'gym', 'outdoor', 'mixed'] as const).map(place => (
            <option key={place} value={place}>
              {copy.values[place]}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>{copy.detailLabels.equipment}</summary>
        {equipmentItemSchema.options.map(equipment => (
          <label key={equipment}>
            <input
              type="checkbox"
              checked={value.equipment.includes(equipment)}
              onChange={event =>
                onChange({
                  ...value,
                  equipment: event.target.checked
                    ? [...value.equipment, equipment]
                    : value.equipment.filter(item => item !== equipment),
                })
              }
            />
            {equipmentLabel(equipment, locale)}
          </label>
        ))}
      </details>
    </section>
  );
}
