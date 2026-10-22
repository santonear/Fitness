import { readFile, writeFile } from 'node:fs/promises';
import { catalogCorrections } from '../../src/catalog/corrections.ts';
const path = 'data/training-engine/annotations.json';
const rows = JSON.parse(await readFile(path, 'utf8'));
const fixes: Record<string, { required: string[]; alternatives?: Record<string, string[]> }> = {
  'back-extension': { required: ['back-extension-machine'] },
  'doorway-chest-stretch': { required: ['wall'] },
  'straight-bar-dips': { required: ['dip-station'] },
  'human-flag': { required: ['vertical-pole'] },
};
for (const row of rows) {
  if (!catalogCorrections[row.slug]) continue;
  const fix = fixes[row.slug];
  if (fix) {
    row.equipment_required = fix.required;
    row.equipment_alternatives = fix.alternatives ?? {};
  }
  row.catalog_issue = null;
  // Keep the original judgement note while recording the reviewed application erratum.
  if (!(row.note ?? '').includes('Fitness errata applied'))
    row.note = (row.note ?? '') + (row.note ? ' ' : '') + 'Fitness errata applied.';
}
await writeFile(path, JSON.stringify(rows, null, 1) + '\n');
console.log(`Annotation errata synchronized: ${Object.keys(catalogCorrections).length} catalog entries.`);
