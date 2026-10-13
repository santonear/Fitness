/** Parse explicit session lengths without changing the legacy onboarding wheel. */
export function sessionDuration(text: string): number | undefined {
  const normalized = text.replace(/一个半小时/g, '1.5小时').replace(/半小时/g, '0.5小时').replace(/一个小时|一小时/g, '1小时');
  const values = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(小时|小時|hours?|hrs?|分钟|分鐘|minutes?|mins?)/gi)]
    .filter(match => !/(?:不是|不要|别|not|no)[^,，。;；]*$/i.test(normalized.slice(Math.max(0,(match.index??0)-16), match.index)))
    .map(match => Number(match[1]) * (/小时|小時|hour|hr/i.test(match[2]) ? 60 : 1));
  const range = normalized.match(/(\d+)\s*[-–—~～至到]\s*(\d+)\s*(?:分钟|minutes?|mins?)/i);
  if (range && !/延长|最多|到|up to|maximum/i.test(normalized)) return Math.min(120, Math.max(15, Number(range[1])));
  if (!values.length) return undefined;
  const minutes = /延长|最多|到|up to|maximum|\bto\b/i.test(normalized) ? Math.max(...values) : values.at(-1)!;
  return Math.min(120, Math.max(15, Math.round(minutes)));
}
