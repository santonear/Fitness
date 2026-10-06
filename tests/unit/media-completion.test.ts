import { describe, expect, it } from 'vitest';
import { exerciseMedia, youtubeEmbedUrl } from '../../src/catalog/media';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExerciseMedia } from '../../src/ui/components/ExerciseMedia';

describe('four exercise media source completion', () => {
 it('maps walking gait and plank publisher-linked resources without claiming playback review', () => {
  const entries = Object.values(exerciseMedia);
  expect(entries.map(entry => entry.videoId)).toContain('4PR9GedBrZY');
  expect(entries.map(entry => entry.videoId)).toContain('P3FR4GUl2QM');
  for (const entry of entries) {
   expect(entry.checkedOn).toBe('2026-10-06');
   expect(entry.videoReview.playback).toBe('not-verified');
   expect(entry.videoReview.content).toBe('not-reviewed');
  }
  expect(youtubeEmbedUrl('P3FR4GUl2QM')).toBe('https://www.youtube-nocookie.com/embed/P3FR4GUl2QM?autoplay=0');
  expect(entries.find(entry => entry.videoId === '4PR9GedBrZY')?.video?.scope).toBe('gait-and-falls');
  for (const entry of entries) expect(Object.isFrozen(entry.video)).toBe(true);
 });
 it('shows the walking scope and verified metadata without claiming reviewed movement or availability', () => {
  const html = Object.entries(exerciseMedia).map(([exerciseId]) => renderToStaticMarkup(createElement(ExerciseMedia, { exerciseId, exerciseName: 'Exercise', locale: 'en' }))).join('');
  expect(html).toContain('Only the walking portion is referenced');
  expect(html).toContain('How to do a body weight squat | Bupa Health');
  expect(html).toContain('regional availability and redistribution rights are unverified');
  expect(html).not.toContain('<iframe');
 });
});
