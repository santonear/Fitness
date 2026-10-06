import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { exerciseMedia, getExerciseMedia } from '../../src/catalog/media';
import { ExerciseMedia } from '../../src/ui/components/ExerciseMedia';

describe('media provenance and safe identity lookup', () => {
 it('rejects inherited identities and caller URLs', () => {
  for (const id of ['constructor', 'toString', '__proto__', 'https://www.nasm.org/resource-center/exercise-library/goblet-squat']) {
   expect(getExerciseMedia(id)).toBeUndefined();
   expect(renderToStaticMarkup(createElement(ExerciseMedia, { exerciseId: id, exerciseName: id, locale: 'en' }))).toBe('');
  }
 });
 it('keeps rights, source association, professional content review and playback separate', () => {
  for (const entry of Object.values(exerciseMedia)) {
   expect(entry.illustrationRights).toEqual({ status: 'project-original', notice: '/media/NOTICE.md', professionalReview: 'not-reviewed' });
   expect(entry.videoReview.content).toBe('not-reviewed');
   expect(entry.videoReview.playback).toBe(entry.videoId ? 'not-verified' : 'no-video');
   expect(entry.videoReview.reuseLicense).toBe('not-verified');
   expect(Object.isFrozen(entry.source)).toBe(true);
   expect(Object.isFrozen(entry)).toBe(true);
   expect(Object.isFrozen(entry.videoReview)).toBe(true);
   expect(entry.checkedOn).toBe('2026-10-06');
  }
 });
 it('shows source association separately from the pending review and rights', () => {
  const html = Object.keys(exerciseMedia).map(exerciseId => renderToStaticMarkup(createElement(ExerciseMedia, { exerciseId, exerciseName: 'Exercise', locale: 'en' }))).join('');
  expect(html).toContain('confirms source association only');
  expect(html).toContain('YouTube metadata confirms the video title and channel name');
  expect(html).toContain('embedding and actual playback are unverified');
  expect(html).toContain('redistribution rights are unverified');
 });
});
