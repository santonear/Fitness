// Component line owns this file (UIUX20261008 V9.14). Port of docs/design/plan-upgrade/Panel.dc.html (hero / ring / twin).
import { useId, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import {
  DEFAULT_HOME_PANEL_STYLE,
  HOME_PANEL_STYLES,
  MUSCLE_GROUP_NAMES,
  NOW_MINUTES,
  type HomePanelProps,
  type HomePanelStyle,
  type MuscleGroup,
  type MuscleLoad,
  type MuscleLoadLevel,
  type NowMinutes,
} from '../../../domain/plan-upgrade';
import { Yaya } from '../Yaya';
import { AppIcon } from '../AppIcon';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { AnatomyMap, useKitLocale, type KitLocale } from './AnatomyMap';
import { Card, PrimaryButton, ProgressRing } from './primitives';
import './kit.css';

/** Panel copy (Panel.dc.html); data-aware sentences come from props (coachLine). */
export const homePanelCopy = {
  zh: {
    week: (done: number, target: number) => `本周 ${done}/${target}`,
    minutesGroup: '现在有多少时间',
    minute: (m: number) => `${m} 分钟`,
    start: '开始',
    unit: '分钟',
    groupsWeek: '本周肌群',
    fillHere: '今天补这里',
    todayTime: '今天的时间',
    reached: (n: number, total: number) => `本周 ${n} / ${total} 达标`,
    join: '与',
    list: '、',
    ring: (ok: number, low: string[], none: string[]) =>
      `本周肌群环：${ok} 个达标${low.length ? `，${low.join('、')}偏少` : ''}${none.length ? `，${none.join('、')}没练` : ''}`,
  },
  en: {
    week: (done: number, target: number) => `This week ${done}/${target}`,
    minutesGroup: 'How much time do you have now',
    minute: (m: number) => `${m} minutes`,
    start: 'Start',
    unit: 'min',
    groupsWeek: 'Muscle groups this week',
    fillHere: 'Fill in today',
    todayTime: "Today's time",
    reached: (n: number, total: number) => `${n} / ${total} on target this week`,
    join: ' & ',
    list: ', ',
    ring: (ok: number, low: string[], none: string[]) =>
      `Weekly muscle ring: ${ok} on target${low.length ? `; low: ${low.join(', ')}` : ''}${none.length ? `; not trained: ${none.join(', ')}` : ''}`,
  },
} as const;

/** The ring merges the 15 regions into the 10 arcs of the design. */
export const RING_GROUPS: readonly { key: string; label: [string, string]; groups: readonly MuscleGroup[] }[] = [
  { key: 'chest', label: ['胸', 'Chest'], groups: ['chest'] },
  { key: 'back', label: ['背', 'Back'], groups: ['lats', 'traps'] },
  { key: 'shoulders', label: ['肩', 'Delts'], groups: ['delts'] },
  { key: 'arms', label: ['臂', 'Arms'], groups: ['biceps', 'triceps', 'forearms'] },
  { key: 'core', label: ['核心', 'Core'], groups: ['abs', 'obliques'] },
  { key: 'glutes', label: ['臀', 'Glutes'], groups: ['glutes'] },
  { key: 'front-thigh', label: ['腿前', 'Quads'], groups: ['quads', 'adductors'] },
  { key: 'back-thigh', label: ['腿后', 'Hams'], groups: ['hamstrings'] },
  { key: 'calves', label: ['小腿', 'Calves'], groups: ['calves'] },
  { key: 'lowerback', label: ['下背', 'Low bk'], groups: ['lowerback'] },
];
const rank: Record<MuscleLoadLevel, number> = { none: 0, low: 1, ok: 2, high: 2 };
/** Weakest level among the arc's regions; regions without data count as not trained. */
export function ringLevel(loads: readonly MuscleLoad[], groups: readonly MuscleGroup[]): MuscleLoadLevel {
  const levels = groups.map(group => loads.find(load => load.group === group)?.level ?? 'none');
  return levels.reduce((worst, level) => (rank[level] < rank[worst] ? level : worst), levels[0] ?? 'none');
}
const reachedCount = (loads: readonly MuscleLoad[]) =>
  loads.filter(load => load.level === 'ok' || load.level === 'high').length;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};
const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, r, a0),
    [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};
/** Knob on the hero half-dial: 5′ at the left end, 45′ at the right end. */
export function heroKnob(minutes: number) {
  const t = Math.min(1, Math.max(0, (minutes - 5) / 40));
  return [165 - 140 * Math.cos(Math.PI * t), 190 - 140 * Math.sin(Math.PI * t)] as const;
}
const HERO_MARKS: Record<NowMinutes, readonly [number, number]> = {
  5: [25, 206],
  15: [60, 76],
  30: [236, 66],
  45: [305, 206],
};

/** "现在有多少时间" radiogroup shared by the three styles (hook-free, so it is testable without a DOM). */
export function MinutesGroup({
  minutes,
  onMinutes,
  locale,
}: {
  minutes: NowMinutes;
  onMinutes: (m: NowMinutes) => void;
  locale: KitLocale;
}) {
  const t = homePanelCopy[locale];
  return (
    <div className="v9-segmented" role="radiogroup" aria-label={t.minutesGroup}>
      {NOW_MINUTES.map(m => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={m === minutes}
          aria-label={t.minute(m)}
          className="v9-segment v8-press"
          onClick={() => onMinutes(m)}
        >
          {m}′
        </button>
      ))}
    </div>
  );
}

/** The style after `style`, `step` places away (wraps around). */
export const stepStyle = (style: HomePanelStyle, step: number): HomePanelStyle =>
  HOME_PANEL_STYLES[
    (HOME_PANEL_STYLES.indexOf(style) + step + HOME_PANEL_STYLES.length * 2) % HOME_PANEL_STYLES.length
  ];
/** Horizontal swipe distance (px) that switches the style; a mostly vertical move stays a page scroll. */
export const SWIPE_MIN = 40;
export const swipeStep = (dx: number, dy: number) =>
  Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : -1) : 0;

/** Text-free style knob on the panel: ‹ • • • › (aria labels only; arrow keys move between the dots). */
function StyleKnob({
  style,
  onStyle,
  locale,
}: {
  style: HomePanelStyle;
  onStyle: (style: HomePanelStyle) => void;
  locale: KitLocale;
}) {
  const c = planPagesCopy[locale];
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const next =
      event.key === 'Home'
        ? HOME_PANEL_STYLES[0]
        : event.key === 'End'
          ? HOME_PANEL_STYLES[HOME_PANEL_STYLES.length - 1]
          : step
            ? stepStyle(style, step)
            : undefined;
    if (!next) return;
    event.preventDefault();
    onStyle(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  };
  return (
    <div className="v9-home-knob-ctl">
      <button
        type="button"
        className="v9-home-knob-arrow v8-press"
        aria-label={c.panelPrev}
        onClick={() => onStyle(stepStyle(style, -1))}
      >
        <AppIcon name="back" />
      </button>
      <div className="v9-home-knob-dots" role="radiogroup" aria-label={c.panelStyle}>
        {HOME_PANEL_STYLES.map(value => (
          <button
            key={value}
            type="button"
            role="radio"
            data-value={value}
            aria-checked={value === style}
            aria-label={c.panelStyles[value]}
            tabIndex={value === style ? 0 : -1}
            className="v9-home-knob-dot"
            onClick={() => onStyle(value)}
            onKeyDown={keys}
          />
        ))}
      </div>
      <button
        type="button"
        className="v9-home-knob-arrow v8-press"
        aria-label={c.panelNext}
        onClick={() => onStyle(stepStyle(style, 1))}
      >
        <AppIcon name="next" />
      </button>
    </div>
  );
}

function FocusList({
  groups,
  locale,
  inline,
  suffix,
}: {
  groups: readonly MuscleGroup[];
  locale: KitLocale;
  inline?: boolean;
  suffix?: (group: MuscleGroup) => string;
}) {
  const lang = locale === 'en' ? 1 : 0;
  if (!groups.length) return null;
  return (
    <ul className="v9-focus-list" data-inline={inline ? 'true' : 'false'}>
      {groups.map((group, i) => (
        <li key={group} className="v9-focus-item">
          <span className="v9-badge" data-role="primary" aria-hidden="true" style={{ animationDelay: `${i * 0.8}s` }}>
            {i + 1}
          </span>
          {MUSCLE_GROUP_NAMES[group][lang]}
          {suffix?.(group)}
        </li>
      ))}
    </ul>
  );
}

export function HomePanel({
  style,
  minutes,
  onMinutes,
  onStart,
  focus,
  weekLoads,
  weekDone,
  weekTarget,
  shape,
  coachLine,
  disabled,
  locale: localeProp,
  onStyle,
}: HomePanelProps & { locale?: KitLocale; onStyle?: (style: HomePanelStyle) => void }) {
  const locale = useKitLocale(localeProp);
  const lang = locale === 'en' ? 1 : 0;
  const t = homePanelCopy[locale];
  const gradientId = `hp-${useId().replace(/[^\w-]/g, '')}`;
  const variant = style ?? DEFAULT_HOME_PANEL_STYLE;
  // Touch swipe across the panel switches the style; the tap that ends a swipe does not also press what it started on.
  const swipe = useRef<{ x: number; y: number; id: number }>(undefined),
    swipedAt = useRef(-Infinity);
  const down = (event: PointerEvent) => {
    swipe.current =
      onStyle && event.pointerType !== 'mouse' && event.isPrimary
        ? { x: event.clientX, y: event.clientY, id: event.pointerId }
        : undefined;
  };
  const up = (event: PointerEvent) => {
    const start = swipe.current;
    swipe.current = undefined;
    if (!start || start.id !== event.pointerId || !onStyle) return;
    const step = swipeStep(event.clientX - start.x, event.clientY - start.y);
    if (!step) return;
    swipedAt.current = event.timeStamp;
    onStyle(stepStyle(variant, step));
  };
  const swallowClick = (event: MouseEvent) => {
    if (event.timeStamp - swipedAt.current < 500) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const primary = focus.primary.slice(0, 2);
  const focusNames = primary.map(group => MUSCLE_GROUP_NAMES[group][lang]).join(t.join);
  const reached = reachedCount(weekLoads);
  const map = (width: number) => (
    <AnatomyMap
      width={width}
      primary={focus.primary}
      secondary={focus.secondary}
      shape={shape}
      labels={false}
      locale={locale}
    />
  );
  const actions = onStart && (
    <>
      <MinutesGroup minutes={minutes} onMinutes={onMinutes} locale={locale} />
      {/* Stays reachable above the tab bar while the panel scrolls (V9.20). */}
      <div className="v9-home-start" data-orb-avoid="">
        <PrimaryButton disabled={disabled} onClick={onStart}>
          {t.start}
        </PrimaryButton>
      </div>
    </>
  );

  let body;
  if (variant === 'ring') {
    const arcs = RING_GROUPS.map((ring, i) => ({ ...ring, level: ringLevel(weekLoads, ring.groups), i }));
    const okCount = arcs.filter(a => rank[a.level] === 2).length;
    const aria = t.ring(
      okCount,
      arcs.filter(a => a.level === 'low').map(a => a.label[lang]),
      arcs.filter(a => a.level === 'none').map(a => a.label[lang]),
    );
    body = (
      <Card variant="hero" padding="lg" className="v9-home-ring">
        <div className="v9-home-ring-dial">
          <svg viewBox="0 0 270 270" role="img" aria-label={aria}>
            {arcs.map(a => (
              <path
                key={a.key}
                className="v9-home-seg"
                data-level={a.level}
                d={arcPath(135, 135, 112, a.i * 36 + 5, a.i * 36 + 31)}
              />
            ))}
            {arcs.map(a => {
              const [x, y] = polar(135, 135, 129, a.i * 36 + 18);
              return (
                <text
                  key={a.key}
                  className="v9-home-seg-label"
                  data-hot={rank[a.level] < 2}
                  x={x.toFixed(1)}
                  y={y.toFixed(1)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  aria-hidden="true"
                >
                  {a.label[lang]}
                </text>
              );
            })}
          </svg>
          <div className="v9-home-dial-inner">
            <span className="v9-home-num">
              {minutes}
              <small>′</small>
            </span>
            <span className="v9-home-small">{t.unit}</span>
          </div>
        </div>
        <div className="v9-home-body">
          {map(150)}
          <div className="v9-home-body-text">
            <span className="v9-home-label">{t.fillHere}</span>
            <FocusList groups={primary} locale={locale} />
            {weekLoads.length > 0 && <span className="v9-home-small">{t.reached(reached, weekLoads.length)}</span>}
          </div>
        </div>
        {actions}
      </Card>
    );
  } else if (variant === 'twin') {
    body = (
      <>
        <div className="v9-home-twin">
          <Card padding="md">
            <ProgressRing value={minutes / 60} size={132} stroke={9}>
              <span className="v9-ring-time v9-num">{minutes}′</span>
            </ProgressRing>
            <span className="v9-home-small">{t.todayTime}</span>
          </Card>
          <Card padding="md">
            <div className="v9-home-twin-map">{map(114)}</div>
            <FocusList groups={primary} locale={locale} inline />
          </Card>
        </div>
        {actions}
      </>
    );
  } else {
    const [kx, ky] = heroKnob(minutes);
    body = (
      <>
        <div className="v9-home-arc">
          <svg viewBox="0 0 330 200" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" className="v9-home-from" />
                <stop offset="1" className="v9-home-to" />
              </linearGradient>
            </defs>
            <path className="v9-home-track" d="M25 190 A140 140 0 0 1 305 190" strokeWidth="3" strokeLinecap="round" />
            {minutes > 5 && (
              <path
                className="v9-home-value"
                d={`M25 190 A140 140 0 0 1 ${kx.toFixed(1)} ${ky.toFixed(1)}`}
                stroke={`url(#${gradientId})`}
                strokeWidth="6"
              />
            )}
            <circle className="v9-home-knob" cx={kx.toFixed(1)} cy={ky.toFixed(1)} r="7" />
            {NOW_MINUTES.map(m => (
              <text
                key={m}
                className="v9-home-mark"
                data-on={m === minutes}
                x={HERO_MARKS[m][0]}
                y={HERO_MARKS[m][1]}
                textAnchor="middle"
              >
                {m}
              </text>
            ))}
          </svg>
          <div className="v9-home-arc-center">
            <span className="v9-home-num">{minutes}</span>
            <span className="v9-home-small">
              {t.unit}
              {focusNames ? ` · ${focusNames}` : ''}
            </span>
          </div>
        </div>
        <Card padding="sm" className="v9-home-body">
          {map(150)}
          <div className="v9-home-body-text">
            <span className="v9-home-label">{t.groupsWeek}</span>
            {weekLoads.length > 0 && (
              <span className="v9-home-count v9-num">
                {reached}
                <small> / {weekLoads.length}</small>
              </span>
            )}
            <FocusList groups={primary} locale={locale} />
          </div>
        </Card>
        {actions}
      </>
    );
  }

  return (
    <section
      className="v9-home-panel"
      data-style={variant}
      data-swipe={onStyle ? 'true' : undefined}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={() => {
        swipe.current = undefined;
      }}
      onClickCapture={swallowClick}
    >
      <div className="v9-home-panel-head">
        {onStyle && <StyleKnob style={variant} onStyle={onStyle} locale={locale} />}
        {/* No plan, no weekly target: the count is left out rather than shown as n/0. */}
        {weekTarget > 0 && <span className="v9-home-week">{t.week(weekDone, weekTarget)}</span>}
      </div>
      {body}
      {coachLine && (
        <Card padding="sm" className="v9-home-coach">
          <Yaya pose="head" size={42} mode="disc" alt="" float={false} />
          <p>{coachLine}</p>
        </Card>
      )}
    </section>
  );
}
