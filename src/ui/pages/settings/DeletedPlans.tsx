import { answerText } from '../../../application/preset-text';
import { isFeatureEnabled } from '../../../application/feature-flags';
import { useState } from 'react';
import { useMainline, workflow } from '../../mainline/context';
import { Button, Sheet } from '../../components/common';
import { planLifecycleCopy } from '../../../i18n/features/plan/lifecycle';
export function DeletedPlans() {
  const c = useMainline(),
    copy = planLifecycleCopy[c.locale];
  const [restored, setRestored] = useState(false);
  return (
    <section aria-labelledby="deleted-plans-title">
      <h2 id="deleted-plans-title">{copy.trash}</h2>
      <p>{copy.trashHint}</p>
      {restored && <p role="status">{copy.restored}</p>}
      {!c.data?.deletedPlans.length && <p>{copy.trashEmpty}</p>}
      {c.data?.deletedPlans.map(plan => (
        <Sheet key={plan.id}>
          <h3>{answerText(plan.name, c.locale)}</h3>
          <p>
            {copy.deletedOn}{' '}
            <time dateTime={plan.deletedAt}>
              {new Intl.DateTimeFormat(c.locale, { dateStyle: 'medium' }).format(new Date(plan.deletedAt!))}
            </time>
          </p>
          <Button
            disabled={c.busy}
            onClick={() =>
              void c.run(async () => {
                if (!isFeatureEnabled('planLifecycle')) return;
                await workflow.restorePlan(plan.id, c.data!.metadata.dataRevision);
                setRestored(true);
              })
            }
          >
            {copy.restore}
          </Button>
        </Sheet>
      ))}
    </section>
  );
}
