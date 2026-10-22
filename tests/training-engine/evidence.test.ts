import { it, expect } from 'vitest';
import {
  validEvidence,
  runtimeFingerprint,
  EVIDENCE_VERSION,
  type Evidence,
} from '../../tools/training-engine/evidence';
const fixture = (): Evidence => ({
  version: EVIDENCE_VERSION,
  sourceHash: 'source',
  inputHash: 'input',
  seed: 42,
  nodeVersion: process.version,
  runtimeFingerprint: runtimeFingerprint(),
  report: { seed: 42, hardCoverageComplete: true, evaluated: 2000, extremeEvaluated: 200 },
});
it('accepts only same-source same-input correctness evidence', () => {
  expect(validEvidence(fixture(), 'source', 'input', 42)).toBe(true);
  expect(validEvidence(fixture(), 'changed', 'input', 42)).toBe(false);
  expect(validEvidence(fixture(), 'source', 'changed', 42)).toBe(false);
});
it('rejects missing hard coverage and incomplete populations', () => {
  for (const mutate of [
    (e: Evidence) => {
      e.report.hardCoverageComplete = false;
    },
    (e: Evidence) => {
      e.report.evaluated = 1999;
    },
    (e: Evidence) => {
      e.report.extremeEvaluated = 199;
    },
  ]) {
    const value = fixture();
    mutate(value);
    expect(validEvidence(value, 'source', 'input', 42)).toBe(false);
  }
});
it('rejects changed runtime, version and inconsistent seeds', () => {
  for (const mutate of [
    (e: Evidence) => {
      e.runtimeFingerprint = 'other-machine';
    },
    (e: Evidence) => {
      e.report.seed = 43;
    },
    (e: Evidence) => {
      e.seed = 43;
    },
    (e: Evidence) => {
      e.version = EVIDENCE_VERSION - 1;
    },
  ]) {
    const value = fixture();
    mutate(value);
    expect(validEvidence(value, 'source', 'input', 42)).toBe(false);
  }
});
it('keeps slow or absent timing outside correctness admission', () => {
  const value = fixture();
  value.report.performance = { totalMs: 999999, isolatedP95Ms: 9999 };
  expect(validEvidence(value, 'source', 'input', 42)).toBe(true);
  delete value.report.performance;
  expect(validEvidence(value, 'source', 'input', 42)).toBe(true);
});
