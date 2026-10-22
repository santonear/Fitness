import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ENERGY_LIMITS,
  MACRO_PRESETS,
  MEALS_RANGE,
  energyTargets,
  lossBlock,
  macroTargets,
  type EnergyGoal,
  type EnergySex,
  type MacroPreset,
} from '../../../application/rules/energy';
import { bodyWeightService } from '../../../application/body-weight';
import { energyCopy } from '../../../i18n/features/me/energy';
import { fill } from '../../../i18n/features/onboarding/entry';
import { BigChoice, Card, PrimaryButton, SegmentedTabs, StatTile } from '../../components/kit';
import { useMainline } from '../../mainline/context';
import { useOptionalTheme } from '../../../themes/ThemeProvider';
import './energy.css';
import { binarySex } from '../../../domain/body-profile';

/** Calculator inputs and the last daily target stay on this device (localStorage), never sent. */
interface Saved {
  sex?: EnergySex;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  goal?: EnergyGoal;
  kcal?: number;
  preset?: MacroPreset;
  meals?: number;
}
const KEY = 'fitness.energy';
const load = (): Saved => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
};
const save = (patch: Saved) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch }));
  } catch {
    /* The page still works without storage. */
  }
};
const clamp = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, value));
const num = (value: number) => value.toLocaleString('en-US');
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Rolls a number from its last value to the new one (ease-out, 600 ms); instant with reduced motion. */
function useCountUp(target: number) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target || reducedMotion() || typeof requestAnimationFrame !== 'function') {
      from.current = target;
      setShown(target);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - began) / 600),
        eased = 1 - (1 - p) ** 3;
      const value = Math.round(start + (target - start) * eased);
      from.current = value;
      setShown(value);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

/** Decorative layers each theme paints its own way (grid, scan line, rays, sparks); hidden from screen readers. */
const Fx = () => (
  <span className="v9-energy-fx" aria-hidden="true">
    <i className="v9-energy-fx-grid" />
    <i className="v9-energy-fx-scan" />
    <i className="v9-energy-fx-glow" />
  </span>
);

const GAUGE = { c: 120, r: 92, start: 135, sweep: 270 } as const;
const polar = (ratio: number, radius: number = GAUGE.r) => {
  const a = ((GAUGE.start + GAUGE.sweep * ratio) * Math.PI) / 180;
  return [GAUGE.c + radius * Math.cos(a), GAUGE.c + radius * Math.sin(a)] as const;
};
const ARC = (() => {
  const [x0, y0] = polar(0),
    [x1, y1] = polar(1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${GAUGE.r} ${GAUGE.r} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
})();
const TICKS = Array.from({ length: 60 }, (_, i) => i);

/** 270° gauge: the target arc sweeps to its value, goal markers sit on the scale, the tick ring turns slowly. */
function EnergyDial({
  ratio,
  marks,
  children,
}: {
  ratio: number;
  marks: { key: string; ratio: number; active: boolean }[];
  children: ReactNode;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10;
  return (
    <div className="v9-energy-dial" style={{ '--dial-pct': pct } as CSSProperties}>
      <svg viewBox="0 0 240 240" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="v9-energy-meter" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" className="v9-ring-from" />
            <stop offset="1" className="v9-ring-to" />
          </linearGradient>
        </defs>
        <g className="v9-energy-ticks">
          {TICKS.map(i => (
            <line
              key={i}
              x1="120"
              y1="6"
              x2="120"
              y2={i % 5 ? 11 : 15}
              transform={`rotate(${i * 6} 120 120)`}
              data-major={i % 5 ? undefined : 'true'}
            />
          ))}
        </g>
        <circle className="v9-energy-sweep" cx="120" cy="120" r="104" />
        <path className="v9-energy-track" d={ARC} pathLength={100} />
        <path
          className="v9-energy-arc"
          d={ARC}
          pathLength={100}
          stroke="url(#v9-energy-meter)"
          strokeDasharray="100 100"
          strokeDashoffset={100 - pct}
        />
        <path className="v9-energy-notch" d={ARC} pathLength={100} />
        {marks.map(mark => {
          const [x, y] = polar(mark.ratio, GAUGE.r);
          return (
            <circle
              key={mark.key}
              className="v9-energy-mark"
              data-active={mark.active ? 'true' : undefined}
              cx={x}
              cy={y}
              r={mark.active ? 6 : 3.5}
            />
          );
        })}
        {(() => {
          const [x, y] = polar(ratio, GAUGE.r);
          return <circle className="v9-energy-head-dot" cx={x} cy={y} r="5" />;
        })()}
      </svg>
      <div className="v9-energy-dial-core">{children}</div>
    </div>
  );
}

export function Head({ title, sub }: { title: string; sub: string }) {
  const { navigate, locale } = useMainline(),
    t = energyCopy[locale];
  return (
    <header className="v9-energy-head">
      <PrimaryButton tone="text" size="sm" onClick={() => navigate('/settings')}>
        {t.back}
      </PrimaryButton>
      <h1 className="v9-display">{title}</h1>
      <p>{sub}</p>
    </header>
  );
}

/** Number box plus slider; the box accepts typing, the slider snaps to whole numbers. */
function Measure({
  label,
  unit,
  value,
  limits,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  limits: readonly [number, number];
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && raw.trim()) onChange(clamp(Math.round(parsed), limits));
    else setText(String(value));
  };
  return (
    <div className="v9-energy-measure">
      <label>
        <span>{label}</span>
        <span className="v9-energy-box">
          <input
            inputMode="numeric"
            value={text}
            aria-label={label}
            onChange={event => setText(event.target.value)}
            onBlur={event => commit(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
            }}
          />
          <small>{unit}</small>
        </span>
      </label>
      <input
        type="range"
        className="v9-energy-range"
        style={{ '--pct': `${((value - limits[0]) / (limits[1] - limits[0])) * 100}%` } as CSSProperties}
        min={limits[0]}
        max={limits[1]}
        step={1}
        value={value}
        aria-label={`${label} ${unit}`}
        onChange={event => onChange(Number(event.target.value))}
      />
    </div>
  );
}

/** 我的 › 卡路里计算器 (V9.15): no activity selector, activity comes from the plan's sessions per week. */
export function CaloriePage() {
  const { data, locale, navigate } = useMainline(),
    t = energyCopy[locale],
    look = useOptionalTheme()?.theme;
  const values = data?.profile?.bodyDetails?.values;
  const [stored] = useState(load);
  const [latestKg, setLatestKg] = useState<number>();
  useEffect(() => {
    let alive = true;
    void bodyWeightService
      .listBodyWeights()
      .then(rows => {
        const last = [...rows].sort((a, b) => a.localDate.localeCompare(b.localDate)).at(-1);
        if (alive && last) setLatestKg(Math.round(last.weightGrams / 1000));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const profileSex: EnergySex | undefined = binarySex(values?.biologicalSex);
  const [sex, setSex] = useState<EnergySex>(stored.sex ?? profileSex ?? 'unspecified');
  const [age, setAge] = useState(clamp(stored.age ?? values?.age ?? 30, ENERGY_LIMITS.age));
  const [heightCm, setHeight] = useState(clamp(stored.heightCm ?? values?.heightCm ?? 165, ENERGY_LIMITS.heightCm));
  const [weightKg, setWeight] = useState(clamp(stored.weightKg ?? values?.weightKg ?? 60, ENERGY_LIMITS.weightKg));
  // The latest logged weight wins once, unless the person already typed one here.
  useEffect(() => {
    if (latestKg && stored.weightKg === undefined) setWeight(clamp(latestKg, ENERGY_LIMITS.weightKg));
  }, [latestKg]);
  const block = lossBlock({ age, heightCm, weightKg, population: data?.state?.coachProfile?.population?.kind });
  const [chosen, setGoal] = useState<EnergyGoal>(stored.goal ?? 'maintain');
  const goal: EnergyGoal = block && chosen === 'lose' ? 'maintain' : chosen;
  const sessions = data?.version?.weeklyTarget ?? 0;
  const result = useMemo(
    () => energyTargets({ sex, age, heightCm, weightKg }, sessions, goal),
    [sex, age, heightCm, weightKg, sessions, goal],
  );
  useEffect(() => {
    save({ sex, age, heightCm, weightKg, goal, kcal: result.target });
  }, [sex, age, heightCm, weightKg, goal, result.target]);
  const goals: readonly EnergyGoal[] = ['lose', 'maintain', 'gain'];
  const weekly = result.weeklyChangeKg;
  // Scale spans resting energy to a little above the gain target so all three goals sit on the arc.
  const low = Math.round(result.resting * 0.92),
    high = Math.round(result.targets.gain * 1.06);
  const shownTarget = useCountUp(result.target);
  return (
    <main className="v9-energy" data-look={look}>
      <Head title={t.calTitle} sub={t.calSub} />
      <Card variant="hero" padding="lg" as="section" className="v9-energy-result v9-energy-hud" aria-label={t.target}>
        <p className="v9-energy-sr" aria-live="polite">{`${t.target} ${num(result.target)} ${t.kcalDay}`}</p>
        <Fx />
        <EnergyDial
          ratio={(result.target - low) / (high - low)}
          marks={goals.map(item => ({
            key: item,
            ratio: (result.targets[item] - low) / (high - low),
            active: item === goal,
          }))}
        >
          <span className="v9-energy-kicker">{t.target}</span>
          <strong className="v9-num v9-energy-big" aria-hidden="true">
            {num(shownTarget)}
          </strong>
          <span className="v9-energy-unit">{t.kcalDay}</span>
          <span className="v9-energy-tag">{t.estimate}</span>
        </EnergyDial>
        <div className="v9-energy-stats">
          <StatTile label={t.resting} value={num(result.resting)} unit={<small>kcal</small>} />
          <StatTile label={t.maintenance} value={num(result.maintenance)} unit={<small>kcal</small>} emphasis />
          <StatTile
            label={t.weekly}
            value={`${weekly > 0 ? '+' : ''}${weekly.toFixed(weekly ? 2 : 0)}`}
            unit={<small>{t.kg}</small>}
          />
        </div>
        <div className="v9-energy-goals" role="radiogroup" aria-label={t.goal}>
          {goals.map(item => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={goal === item}
              disabled={item === 'lose' && !!block}
              className="v9-energy-goal v8-press"
              onClick={() => setGoal(item)}
            >
              <span>{t[item]}</span>
              <span className="v9-num">{num(result.targets[item])}</span>
            </button>
          ))}
        </div>
        {block && (
          <p className="v9-energy-care" role="note">
            {t.block[block]}
          </p>
        )}
      </Card>
      <Card variant="raised" padding="lg" as="section" className="v9-energy-form" aria-label={t.sex}>
        <div className="v9-energy-field">
          <span>{t.sex}</span>
          <SegmentedTabs
            label={t.sex}
            value={sex}
            onChange={value => setSex(value as EnergySex)}
            options={[
              { value: 'male', label: t.male },
              { value: 'female', label: t.female },
              { value: 'unspecified', label: t.unspecified },
            ]}
          />
        </div>
        <Measure label={t.age} unit={t.years} value={age} limits={ENERGY_LIMITS.age} onChange={setAge} />
        <Measure label={t.height} unit={t.cm} value={heightCm} limits={ENERGY_LIMITS.heightCm} onChange={setHeight} />
        <Measure label={t.weight} unit={t.kg} value={weightKg} limits={ENERGY_LIMITS.weightKg} onChange={setWeight} />
      </Card>
      <p className="v9-energy-note">
        {sessions ? fill(t.activity, { count: sessions }) : t.noPlan} {t.method}
      </p>
      <p className="v9-energy-note">{t.local}</p>
      <PrimaryButton
        block
        onClick={() => {
          save({ kcal: result.target });
          navigate('/settings/macros');
        }}
      >
        {t.toMacro}
      </PrimaryButton>
    </main>
  );
}

function MacroBar({
  label,
  line,
  unit,
  tone,
}: {
  label: string;
  line: { grams: number; kcal: number; percent: number };
  unit: string;
  tone: 1 | 2 | 3;
}) {
  const grams = useCountUp(line.grams);
  return (
    <li className="v9-energy-macro" data-tone={tone}>
      <div className="v9-energy-macro-line">
        <span>
          <i className="v9-energy-swatch" aria-hidden="true" />
          {label}
        </span>
        <span>
          <strong className="v9-num">{grams}</strong> {unit} · {num(line.kcal)} kcal · <b>{line.percent}%</b>
        </span>
      </div>
      <span className="v9-energy-bar" aria-hidden="true">
        <i style={{ inlineSize: `${line.percent}%` }} />
      </span>
    </li>
  );
}

/** Three-part ring: each macro's share of the day, segments slide when the split changes. */
function MacroDonut({ shares, children }: { shares: readonly number[]; children: ReactNode }) {
  let offset = 0;
  return (
    <div className="v9-energy-donut">
      <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <g className="v9-energy-ticks">
          {TICKS.map(i => (
            <line
              key={i}
              x1="100"
              y1="4"
              x2="100"
              y2={i % 5 ? 8 : 12}
              transform={`rotate(${i * 6} 100 100)`}
              data-major={i % 5 ? undefined : 'true'}
            />
          ))}
        </g>
        <circle className="v9-energy-track" cx="100" cy="100" r="76" pathLength={100} />
        {shares.map((share, i) => {
          const gap = 1.2,
            dash = Math.max(0, share - gap),
            start = offset;
          offset += share;
          return (
            <circle
              key={i}
              className="v9-energy-seg"
              data-tone={i + 1}
              cx="100"
              cy="100"
              r="76"
              pathLength={100}
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={-start - gap / 2}
              transform="rotate(-90 100 100)"
            />
          );
        })}
        <circle className="v9-energy-sweep" cx="100" cy="100" r="88" />
      </svg>
      <div className="v9-energy-dial-core">{children}</div>
    </div>
  );
}

/** 我的 › 宏量营养计算器 (V9.15): daily calories carry over from the calorie calculator; no copy or share. */
export function MacroPage() {
  const { locale, navigate } = useMainline(),
    t = energyCopy[locale],
    look = useOptionalTheme()?.theme;
  const [stored] = useState(load);
  const [kcal, setKcal] = useState(stored.kcal);
  const [text, setText] = useState(stored.kcal ? String(stored.kcal) : '');
  const [preset, setPreset] = useState<MacroPreset>(
    stored.preset && stored.preset in MACRO_PRESETS ? stored.preset : 'balanced',
  );
  const [meals, setMeals] = useState(clamp(stored.meals ?? 3, MEALS_RANGE));
  const [error, setError] = useState('');
  useEffect(() => {
    save({ preset, meals, ...(kcal ? { kcal } : {}) });
  }, [preset, meals, kcal]);
  const commit = (raw: string) => {
    const value = Math.round(Number(raw.replace(/,/g, '')));
    if (Number.isFinite(value) && value >= 800 && value <= 6000) {
      setKcal(value);
      setError('');
    } else setError(t.kcalInvalid);
  };
  const result = kcal ? macroTargets(kcal, preset, meals) : undefined;
  const presets = Object.keys(MACRO_PRESETS) as MacroPreset[];
  let hint: ReactNode = stored.kcal ? (
    t.fromCal
  ) : (
    <>
      {t.noCal}{' '}
      <PrimaryButton tone="text" size="sm" onClick={() => navigate('/settings/calories')}>
        {t.goCal}
      </PrimaryButton>
    </>
  );
  if (error)
    hint = (
      <span className="v9-energy-error" role="alert">
        {error}
      </span>
    );
  return (
    <main className="v9-energy" data-look={look}>
      <Head title={t.macroTitle} sub={t.macroSub} />
      <Card variant="raised" padding="lg" as="section" className="v9-energy-form" aria-label={t.daily}>
        <label className="v9-energy-field">
          <span>{t.daily}</span>
          <span className="v9-energy-box v9-energy-box-wide">
            <input
              inputMode="numeric"
              value={text}
              aria-label={t.daily}
              onChange={event => setText(event.target.value)}
              onBlur={event => commit(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
              }}
            />
            <small>kcal</small>
          </span>
        </label>
        <p className="v9-energy-hint">{hint}</p>
        <div className="v9-energy-field" role="radiogroup" aria-label={t.split}>
          <span>{t.split}</span>
          {presets.map(item => (
            <BigChoice
              key={item}
              selected={preset === item}
              onClick={() => setPreset(item)}
              label={t.presets[item]}
              description={`${t.presetHint[item]} · ${MACRO_PRESETS[item].join(' / ')}`}
            />
          ))}
        </div>
        <div className="v9-energy-field">
          <span id="v9-energy-meals">{t.meals}</span>
          <div className="v9-energy-stepper" role="group" aria-labelledby="v9-energy-meals">
            <button
              type="button"
              className="v8-press"
              aria-label={t.mealsMinus}
              disabled={meals <= MEALS_RANGE[0]}
              onClick={() => setMeals(meals - 1)}
            >
              −
            </button>
            <output className="v9-num" aria-live="polite">
              {meals}
            </output>
            <button
              type="button"
              className="v8-press"
              aria-label={t.mealsPlus}
              disabled={meals >= MEALS_RANGE[1]}
              onClick={() => setMeals(meals + 1)}
            >
              +
            </button>
          </div>
        </div>
      </Card>
      {result && kcal && (
        <Card variant="hero" padding="lg" as="section" className="v9-energy-result v9-energy-hud" aria-label={t.daily}>
          <Fx />
          <MacroDonut shares={[result.carbs.percent, result.protein.percent, result.fat.percent]}>
            <span className="v9-energy-kicker">{t.daily}</span>
            <strong className="v9-num v9-energy-big" data-size="md">
              {num(kcal)}
            </strong>
            <span className="v9-energy-unit">kcal</span>
            <span className="v9-energy-tag">{t.estimate}</span>
          </MacroDonut>
          <ul className="v9-energy-macros">
            <MacroBar label={t.carbs} line={result.carbs} unit={t.grams} tone={1} />
            <MacroBar label={t.protein} line={result.protein} unit={t.grams} tone={2} />
            <MacroBar label={t.fat} line={result.fat} unit={t.grams} tone={3} />
          </ul>
          <h2 className="v9-energy-kicker">{t.perMeal}</h2>
          <div className="v9-energy-stats">
            <StatTile label={t.carbs} value={result.perMeal.carbs} unit={<small>{t.grams}</small>} />
            <StatTile label={t.protein} value={result.perMeal.protein} unit={<small>{t.grams}</small>} />
            <StatTile label={t.fat} value={result.perMeal.fat} unit={<small>{t.grams}</small>} />
          </div>
        </Card>
      )}
      <p className="v9-energy-note">{t.macroNote}</p>
      <p className="v9-energy-note">{t.local}</p>
    </main>
  );
}
