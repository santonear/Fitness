import { useState } from 'react';
import { TEXT_LIMITS, textIssue } from '../../../domain/input-guard';
import { FieldIssue } from '../../components/common/FieldIssue';
import { BigChoice, Card, ChoiceChip, PrimaryButton } from '../../components/kit';
import { ROUTES, type FitnessTestItem, type FitnessTestRecord, type FutureLetter, type Route } from '../../../domain/plan-upgrade';
import { addFitnessTest, markLetterOpened, saveFutureLetter, saveJourneyVersion } from '../../../persistence/plan-upgrade-store';
import { bodyAge } from '../../../application/rules/plan-upgrade';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { fillLine, yayaV5 } from '../../../i18n/features/coach/yaya-v5';
import { parseTestValue, suggestedRoute, TEST_RANGES, testItemsFor, testValueText } from './logic';

type Locale = 'zh' | 'en';

/** 初见三问 (v5 §3) + three routes; postpartum reuses the existing postpartum safety check first. */
export function MeetFlow({ locale, busy, postpartumChecked, onCheck, onSaved }: { locale: Locale; busy: boolean; postpartumChecked: boolean; onCheck: () => void; onSaved: () => void }) {
  const c = planPagesCopy[locale], y = yayaV5[locale];
  const [step, setStep] = useState(0);
  const [why, setWhy] = useState<number>();
  const [change, setChange] = useState('');
  const [before, setBefore] = useState<number>();
  const [route, setRoute] = useState<Route>('health');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const destination = change.trim() || (why !== undefined ? y.meetWhyOptions[why] : '') || c.routes[route];
      await saveJourneyVersion({ route, destination, camps: [] });
      onSaved();
    } finally { setSaving(false); }
  };
  const blocked = route === 'postpartum' && !postpartumChecked;
  const changeIssue = textIssue(change, TEXT_LIMITS.short);
  return <Card variant="raised" padding="md" as="section" className="pu-card" aria-labelledby="pu-meet">
    <h2 id="pu-meet">{c.meetTitle}</h2>
    <p className="pu-line">{y.meetIntro}</p>
    {step === 0 && <><p>{y.meetWhy}</p><div className="pu-row">{y.meetWhyOptions.map((label, index) => <ChoiceChip key={label} selected={why === index} onClick={() => { setWhy(index); setRoute(suggestedRoute(index)); }}>{label}</ChoiceChip>)}</div></>}
    {step === 1 && <label className="pu-field"><span>{y.meetChange}</span><input value={change} maxLength={TEXT_LIMITS.short} placeholder={c.yourWords} aria-invalid={changeIssue ? true : undefined} onChange={event => setChange(event.target.value)}/><FieldIssue issue={changeIssue} locale={locale} max={TEXT_LIMITS.short}/></label>}
    {step === 2 && <><p>{y.meetBefore}</p><div className="pu-row">{y.meetBeforeOptions.map((label, index) => <ChoiceChip key={label} selected={before === index} onClick={() => setBefore(index)}>{label}</ChoiceChip>)}</div></>}
    {step === 3 && <div role="radiogroup" aria-label={c.routeLabel} className="pu-card">
      {ROUTES.map(value => <BigChoice key={value} selected={route === value} label={c.routes[value]} onClick={() => setRoute(value)}/>)}
      {route === 'postpartum' && !postpartumChecked && <p className="pu-line">{c.postpartumCheck} <PrimaryButton tone="text" size="sm" onClick={onCheck}>{c.postpartumCheckGo}</PrimaryButton></p>}
    </div>}
    {step < 3
      ? <PrimaryButton disabled={(step === 0 && why === undefined) || !!changeIssue} onClick={() => setStep(step + 1)}>{c.next}</PrimaryButton>
      : <PrimaryButton disabled={busy || saving || blocked || !!changeIssue} onClick={() => void save()}>{c.meetSave}</PrimaryButton>}
  </Card>;
}

/** 体能小测 (v5 §10): home items of the 2023 national standard; 60+ adds the chair stand. Body age is labelled 估算. */
export function FitnessTestCard({ locale, today, age, sex, tests, onSaved }: { locale: Locale; today: string; age?: number; sex?: 'male' | 'female'; tests: readonly FitnessTestRecord[]; onSaved: () => void }) {
  const c = planPagesCopy[locale], y = yayaV5[locale];
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Partial<Record<FitnessTestItem, string>>>({});
  const items = testItemsFor(age);
  const latest = [...tests].sort((a, b) => a.localDate.localeCompare(b.localDate)).at(-1);
  const previous = [...tests].sort((a, b) => a.localDate.localeCompare(b.localDate)).at(-2);
  const estimate = latest && sex && age !== undefined ? bodyAge(sex, age, latest.results) : undefined;
  const improved = latest && previous ? items.find(item => (latest.results[item] ?? 0) > (previous.results[item] ?? Infinity)) : undefined;
  const line = estimate
    ? improved && latest && previous && age !== undefined && estimate.years < age
      ? fillLine(y.testUp, { item: c.testItems[improved].replace(/（.*）|\s*\(.*\)/, ''), from: testValueText(improved, previous.results[improved]!, locale), to: testValueText(improved, latest.results[improved]!, locale), age: estimate.years, younger: age - estimate.years })
      : fillLine(y.testAge, { age: estimate.years })
    : undefined;
  const parsed = items.map(item => parseTestValue(item, values[item])), canSave = parsed.some(value => typeof value === 'number') && !parsed.includes('invalid');
  const save = async () => {
    const results: Partial<Record<FitnessTestItem, number>> = {};
    for (const item of items) { const value = parseTestValue(item, values[item]); if (value === 'invalid') return; if (value !== undefined) results[item] = value; }
    if (!Object.keys(results).length) return;
    await addFitnessTest({ localDate: today, results });
    setOpen(false); setValues({}); onSaved();
  };
  return <Card variant="raised" padding="md" as="section" className="pu-card" aria-labelledby="pu-test">
    <h2 id="pu-test">{c.testTitle}</h2>
    {estimate && <div className="pu-age"><span>{c.bodyAge}</span><strong className="v9-num">{fillLine(c.years, { years: estimate.years })}</strong><small>{c.estimated}</small></div>}
    {line && <p className="pu-line">{line}</p>}
    {!open ? <><p className="pu-line">{y.testAsk}</p><PrimaryButton tone="quiet" size="sm" onClick={() => setOpen(true)}>{y.testNow}</PrimaryButton></>
      : <>{items.map(item => <label key={item} className="pu-field"><span>{c.testItems[item]}</span><input inputMode="decimal" maxLength={5} value={values[item] ?? ''} aria-invalid={parseTestValue(item, values[item]) === 'invalid' ? true : undefined} onChange={event => setValues({ ...values, [item]: event.target.value })}/>{parseTestValue(item, values[item]) === 'invalid' && <small role="alert">{fillLine(c.testInvalid, { min: TEST_RANGES[item][0], max: TEST_RANGES[item][1] })}</small>}</label>)}
        <div className="pu-row"><PrimaryButton size="sm" disabled={!canSave} onClick={() => void save()}>{c.testSave}</PrimaryButton><PrimaryButton tone="quiet" size="sm" onClick={() => setOpen(false)}>{y.testLater}</PrimaryButton></div></>}
  </Card>;
}

/** 给未来的自己 (v5 §12): written now, opened at a camp. */
export function LetterCard({ locale, openable, nextCampId, onSaved }: { locale: Locale; openable: readonly FutureLetter[]; nextCampId?: string; onSaved: () => void }) {
  const c = planPagesCopy[locale], y = yayaV5[locale];
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [shown, setShown] = useState<FutureLetter>();
  const letter = openable[0], issue = textIssue(text, TEXT_LIMITS.long);
  return <Card variant="raised" padding="md" as="section" className="pu-card" aria-labelledby="pu-letter">
    <h2 id="pu-letter">{c.letterTitle}</h2>
    {shown ? <><p className="pu-line">{y.letterOpen}</p><p className="pu-letter">{shown.text}</p></>
      : letter ? <><p className="pu-line">{y.letterOpen}</p><PrimaryButton tone="quiet" size="sm" onClick={() => void markLetterOpened(letter.id).then(() => { setShown(letter); onSaved(); })}>{c.letterOpenButton}</PrimaryButton></>
        : saved ? <p className="pu-line" role="status">{c.letterSaved}</p>
          : <><p className="pu-line">{y.letterAsk}</p>
            <label className="pu-field"><textarea aria-label={c.letterPlaceholder} rows={3} maxLength={TEXT_LIMITS.long} placeholder={c.letterPlaceholder} value={text} aria-invalid={issue ? true : undefined} onChange={event => setText(event.target.value)}/><FieldIssue issue={issue} locale={locale} max={TEXT_LIMITS.long}/></label>
            <PrimaryButton size="sm" disabled={!text.trim() || !!issue} onClick={() => void saveFutureLetter(text.trim(), nextCampId).then(() => { setSaved(true); setText(''); onSaved(); })}>{c.letterSave}</PrimaryButton></>}
  </Card>;
}
