/** Per-device display preferences for V9.14 pages, stored like the other 训练设置 switches (timer sound, rest vibration). */
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };

export const outlineKey = 'fitness.bodyOutline';
export const figureSexKey = 'fitness.figureSex';
export const voiceKey = 'fitness.voiceCues';
export const intentionKey = 'fitness.intention';
export const spokenKey = 'fitness.bodyChangeSpoken';

/** 显示体型轮廓: on unless the person turned it off. */
export const outlineShown = () => read(outlineKey) !== 'off';
export const setOutlineShown = (value: boolean) => write(outlineKey, value ? 'on' : 'off');
export const lastFigureSex = (): 'male' | 'female' | undefined => { const value = read(figureSexKey); return value === 'male' || value === 'female' ? value : undefined; };
export const setLastFigureSex = (value: 'male' | 'female') => write(figureSexKey, value);
/** Voice cues are off by default. */
export const voiceOn = () => read(voiceKey) === 'on';
export const setVoiceOn = (value: boolean) => write(voiceKey, value ? 'on' : 'off');
/** The person's own words, shown on 今天 as written; never sent anywhere. */
export const intention = () => read(intentionKey) ?? '';
export const setIntention = (text: string) => write(intentionKey, text.trim().slice(0, 80));
export function lastSpoken(): Record<string, string> {
  try { const value: unknown = JSON.parse(read(spokenKey) ?? '{}'); return value && typeof value === 'object' ? value as Record<string, string> : {}; } catch { return {}; }
}
export const markSpoken = (kind: string, localDate: string) => write(spokenKey, JSON.stringify({ ...lastSpoken(), [kind]: localDate }));
