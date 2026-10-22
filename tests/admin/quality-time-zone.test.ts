import { expect, it } from 'vitest';
import { adminTimeZoneOptions } from '../../src/ui/admin/time-zone-options';
const winter = Date.parse('2026-01-15T12:00:00Z'),
  summer = Date.parse('2026-07-15T12:00:00Z');
it('prioritizes Shanghai and Berlin with readable city names and seasonal offsets', () => {
  const rows = adminTimeZoneOptions('UTC', 'zh', winter);
  expect(rows[0]).toEqual({ value: 'Asia/Shanghai', label: '上海 · 东八区（UTC+8）' });
  expect(rows[1].label).toBe('柏林 · 中欧 · 东一区（UTC+1）');
  expect(adminTimeZoneOptions('UTC', 'zh', summer)[1].label).toBe('柏林 · 中欧 · 东二区（UTC+2）');
  expect(rows.every(row => !row.label.includes('/'))).toBe(true);
  expect(rows.some(row => row.value === 'Europe/Paris')).toBe(true);
});
it('deduplicates Kolkata aliases while retaining the exact saved value for submission', () => {
  for (const saved of ['Asia/Calcutta', 'Asia/Kolkata']) {
    const rows = adminTimeZoneOptions(saved, 'en', winter),
      kolkata = rows.filter(r => r.label.includes('Kolkata'));
    expect(kolkata).toHaveLength(1);
    expect(kolkata[0].value).toBe(saved);
    expect(kolkata[0].label).toContain('UTC+5:30');
    const settings = { timeZone: saved };
    expect(JSON.parse(JSON.stringify(settings)).timeZone).toBe(rows.find(r => r.value === settings.timeZone)!.value);
  }
});
it('retains any existing supported city without exposing the IANA path', () => {
  for (const saved of Intl.supportedValuesOf('timeZone')) {
    const rows = adminTimeZoneOptions(saved, 'zh', winter);
    expect(rows.some(row => row.value === saved)).toBe(true);
    expect(rows.every(row => !row.label.includes('/'))).toBe(true);
  }
  for (const saved of ['Etc/GMT+5', 'US/Eastern', 'UTC'])
    expect(adminTimeZoneOptions(saved).some(row => row.value === saved)).toBe(true);
});
