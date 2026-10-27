import type { EnginePrescription } from './contracts';

/** Source positions of the yoga day template (week.day.yoga) all start with this prefix. */
export const YOGA_POSITION_PREFIX = 'yoga_';

/** A yoga session is built by its own sequence; generic refill, trimming and swaps leave it alone. */
export function isYogaSession(template: { items: { prescription?: Pick<EnginePrescription, 'sourcePosition'> }[] }) {
  return (
    template.items.length > 0 &&
    template.items.every(item => item.prescription?.sourcePosition?.startsWith(YOGA_POSITION_PREFIX))
  );
}
