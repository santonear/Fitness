import { DomainError } from '../domain/errors';
import type { Locale, LocalProfile, ProfileInput } from '../domain/models';
import { localProfileSchema } from '../domain/schemas';
import { repository, storageError, type Repository } from '../persistence/repository';
export function createProfileService(repo: Repository) {
  async function getProfile(): Promise<LocalProfile | undefined> { return repo.db.profiles.toCollection().first(); }
  async function initialize(locale: Locale): Promise<LocalProfile> {
    return repo.db.transaction('rw', repo.db.tables, async () => {
      const existing = await getProfile();
      if (existing) return existing;
      const timestamp = new Date().toISOString();
      const profile = localProfileSchema.parse({ id: crypto.randomUUID(), revision: 0, createdAt: timestamp, updatedAt: timestamp, locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, units: 'metric' });
      await repo.db.profiles.add(profile);
      await repo.db.metadata.add({ localProfileId: profile.id, schemaVersion: 2, catalogVersion: 1, revision: 1, dataRevision: 1 });
      return profile;
    }).catch(storageError);
  }
  async function saveProfile(input: ProfileInput, expectedRevision: number): Promise<LocalProfile> {
    const validated = localProfileSchema.pick({ locale: true, timeZone: true, units: true, trainingPreferences: true }).safeParse(input);
    if (!validated.success) throw new DomainError('INVALID', validated.error.message);
    return repo.write(async () => {
      const current = await getProfile();
      if (!current || current.revision !== expectedRevision) throw new DomainError('CONFLICT', 'Profile changed; reload before saving');
      const parsed = localProfileSchema.safeParse({ ...current, ...validated.data, trainingPreferences: validated.data.trainingPreferences, revision: current.revision + 1, updatedAt: new Date().toISOString() });
      if (!parsed.success) throw new DomainError('INVALID', parsed.error.message);
      await repo.db.profiles.put(parsed.data);
      return parsed.data;
    });
  }
  async function setLocale(locale: Locale): Promise<LocalProfile> {
    await initialize(locale);
    return repo.db.transaction('rw', repo.db.tables, async () => {
      const current = (await getProfile())!;
      if (current.locale === locale) return current;
      const next = localProfileSchema.parse({ ...current, locale, revision: current.revision + 1, updatedAt: new Date().toISOString() });
      const metadata = await repo.readMetadata();
      await repo.db.profiles.put(next);
      await repo.db.metadata.put({ ...metadata, revision: metadata.revision + 1, dataRevision: metadata.dataRevision + 1 });
      return next;
    }).catch(storageError);
  }
  return { initialize, getProfile, saveProfile, setLocale };
}
export const profileService = createProfileService(repository);
export const saveProfile = profileService.saveProfile;
