import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { exercises } from '../../src/catalog/exercises';
import { exerciseMedia, youtubeEmbedUrl } from '../../src/catalog/media';
import { ExerciseMedia } from '../../src/ui/components/ExerciseMedia';

describe('catalogue media trust boundary', () => {
 it('only accepts literal reviewed source identities and never caller supplied URLs', () => {
  expect(youtubeEmbedUrl('nfX7IFK9UNI')).toBe('https://www.youtube-nocookie.com/embed/nfX7IFK9UNI?autoplay=0');
  for (const value of ['https://evil.test', 'nfX7IFK9UNI?autoplay=1', '../m0GcZ24pK6k', 'AAAAAAAAAAA', 'm0GcZ24pK6k\n']) expect(youtubeEmbedUrl(value)).toBeUndefined();
 });
 it('maps the unchanged four catalogue identities without external thumbnails or initial iframes', () => {
  expect(Object.keys(exerciseMedia).sort()).toEqual(exercises.slice(0, 4).map(exercise => exercise.id).sort());
  const before = structuredClone(exercises);
  for (const exercise of exercises.slice(0, 4)) {
   const html = renderToStaticMarkup(createElement(ExerciseMedia, { exerciseId: exercise.id, exerciseName: exercise.name.en, locale: 'en' }));
   expect(html).not.toContain('<iframe'); expect(html).toContain('src="/media/');
   expect(html).toContain('movement form has not been professionally reviewed');
   expect(html).toContain('no-referrer');
  }
  expect(exercises).toEqual(before);
 });
 it('keeps unknown identities empty rather than loading arbitrary resources', () => {
  expect(renderToStaticMarkup(createElement(ExerciseMedia, { exerciseId: 'unknown', exerciseName: 'unknown', locale: 'en' }))).toBe('');
 });
});
