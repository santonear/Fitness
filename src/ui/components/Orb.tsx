import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { orbContextCopy, orbCopy, type OrbContextId } from '../../i18n/features/coach/orb';
import { Yaya } from './Yaya';
import './orb.css';

export type OrbContext = OrbContextId;
export interface OrbAction { label: string; /** Text placed in the chat composer; defaults to the label. */ prompt?: string }
export interface OrbProps {
  locale?: 'zh' | 'en';
  /** Picks the design's default tip and quick actions. */
  context?: OrbContext;
  tip?: string;
  actions?: readonly OrbAction[];
  /** Quick action: open the existing assistant chat with this prompt ready to send. */
  onAction: (prompt: string) => void;
  onOpenChat: () => void;
  /** Training and onboarding: start tucked at the edge without a tip. */
  autoTuck?: boolean;
  /** Elements the orb must never cover; it tucks or moves away from them. */
  avoidSelector?: string;
}

export const orbContexts = orbContextCopy;
const defaultAvoid = '[data-orb-avoid], .v9-btn[data-tone="primary"], .v9-btn[data-size="lg"], .v8-button-primary, .v8-shell > nav';
const gap = 8;
/** Other controls are never covered by the full orb: it tucks to the edge while one is underneath, and the tip hides. */
const controlSelector = 'button, a[href], input, select, textarea, summary, [role="button"], [role="radio"], [role="switch"], [role="tab"]';
/** Position survives route changes within the session. */
const memory: { y?: number; side: 'left' | 'right' } = { side: 'right' };

function bounds() {
  const style = getComputedStyle(document.documentElement);
  const size = parseFloat(style.getPropertyValue('--orb-size')) || 68;
  const safe = parseFloat(style.getPropertyValue('--orb-safe')) || 92;
  const height = window.innerHeight;
  return { size, min: Math.min(safe, height / 4), max: Math.max(safe, height - size - safe), width: window.innerWidth };
}
const overlaps = (a: { left: number; top: number; right: number; bottom: number }, b: DOMRect) =>
  a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

/** 芽芽 floating assistant (docs/design/v9/Orb.dc.html): drag vertically, snap left/right, tuck, tip and quick panel. */
export function Orb({ locale = 'zh', context = 'other', tip, actions, onAction, onOpenChat, autoTuck = false, avoidSelector = defaultAvoid }: OrbProps) {
  const t = orbCopy[locale];
  const defaults = orbContextCopy[locale][context];
  const tipText = tip ?? defaults.tip;
  const list: readonly OrbAction[] = actions ?? defaults.actions.map(label => ({ label }));
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [y, setY] = useState<number | undefined>(memory.y);
  const [side, setSide] = useState(memory.side);
  const [open, setOpen] = useState(false);
  const [tucked, setTucked] = useState(autoTuck);
  const [tipClosed, setTipClosed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [avoid, setAvoid] = useState<{ tuck: boolean; y?: number; tipBlocked?: boolean }>({ tuck: false });

  useEffect(() => { setTucked(autoTuck); setOpen(false); setTipClosed(false); }, [autoTuck, context]);
  useLayoutEffect(() => {
    if (y !== undefined) return;
    const b = bounds();
    setY(Math.min(b.max, Math.max(b.min, Math.round(window.innerHeight * .66))));
  }, [y]);
  useEffect(() => { memory.y = y; memory.side = side; }, [y, side]);

  // Never cover primary actions: compute the untucked rectangle, tuck when it overlaps, and slide clear if needed.
  const check = useCallback(() => {
    if (y === undefined || drag.current) return;
    const b = bounds();
    const left = side === 'right' ? b.width - 12 - b.size : 12;
    const home = { left, right: left + b.size, top: y, bottom: y + b.size };
    const shift = b.size * .68 * (side === 'right' ? 1 : -1);
    const tipWidth = Math.min(210, b.width - b.size - 48);
    const tip = side === 'right'
      ? { left: home.left - 10 - tipWidth, right: home.left - 10, top: home.bottom - 80, bottom: home.bottom - 16 }
      : { left: home.right + 10, right: home.right + 10 + tipWidth, top: home.bottom - 80, bottom: home.bottom - 16 };
    const rects = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)]
      .filter(element => !element.closest('.v9-orb'))
      .map(element => element.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight);
    const primaries = rects(avoidSelector), controls = rects(controlSelector);
    const touches = (area: typeof home, rect: DOMRect, margin: number) => area.left < rect.right + margin && area.right > rect.left - margin && area.top < rect.bottom + margin && area.bottom > rect.top - margin;
    const tipBlocked = [...primaries, ...controls].some(rect => touches(tip, rect, 0));
    const hits = primaries.filter(rect => overlaps(home, rect));
    const covering = hits.length > 0 || controls.some(rect => touches(home, rect, 0));
    let next: { tuck: boolean; y?: number; tipBlocked: boolean } = { tuck: covering, tipBlocked };
    if (hits.length) {
      const tuckedRect = { left: home.left + shift, right: home.right + shift, top: home.top, bottom: home.bottom };
      if (primaries.some(rect => overlaps(tuckedRect, rect))) {
        const above = Math.min(...hits.map(rect => rect.top)) - gap - b.size;
        next = { ...next, y: above >= b.min ? above : Math.min(b.max, Math.max(...hits.map(rect => rect.bottom)) + gap) };
      }
    }
    setAvoid(previous => previous.tuck === next.tuck && previous.y === next.y && previous.tipBlocked === next.tipBlocked ? previous : next);
  }, [y, side, avoidSelector]);
  useEffect(() => {
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(check); };
    schedule();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    observer?.observe(document.body);
    const timer = window.setInterval(schedule, 1200);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule); observer?.disconnect(); window.clearInterval(timer); };
  }, [check]);

  const isTucked = !open && (tucked || avoid.tuck);
  const shownY = open ? y : avoid.y ?? y;
  useEffect(() => {
    document.documentElement.dataset.orb = isTucked ? 'tucked' : 'shown';
    return () => { delete document.documentElement.dataset.orb; };
  }, [isTucked]);

  // Window listeners follow the pointer outside the button (pointer capture is dropped by some re-layouts).
  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || y === undefined) return;
    suppressClick.current = false;
    const state = { id: event.pointerId, x: event.clientX, y: event.clientY, top: y, moved: false };
    drag.current = state;
    const move = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== state.id) return;
      const dy = next.clientY - state.y, dx = next.clientX - state.x;
      if (!state.moved && Math.abs(dy) <= 4 && Math.abs(dx) <= 4) return;
      if (!state.moved) { state.moved = true; setDragging(true); setTucked(false); setOpen(false); setAvoid({ tuck: false, tipBlocked: true }); }
      const b = bounds();
      setY(Math.min(b.max, Math.max(b.min, state.top + dy)));
      setSide(next.clientX < b.width / 2 ? 'left' : 'right');
    };
    const up = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== state.id) return;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      drag.current = null;
      if (state.moved) { suppressClick.current = true; setDragging(false); setTipClosed(true); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  function click() {
    if (suppressClick.current) { suppressClick.current = false; return; }
    setOpen(value => !value); setTucked(false); setTipClosed(true);
  }
  function key(event: KeyboardEvent<HTMLButtonElement>) {
    const b = bounds();
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      setY(value => Math.min(b.max, Math.max(b.min, (value ?? b.min) + (event.key === 'ArrowUp' ? -24 : 24))));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); setSide(event.key === 'ArrowLeft' ? 'left' : 'right');
    }
  }
  const panelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus(); }
  };
  if (y === undefined) return null;
  const upward = (shownY ?? 0) > window.innerHeight / 2;
  return <div className="v9-orb" data-side={side} data-tucked={isTucked ? 'true' : 'false'} data-dragging={dragging ? 'true' : 'false'}
    data-direction={upward ? 'up' : 'down'} style={upward ? { bottom: `${window.innerHeight - (shownY ?? 0) - bounds().size}px` } : { top: `${shownY}px` }}>
    {!open && !tipClosed && !isTucked && !avoid.tipBlocked && tipText && <div className="v9-orb-tip">
      <span>{tipText}</span>
      <button type="button" className="v9-orb-icon" aria-label={t.closeTip} onClick={() => setTipClosed(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
    </div>}
    {open && <div className="v9-orb-panel" role="dialog" aria-label={t.panel} id={panelId} onKeyDown={panelKey}>
      <div className="v9-orb-panel-head"><strong>{t.title}</strong>
        <button type="button" className="v9-orb-icon" aria-label={t.close} onClick={() => { setOpen(false); button.current?.focus(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
      {tipText && <p>{tipText}</p>}
      <div className="v9-orb-actions">{list.map(action => <button key={action.label} type="button" className="v9-orb-action"
        onClick={() => { setOpen(false); onAction(action.prompt ?? action.label); }}><span>{action.label}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>)}</div>
      <div className="v9-orb-footer">
        <button type="button" className="v9-orb-chat" onClick={() => { setOpen(false); onOpenChat(); }}>{t.openChat}</button>
        <button type="button" className="v9-orb-tuck" onClick={() => { setOpen(false); setTucked(true); }}>{t.tuck}</button>
      </div>
    </div>}
    <button ref={button} type="button" className="v9-orb-button" aria-label={t.orb} aria-expanded={open} aria-controls={open ? panelId : undefined}
      onPointerDown={pointerDown} onClick={click} onKeyDown={key}>
      <span className="v9-orb-ring" aria-hidden="true" /><span className="v9-orb-core" aria-hidden="true" />
      <Yaya pose="head" size={58} mode="disc" alt="" />
    </button>
  </div>;
}
