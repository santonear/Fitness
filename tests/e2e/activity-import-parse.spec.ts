import { expect, test } from '@playwright/test';

// parseGpxActivities needs the browser's DOMParser, so it runs in the page rather than in Vitest (Node).
const gpx = (points: string[], doctype = '') =>
  `<?xml version="1.0"?>${doctype}<gpx version="1.1" creator="synthetic" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${points
    .map((time, index) => `<trkpt lat="${index}" lon="${index}"><time>${time}</time></trkpt>`)
    .join('')}</trkseg></trk></gpx>`;

test('GPX parsing keeps whole tracks and refuses incomplete or unsafe files', async ({ page }) => {
  await page.goto('/settings');
  const files = {
    valid: gpx(['2026-01-01T15:50:00Z', '2026-01-01T16:10:00Z']),
    reversed: gpx(['2026-01-01T00:20:00Z', '2026-01-01T00:00:00Z']),
    onePoint: gpx(['2026-01-01T00:00:00Z']),
    doctype: gpx(['2026-01-01T00:00:00Z', '2026-01-01T00:20:00Z'], '<!DOCTYPE gpx>'),
    tooLong: gpx(['2026-01-01T00:00:00Z', '2026-01-01T12:01:00Z']),
    longest: gpx(['2026-01-01T00:00:00Z', '2026-01-01T12:00:00Z']),
  };
  const results = await page.evaluate(async files => {
    const path = '/src/application/activity-import.ts';
    const { parseGpxActivities } = await import(/* @vite-ignore */ path);
    const out: Record<string, unknown> = {};
    for (const [name, text] of Object.entries(files)) {
      try {
        out[name] = await parseGpxActivities(text, 'Asia/Shanghai');
      } catch (error) {
        out[name] = (error as Error).message;
      }
    }
    return out;
  }, files);
  expect(results.valid).toEqual([
    {
      receiptId: expect.stringMatching(/^[a-f0-9]{64}:0$/),
      localDate: '2026-01-01',
      minutes: 20,
      timeZone: 'Asia/Shanghai',
    },
  ]);
  for (const name of ['reversed', 'onePoint', 'doctype', 'tooLong'])
    expect(results[name], name).toBe('INVALID_ACTIVITY_FILE');
  expect(results.longest).toMatchObject([{ minutes: 720 }]);
});
