import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
import { conversationSchema } from '../../src/persistence/assistant-conversations';
const original = () =>
  JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v807-mainline.json', import.meta.url), 'utf8'));
const chat = () => ({
  id: crypto.randomUUID(),
  title: 'Training question',
  updatedAt: '2026-10-12T00:00:00.000Z',
  messages: [{ role: 'user', content: 'How should I train?' }],
});
function current() {
  const old = original();
  return {
    ...old,
    schemaVersion: 11,
    data: {
      ...old.data,
      metadata: { ...old.data.metadata, schemaVersion: 13 },
      exerciseFavorites: [],
      nutritionRecords: [],
      activityImportReceipts: [],
      assistantConversations: [chat()],
      v8: { ...old.data.v8, planReferences: old.data.v8.planReferences ?? [] },
    },
  };
}
describe('assistant backup 11', () => {
  it('retains optional conversations while preserving older training data', () => {
    const value = current();
    expect(validateBackupEnvelope(value).data.assistantConversations).toEqual(value.data.assistantConversations);
    delete value.data.assistantConversations;
    expect(validateBackupEnvelope(value).data.assistantConversations).toBeUndefined();
    expect(validateBackupEnvelope(original()).data.assistantConversations).toBeUndefined();
  });
  it('rejects more than 30 conversations and candidate injection', () => {
    const value = current();
    value.data.assistantConversations = Array.from({ length: 31 }, chat);
    expect(() => validateBackupEnvelope(value)).toThrow();
    expect(conversationSchema.safeParse({ ...chat(), candidate: {} }).success).toBe(false);
  });
  it('rejects duplicate conversation IDs', () => {
    const value = current();
    value.data.assistantConversations.push(value.data.assistantConversations[0]);
    expect(() => validateBackupEnvelope(value)).toThrow();
  });
  it('keeps confirmed structured preferences in backup data without changing legacy notes', () => {
    const value = current(),
      now = '2026-10-12T00:00:00.000Z';
    const note = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      revision: 0,
      memoRevision: 0,
      generatorVersion: 'assistant-v3.0.0',
      locale: 'zh',
      suggestion: '',
      explanation: '',
      kind: 'preferred_days',
      value: ['mon', 'wed', 'fri'],
    };
    value.data.aiMemoryNotes = [...value.data.aiMemoryNotes, note];
    expect(validateBackupEnvelope(value).data.aiMemoryNotes).toContainEqual(note);
  });
});
