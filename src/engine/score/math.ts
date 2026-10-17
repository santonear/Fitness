export const clamp = (n: number) =>
  Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export const countSatisfaction = (actual: number, required: number) =>
  required > 0 ? clamp(actual / required) : 0;

/** Linear distance outside a source interval; the lower bound is also the distance to zero. */
export function intervalSatisfaction(
  n: number,
  lo: number,
  hi: number,
): number {
  return n < lo
    ? countSatisfaction(n, lo)
    : n > hi
      ? clamp(1 - (n - hi) / Math.max(lo, hi - lo))
      : 1;
}

export const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
