import type { ActivityRecord } from '../domain/v8/contracts';
import { v8ActivitySchema } from '../domain/schemas';
import { DomainError } from '../domain/errors';
import type { Repository } from '../persistence/repository';
import { activityDate } from './v8-activity';
import { isFeatureEnabled } from './feature-flags';
import { z } from 'zod';
const sourceTime = z.iso.datetime({ offset: true });
export interface ImportedActivityCandidate { receiptId: string; localDate: string; minutes: number; timeZone: string }
const invalid = () => new DomainError('INVALID', 'INVALID_ACTIVITY_FILE');
export async function parseGpxActivities(text: string, timeZone: string): Promise<ImportedActivityCandidate[]> {
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw invalid();
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'gpx' || xml.documentElement.getAttribute('version') !== '1.1' || xml.documentElement.namespaceURI !== 'http://www.topografix.com/GPX/1/1') throw invalid();
  const tracks = [...xml.documentElement.children].filter(element => element.localName === 'trk');
  if (!tracks.length || tracks.length > 100) throw invalid();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return tracks.map((track, index) => {
    const segments = [...track.children].filter(element => element.localName === 'trkseg');
    const points = segments.flatMap(segment => [...segment.children].filter(element => element.localName === 'trkpt'));
    // Reject incomplete evidence rather than infer duration from position or metadata.
    if (points.length < 2) throw invalid();
    const times = points.map(point => {
      const raw = [...point.children].find(element => element.localName === 'time')?.textContent?.trim();
      if (!raw || !sourceTime.safeParse(raw).success) throw invalid();
      const value = Date.parse(raw); if (!Number.isFinite(value)) throw invalid(); return value;
    });
    if (times.some((time, i) => i > 0 && time < times[i - 1])) throw invalid();
    const minutes = Math.round((times.at(-1)! - times[0]) / 60_000);
    if (minutes < 1 || minutes > 720 || times.at(-1)! > Date.now()) throw invalid();
    return { receiptId: `${digest}:${index}`, localDate: activityDate(timeZone, 0, new Date(times[0])), minutes, timeZone };
  });
}
export function createActivityImportService(repo: Repository, enabled = () => isFeatureEnabled('activityImport')) {
  return { save: async (candidates: ImportedActivityCandidate[], type: ActivityRecord['type'], revision: number, generation: number) => {
    if (!enabled() || !candidates.length || candidates.length > 100) throw invalid();
    return repo.write(async () => {
      if (!enabled() || ((await repo.readMetadata()).restoreGeneration ?? 0) !== generation) throw new DomainError('CONFLICT', 'STALE_IMPORT');
      let added = 0;
      for (const candidate of candidates) {
        if (!/^[a-f0-9]{64}:\d+$/.test(candidate.receiptId) || !Number.isInteger(candidate.minutes) || candidate.minutes < 1 || candidate.minutes > 720 || candidate.localDate > activityDate(candidate.timeZone)) throw invalid();
        if (await repo.db.activityImportReceipts.get(candidate.receiptId)) continue;
        const createdAt = new Date().toISOString();
        const record = v8ActivitySchema.parse({ id: crypto.randomUUID(), type, minutes: candidate.minutes, localDate: candidate.localDate, timeZone: candidate.timeZone, createdAt });
        await repo.db.v8Activities.add(record);
        await repo.db.activityImportReceipts.add({ id: candidate.receiptId, activityId: record.id, source: 'gpx', importedAt: createdAt });
        added++;
      }
      return { added, skipped: candidates.length - added };
    }, revision);
  } };
}
