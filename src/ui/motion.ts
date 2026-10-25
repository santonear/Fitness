import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Shared one-shot motion (V9.20): every helper is a no-op with reduced motion or without the browser API. */
export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Rolls a number from its last value (or `initial` on first show) to the new one (ease-out, 600 ms); instant with reduced motion. */
export function useCountUp(target: number, initial = target) {
  const [shown, setShown] = useState(reducedMotion() ? target : initial);
  const from = useRef(initial);
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

export type EnterFrom = 'up' | 'forward' | 'back';
/** Plays a short entrance on `element` (fade plus a small slide in the direction of travel). */
export function enter(element: Element | null | undefined, from: EnterFrom = 'up', delay = 0) {
  if (!element || typeof element.animate !== 'function' || reducedMotion()) return;
  const style = getComputedStyle(element),
    step = (name: string, fallback: number) => parseFloat(style.getPropertyValue(name)) || fallback;
  const offset =
    from === 'up'
      ? `translateY(${step('--s2', 8)}px)`
      : `translateX(${step('--s5', 24) * (from === 'forward' ? 1 : -1)}px)`;
  element.animate(
    [
      { opacity: 0, transform: offset },
      { opacity: 1, transform: 'none' },
    ],
    {
      duration: 280,
      delay,
      easing: style.getPropertyValue('--snap-ease').trim() || 'ease-out',
      fill: 'backwards',
    },
  );
}

/** Runs `enter` before paint whenever `key` changes; the first render stays still. */
export function useEnterMotion(target: () => Element | null | undefined, key: string, from: EnterFrom = 'up') {
  const last = useRef(key);
  useLayoutEffect(() => {
    if (last.current === key) return;
    last.current = key;
    enter(target(), from);
  }, [key]);
}

/** Draws each progress ring inside `root` from empty to its value once (finish screen highlight). */
export function drawRings(root: ParentNode | null | undefined) {
  if (!root || reducedMotion()) return;
  for (const ring of root.querySelectorAll<SVGElement>('.v9-ring-value')) {
    const to = ring.getAttribute('stroke-dasharray');
    if (!to || typeof ring.animate !== 'function') continue;
    ring.animate([{ strokeDasharray: `0 ${to.split(' ')[1]}` }, { strokeDasharray: to }], {
      duration: 900,
      delay: 200,
      easing: 'cubic-bezier(.14,.82,.24,1)',
      fill: 'backwards',
    });
  }
}

/** Grows a bar up from its base once. */
export function grow(element: Element, delay = 0) {
  if (typeof element.animate !== 'function' || reducedMotion()) return;
  element.animate(
    [
      { transform: 'scaleY(0)', transformOrigin: 'bottom' },
      { transform: 'none', transformOrigin: 'bottom' },
    ],
    { duration: 700, delay, easing: 'cubic-bezier(.14,.82,.24,1)', fill: 'backwards' },
  );
}
