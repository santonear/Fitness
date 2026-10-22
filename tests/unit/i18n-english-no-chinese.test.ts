import { describe, expect, it } from 'vitest';
import { exercises } from '../../src/catalog/exercises';
import rules from '../../src/engine/generated/rules-runtime.json';

/** English copy never contains Chinese, except a language option written in its own language. */
const cjk = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const allowed = new Set(['中文']);

function strings(value: unknown, path: string, out: [string, string][], depth = 0) {
  if (depth > 12) return;
  if (typeof value === 'string') out.push([path, value]);
  else if (typeof value === 'function') {
    // Copy helpers such as minutes(n) are called with a sample number.
    try {
      const result = (value as (...args: unknown[]) => unknown)(2, 2, 2);
      strings(result, `${path}()`, out, depth + 1);
    } catch {
      /* Helpers needing richer input are covered by the browser walk. */
    }
  } else if (Array.isArray(value)) value.forEach((item, index) => strings(item, `${path}[${index}]`, out, depth + 1));
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value)) strings(item, `${path}.${key}`, out, depth + 1);
}

const jsonModules = import.meta.glob('../../src/i18n/**/*.json', { eager: true, import: 'default' });
const tsModules = import.meta.glob(['../../src/i18n/**/*.ts', '!../../src/i18n/index.ts'], { eager: true });

function englishStrings(): [string, string][] {
  const out: [string, string][] = [];
  for (const [file, value] of Object.entries(jsonModules)) {
    if (/(?:^|\/)(?:en|[\w-]+\.en)\.json$/.test(file)) strings(value, file, out);
  }
  for (const [file, module] of Object.entries(tsModules)) {
    if (/\/en\.ts$/.test(file)) {
      strings((module as { default?: unknown }).default, file, out);
      continue;
    }
    for (const [name, value] of Object.entries(module as Record<string, unknown>)) {
      if (value && typeof value === 'object' && 'en' in value && 'zh' in value)
        strings((value as { en: unknown }).en, `${file}#${name}.en`, out);
    }
  }
  return out;
}

describe('English copy', () => {
  it('covers the shared and feature dictionaries', () => {
    expect(englishStrings().length).toBeGreaterThan(1000);
  });
  it('has English exercise names, steps and engine copy without Chinese', () => {
    const out: [string, string][] = [];
    for (const exercise of exercises)
      for (const [key, value] of Object.entries(exercise)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && 'en' in value)
          strings((value as { en: unknown }).en, `${exercise.id}.${key}.en`, out);
      }
    for (const [key, value] of Object.entries(rules.copy as Record<string, { en: string }>))
      strings(value.en, `rules.${key}.en`, out);
    expect(out.length).toBeGreaterThan(500);
    expect(out.filter(([, text]) => !text || cjk.test(text)).map(([path, text]) => `${path}: ${text}`)).toEqual([]);
  });
  it('contains no Chinese characters', () => {
    const leaks = englishStrings()
      .filter(([, text]) => !allowed.has(text) && cjk.test(text))
      .map(([path, text]) => `${path}: ${text}`);
    expect(leaks).toEqual([]);
  });
});
