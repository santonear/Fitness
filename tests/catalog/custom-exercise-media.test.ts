import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { customCatalog } from '../../src/catalog/custom-exercises';
import { exerciseOriginalMedia, exerciseVisual, exerciseVisualMetadata } from '../../src/catalog/exercise-visual';
import { getExerciseGuide } from '../../src/catalog/exercise-guide';
import { exercises } from '../../src/catalog/exercises';
import media from '../../src/catalog/custom-exercise-media.json';
import { ExerciseGuideContent } from '../../src/ui/components/ExerciseGuide';

const webpSize = (bytes: Buffer) => {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') {
    const b = bytes.readUInt32LE(21);
    return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
  }
  return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
};

describe('Fitness-original exercise illustrations', () => {
  it('gives every exercise in the catalogue a demonstration image', () => {
    const missing = exercises
      .filter(exercise => {
        const src = exerciseVisual(exercise.id)?.src;
        return !src || src.startsWith('data:');
      })
      .map(exercise => exercise.name.zh);
    expect(missing).toEqual([]);
  });
  it('covers each supplementary exercise with real 512px WebP poses marked as original', () => {
    expect(media.provenance).toBe('fitness-original');
    expect(Object.keys(media.exercises).sort()).toEqual(customCatalog.map(row => row.slug).sort());
    for (const row of customCatalog) {
      const poses = exerciseOriginalMedia(row.id)!;
      expect(Object.keys(poses).sort().join(), row.slug).toMatch(/^(main|peak,start)$/);
      for (const src of Object.values(poses)) {
        expect(src).toMatch(new RegExp(`^/exercise-media/fitness/${row.slug}-(start|peak|main)\.webp$`));
        const bytes = readFileSync(`public${src}`);
        expect(webpSize(bytes)).toEqual([512, 512]);
        expect(bytes.length).toBeLessThan(40_000);
      }
      expect(exerciseVisualMetadata(row.id)).toBeUndefined();
      const guide = getExerciseGuide(row.id, 'zh');
      expect(guide.media?.src).toBe(poses.peak ?? poses.main);
      expect(guide.media?.attribution).toBe('Fitness original illustration');
    }
  });
  it('ships no orphan files beside the manifest', () => {
    const listed = new Set(Object.values(media.exercises).flatMap(poses => Object.values(poses)));
    for (const name of readdirSync('public/exercise-media/fitness'))
      expect(listed.has(`/exercise-media/fitness/${name}`), name).toBe(true);
  });
  it('shows start and key positions in the guide with original attribution', () => {
    const march = customCatalog.find(row => row.slug === 'custom-seated-march')!;
    const html = renderToStaticMarkup(createElement(ExerciseGuideContent, { id: march.id, locale: 'zh' }));
    expect(html).toContain('custom-seated-march-start.webp');
    expect(html).toContain('custom-seated-march-peak.webp');
    expect(html).toContain('起始姿势');
    expect(html).toContain('动作姿势');
    expect(html).toContain('Fitness 原创示意图');
    expect(html).not.toContain('repdb.co');
    expect(html).not.toContain('动作模式图标');
  });
});
