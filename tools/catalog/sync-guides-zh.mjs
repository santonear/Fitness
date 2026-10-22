import { readFile, writeFile } from 'node:fs/promises';
import { chineseGuides } from './guides-zh.mjs';

// Offline regeneration of the guide-derived fields when the pinned RepDB ZIP is unavailable.
// The full build uses the same source and overwrites these generated files on the next build.
const registry = JSON.parse(await readFile('src/catalog/generated/registry.json', 'utf8'));
const core = JSON.parse(await readFile('src/catalog/generated/core.json', 'utf8'));
const slugById = new Map(registry.map(row => [row.id, row.slug]));
let updated = 0;
for (const entry of core) {
  const slug = slugById.get(entry.id),
    guide = chineseGuides[slug];
  if (!guide) continue;
  if (
    JSON.stringify(entry.steps.zh) !== JSON.stringify(guide.steps) ||
    JSON.stringify(entry.cautions.zh) !== JSON.stringify(guide.cautions)
  )
    updated++;
  entry.steps.zh = guide.steps;
  entry.cautions.zh = guide.cautions;
}
await writeFile('src/catalog/generated/guides-zh.json', JSON.stringify(chineseGuides));
await writeFile('src/catalog/generated/core.json', JSON.stringify(core));
console.log(
  `Chinese guides: ${Object.keys(chineseGuides).length}/${registry.length}; core entries updated: ${updated}`,
);
