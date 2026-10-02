import { DomainError } from './errors';
import type { MetricInput, SetMetrics } from './models';
import { setMetricsSchema } from './schemas';

function numeric(value: unknown, scale = 1): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value.trim()))) {
    throw new DomainError('INVALID', 'Enter a metric number');
  }
  // Decimal text is converted with integer arithmetic to avoid 1.001 * 1000
  // producing 1000.9999999999999 in binary floating point.
  const text = String(value).trim();
  if (Number(value) < 0) throw new DomainError('INVALID', 'Metrics cannot be negative');
  const [whole, fraction = ''] = text.split('.');
  const digits = scale === 1000 ? 3 : 0;
  if (fraction.slice(digits).replace(/0/g, '') !== '') throw new DomainError('INVALID', 'Metric precision is invalid');
  const scaled = Number(whole) * scale + Number(fraction.slice(0, digits).padEnd(digits, '0'));
  if (!Number.isFinite(scaled) || !Number.isSafeInteger(scaled)) throw new DomainError('INVALID', 'Metric precision is invalid');
  return scaled;
}

export function parseMetric(input: MetricInput): SetMetrics {
  const allowed: Record<string, string[]> = {
    reps: ['metricType', 'reps'], reps_load: ['metricType', 'reps', 'loadKg'],
    duration: ['metricType', 'durationSeconds'], duration_distance: ['metricType', 'durationSeconds', 'distanceKm'],
  };
  if (!allowed[input.metricType] || Object.keys(input).some((key) => !allowed[input.metricType].includes(key))) {
    throw new DomainError('INVALID', 'Unknown metric field or type');
  }
  let canonical: unknown;
  switch (input.metricType) {
    case 'reps': canonical = { metricType: input.metricType, reps: numeric(input.reps) }; break;
    case 'reps_load': canonical = { metricType: input.metricType, reps: numeric(input.reps), loadGrams: numeric(input.loadKg, 1000) }; break;
    case 'duration': canonical = { metricType: input.metricType, durationSeconds: numeric(input.durationSeconds) }; break;
    case 'duration_distance': canonical = {
      metricType: input.metricType, durationSeconds: numeric(input.durationSeconds),
      ...(input.distanceKm === undefined ? {} : { distanceMeters: numeric(input.distanceKm, 1000) }),
    }; break;
  }
  const result = setMetricsSchema.safeParse(canonical);
  if (!result.success) throw new DomainError('INVALID', 'Invalid metric values');
  return result.data;
}
