import type { Page } from '@playwright/test';

/** The 3D posters live in R2 (not in the dev server): serve any small webp so <img> checks can load them. */
export const servePosters = (page: Page) =>
  page.route('**/models/*.webp', route => route.fulfill({ path: 'public/yaya/head-pop.webp' }));
