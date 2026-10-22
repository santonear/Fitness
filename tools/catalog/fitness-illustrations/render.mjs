// Renders the Fitness-original exercise illustrations to 512×512 WebP (same canvas as the
// provider media) and writes the manifest the app reads. Run: node tools/catalog/fitness-illustrations/render.mjs
// Optional: --sheet <dir> also writes a review contact sheet; --only <slug,...> limits the run.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { illustrations } from './poses.mjs';
import { render } from './figure.mjs';

const args = process.argv.slice(2),
  opt = name => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
const only = opt('--only')?.split(','),
  sheetDir = opt('--sheet');
// sharp ships with the toolchain (via wrangler/miniflare); it is only needed when regenerating art.
const sharp = (await import('sharp')).default;
const custom = JSON.parse(await readFile('src/catalog/custom-exercises.json', 'utf8'));
const out = 'public/exercise-media/fitness',
  manifest = {};
await mkdir(out, { recursive: true });
const tiles = [];
for (const row of custom) {
  const make = illustrations[row.slug];
  if (!make) throw Error('No illustration defined for ' + row.slug);
  const poses = make();
  manifest[row.slug] = {};
  for (const [pose, scene] of Object.entries(poses)) {
    const path = `/exercise-media/fitness/${row.slug}-${pose}.webp`;
    manifest[row.slug][pose] = path;
    if (only && !only.includes(row.slug)) continue;
    const svg = render(scene, scene.renderOptions);
    const webp = await sharp(Buffer.from(svg)).webp({ quality: 82, effort: 6, smartSubsample: true }).toBuffer();
    await writeFile('public' + path, webp);
    if (sheetDir) tiles.push({ svg, label: `${row.name.zh} · ${pose}` });
  }
}
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
// Provenance travels with the data so the UI never credits these images to a provider.
const data = {
  provenance: 'fitness-original',
  notice: '/media/NOTICE.md',
  generator: 'tools/catalog/fitness-illustrations',
  professionalReview: 'not-reviewed',
  exercises: sorted,
};
await writeFile('src/catalog/custom-exercise-media.json', JSON.stringify(data, null, 1) + '\n');
if (sheetDir) {
  await mkdir(sheetDir, { recursive: true });
  const per = 6,
    size = 256;
  for (let page = 0; page * per * 3 < tiles.length; page++) {
    const chunk = tiles.slice(page * per * 3, (page + 1) * per * 3);
    const composites = await Promise.all(
      chunk.map(async (t, i) => ({
        input: await sharp(Buffer.from(t.svg)).resize(size, size).png().toBuffer(),
        left: (i % per) * size,
        top: Math.floor(i / per) * (size + 24),
      })),
    );
    const labels = chunk
      .map(
        (t, i) =>
          `<text x="${(i % per) * size + 8}" y="${Math.floor(i / per) * (size + 24) + size + 18}" font-size="15" font-family="sans-serif">${t.label}</text>`,
      )
      .join('');
    composites.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${per * size}" height="${3 * (size + 24)}">${labels}</svg>`,
      ),
      left: 0,
      top: 0,
    });
    await sharp({ create: { width: per * size, height: 3 * (size + 24), channels: 3, background: '#ffffff' } })
      .composite(composites)
      .png()
      .toFile(`${sheetDir}/sheet-${page + 1}.png`);
  }
}
console.log(
  `Fitness illustrations: ${Object.keys(manifest).length} exercises, ${Object.values(manifest).reduce((n, m) => n + Object.keys(m).length, 0)} images.`,
);
