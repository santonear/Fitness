import { useState } from 'react';
import { Card, PrimaryButton } from '../../components/kit';
import type { FitnessTestItem, FitnessTestRecord } from '../../../domain/plan-upgrade';
import { addFitnessTest } from '../../../persistence/plan-upgrade-store';
import { bodyAge } from '../../../application/rules/plan-upgrade';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { fillLine, yayaV5 } from '../../../i18n/features/coach/yaya-v5';
import { parseTestValue, steadyTestLines, TEST_RANGES, testItemsFor, testValueText } from './logic';

type Locale = 'zh' | 'en';

/** 体能自测 (v5 §10): home items of the 2023 national standard; 60+ adds the chair stand. Body age is labelled 估算. */
export function FitnessTestCard({
  locale,
  today,
  age,
  sex,
  steady = false,
  tests,
  onSaved,
}: {
  locale: Locale;
  today: string;
  age?: number;
  sex?: 'male' | 'female';
  /** 稳健 route: the 60+ items and its progress lines. */
  steady?: boolean;
  tests: readonly FitnessTestRecord[];
  onSaved: () => void;
}) {
  const c = planPagesCopy[locale],
    y = yayaV5[locale];
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Partial<Record<FitnessTestItem, string>>>({});
  const items = testItemsFor(age, steady);
  const byDate = [...tests].sort((a, b) => a.localDate.localeCompare(b.localDate)),
    latest = byDate.at(-1),
    previous = byDate.at(-2);
  const estimate = latest && sex && age !== undefined ? bodyAge(sex, age, latest.results) : undefined;
  const improved =
    latest && previous
      ? items.find(item => (latest.results[item] ?? 0) > (previous.results[item] ?? Infinity))
      : undefined;
  const line = estimate
    ? improved && latest && previous && age !== undefined && estimate.years < age
      ? fillLine(y.testUp, {
          item: c.testItems[improved].replace(/（.*）|\s*\(.*\)/, ''),
          from: testValueText(improved, previous.results[improved]!, locale),
          to: testValueText(improved, latest.results[improved]!, locale),
          age: estimate.years,
          younger: age - estimate.years,
        })
      : fillLine(y.testAge, { age: estimate.years })
    : undefined;
  const parsed = items.map(item => parseTestValue(item, values[item])),
    canSave = parsed.some(value => typeof value === 'number') && !parsed.includes('invalid');
  const save = async () => {
    const results: Partial<Record<FitnessTestItem, number>> = {};
    for (const item of items) {
      const value = parseTestValue(item, values[item]);
      if (value === 'invalid') return;
      if (value !== undefined) results[item] = value;
    }
    if (!Object.keys(results).length) return;
    await addFitnessTest({ localDate: today, results });
    setOpen(false);
    setValues({});
    onSaved();
  };
  return (
    <Card variant="raised" padding="md" as="section" className="pu-card" aria-labelledby="pu-test">
      <h2 id="pu-test">{c.testTitle}</h2>
      {estimate && (
        <div className="pu-age">
          <span>{c.bodyAge}</span>
          <strong className="v9-num">{fillLine(c.years, { years: estimate.years })}</strong>
          <small>{c.estimated}</small>
        </div>
      )}
      {line && <p className="pu-line">{line}</p>}
      {steady &&
        steadyTestLines(tests, locale).map(text => (
          <p key={text} className="pu-line">
            {text}
          </p>
        ))}
      {!open ? (
        <>
          <p className="pu-line">{y.testAsk}</p>
          <PrimaryButton tone="quiet" size="sm" onClick={() => setOpen(true)}>
            {y.testNow}
          </PrimaryButton>
        </>
      ) : (
        <>
          {items.map(item => (
            <label key={item} className="pu-field">
              <span>{c.testItems[item]}</span>
              <input
                inputMode="decimal"
                maxLength={5}
                value={values[item] ?? ''}
                aria-invalid={parseTestValue(item, values[item]) === 'invalid' ? true : undefined}
                onChange={event => setValues({ ...values, [item]: event.target.value })}
              />
              {parseTestValue(item, values[item]) === 'invalid' && (
                <small role="alert">
                  {fillLine(c.testInvalid, { min: TEST_RANGES[item][0], max: TEST_RANGES[item][1] })}
                </small>
              )}
            </label>
          ))}
          <div className="pu-row">
            <PrimaryButton size="sm" disabled={!canSave} onClick={() => void save()}>
              {c.testSave}
            </PrimaryButton>
            <PrimaryButton tone="quiet" size="sm" onClick={() => setOpen(false)}>
              {y.testLater}
            </PrimaryButton>
          </div>
        </>
      )}
    </Card>
  );
}
