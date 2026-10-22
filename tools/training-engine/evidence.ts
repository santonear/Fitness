import { cpus } from 'node:os';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
export const EVIDENCE_VERSION = 3;
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const runtimeFingerprint = () =>
  digest({
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModels: cpus().map(cpu => cpu.model),
  });
export async function sourceFingerprint() {
  const files: string[] = [];
  async function walk(path: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await walk(file);
      else files.push(file);
    }
  }
  for (const path of ['src', 'data/training-engine', 'tools/eval', 'tools/training-engine', 'tests/training-engine'])
    await walk(path);
  files.push('package.json', 'package-lock.json');
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(file.replaceAll('\\', '/'));
    hash.update(await readFile(file));
  }
  return hash.digest('hex');
}
/** Functional evidence is source/input/runtime bound; elapsed time is reporting only. */
export interface Evidence {
  version: number;
  sourceHash: string;
  inputHash: string;
  seed: number;
  nodeVersion: string;
  runtimeFingerprint: string;
  report: any;
  isolated?: { sampleCount: number; seed: number; p95Ms: number; durationsMs: number[] };
  wallMs?: number;
}
export function validEvidence(value: Evidence, sourceHash: string, inputHash: string, seed: number) {
  return (
    value?.version === EVIDENCE_VERSION &&
    value.sourceHash === sourceHash &&
    value.inputHash === inputHash &&
    value.seed === seed &&
    value.nodeVersion === process.version &&
    value.runtimeFingerprint === runtimeFingerprint() &&
    value.report?.seed === seed &&
    value.report?.hardCoverageComplete === true &&
    value.report?.evaluated === 2000 &&
    value.report?.extremeEvaluated === 200
  );
}
