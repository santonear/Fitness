import { it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import catalog from '../../src/catalog/custom-exercises.json';
import annotations from '../../data/training-engine/custom-annotations.json';
import native from '../../data/training-engine/annotations.json';
const slug = 'custom-slow-walking-in-place',
  item = catalog.find(e => e.slug === slug)!,
  annotation = annotations.find(e => e.slug === slug)!,
  walking = native.find(e => e.slug === 'walking')!;
it('appends the approved exact bilingual slow-walking name and one-paragraph guidance', () => {
  expect(catalog.at(-1)).toEqual(item);
  expect(annotations.at(-1)).toEqual(annotation);
  expect(item.id).toBe('83cb6674-515a-52cc-8ff4-b74c33f5da5a');
  expect(item.name).toEqual({ zh: '原地慢走', en: 'Slow walking in place' });
  expect(item.steps).toEqual({
    zh: ['慢慢原地踏步，脚轻轻离地，膝盖不用抬高，手臂自然摆动。需要的话可以扶着墙或椅背。'],
    en: [
      'Step slowly in place, lifting your feet just off the floor. No need to raise your knees high; let your arms swing naturally. Hold a wall or chair back if you like.',
    ],
  });
  expect(item.metricType).toBe('duration');
});
it('uses approved mat-minimum standing zero-impact walking facts with optional support and no high-intensity ladder', () => {
  expect(annotation).toMatchObject({
    primary_pattern: 'cardio_cyclic',
    modality: 'cardio',
    space: 'mat',
    position: ['standing'],
    impact: 0,
    requires_floor_transition: false,
    equipment_required: ['none'],
    equipment_alternatives: {},
    ladder: { id: null, step: 0 },
    flags: ['low_intensity', 'postpartum_safe'],
    review: true,
    source: 'custom',
  });
  expect(Object.values(annotation.joint_load).every(n => n <= 1)).toBe(true);
  expect(item.equipment).toBe('none');
  expect(annotation.note).toContain('progression direction is walking only');
  expect(annotation.note).toContain('no high knees, fast or loaded variants');
});
it('copies existing walking dose, time and evidence confidence without inventing clinical values', async () => {
  const toolPath = '../../tools/training-engine/compile-annotations.ts';
  const { validateAnnotations } = await import(toolPath);
  expect(annotation.default_dose).toEqual(walking.default_dose);
  expect(annotation.time).toEqual(walking.time);
  expect(annotation.confidence).toBe(walking.confidence);
  expect(annotation.use).toEqual(walking.use);
  expect(validateAnnotations(annotations).find((e: { slug: string }) => e.slug === slug)).toEqual(annotation);
});
it('records coach review as pending and distinguishes general ACOG background from product approval', () => {
  expect(item.contentSource).toContain('User-approved product decision');
  expect(item.contentSource).toContain('not specific endorsement');
  expect(item.contentSource).toContain('https://www.acog.org/womens-health/faqs/exercise-after-pregnancy');
  expect(item.contentSource).toContain(
    'committee-opinion/articles/2020/04/physical-activity-and-exercise-during-pregnancy-and-the-postpartum-period',
  );
  const csv = readFileSync('docs/training-engine/review-queue.csv', 'utf8'),
    rows = csv.split(/\r?\n/).filter(line => line.startsWith(slug + ','));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toContain('教练复核待完成');
});
it('regenerates idempotently while preserving prior append-only supported balance catalog and annotations', () => {
  const directory = mkdtempSync(resolve('.cache/b-slow-data-'));
  for (const path of ['src/catalog', 'data/training-engine']) mkdirSync(join(directory, path), { recursive: true });
  for (const path of [
    'src/catalog/custom-exercises.json',
    'data/training-engine/custom-annotations.json',
    'data/training-engine/annotations.json',
  ])
    copyFileSync(resolve(path), join(directory, path));
  const script = resolve('tools/training-engine/create-custom-data.ts');
  execFileSync(process.execPath, [script], { cwd: directory });
  const paths = ['src/catalog/custom-exercises.json', 'data/training-engine/custom-annotations.json'],
    first = paths.map(path => readFileSync(join(directory, path), 'utf8'));
  execFileSync(process.execPath, [script], { cwd: directory });
  expect(paths.map(path => readFileSync(join(directory, path), 'utf8'))).toEqual(first);
  for (const [index, source] of [catalog, annotations].entries()) {
    const output = JSON.parse(first[index]);
    expect(output.map((row: { id: string }) => row.id)).toEqual(source.map(row => row.id));
    const balance = source.find(row => row.slug === 'custom-supported-wide-static-stand')!;
    expect(output.find((row: { slug: string }) => row.slug === balance.slug)).toEqual(balance);
  }
  const output = JSON.parse(first[1]);
  for (const name of [
    'custom-wall-supported-single-leg-stand',
    'custom-supported-tandem-stand',
    'custom-supported-heel-raise',
  ])
    expect(output.find((row: { slug: string }) => row.slug === name).equipment_alternatives).toEqual({
      wall: ['chair', 'counter'],
    });
});
