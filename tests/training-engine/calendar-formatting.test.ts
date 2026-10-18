import {afterEach,expect,it,vi} from 'vitest';
import {calendarDay} from '../../src/engine/data';
afterEach(()=>vi.restoreAllMocks());

it('reuses a zone formatter without freezing its daylight-saving offset',()=>{
 const NativeFormatter=Intl.DateTimeFormat,formatter=vi.spyOn(Intl,'DateTimeFormat').mockImplementation(function(locales,options){return new NativeFormatter(locales,options);});
 expect(calendarDay('2026-03-08T04:30:00Z','America/New_York')).toBe('2026-03-07');
 expect(calendarDay('2026-03-08T07:30:00Z','America/New_York')).toBe('2026-03-08');
 expect(calendarDay('2026-11-01T03:30:00Z','America/New_York')).toBe('2026-10-31');
 expect(calendarDay('2026-11-01T06:30:00Z','America/New_York')).toBe('2026-11-01');
 expect(formatter).toHaveBeenCalledTimes(1);
});
it('keeps explicit zones, date-only input and invalid input independent',()=>{
 expect(calendarDay('2026-10-15T00:30:00Z','Asia/Shanghai')).toBe('2026-10-15');
 expect(calendarDay('2026-10-15T00:30:00Z','America/Los_Angeles')).toBe('2026-10-14');
 expect(calendarDay('2026-10-15','Not/A_Zone')).toBe('2026-10-15');
 expect(calendarDay('not-a-date','Asia/Shanghai')).toBeUndefined();
 expect(calendarDay('2026-10-15T00:30:00Z','Not/A_Zone')).toBeUndefined();
 expect(calendarDay('2026-10-15T00:30:00Z','Asia/Shanghai')).toBe('2026-10-15');
});
it('bounds formatter retention while continuing to format evicted zones correctly',()=>{
 const NativeFormatter=Intl.DateTimeFormat,formatter=vi.spyOn(Intl,'DateTimeFormat').mockImplementation(function(locales,options){return new NativeFormatter(locales,options);});
 const zones=['Europe/London','Europe/Paris','Europe/Berlin','Europe/Rome','Europe/Madrid','Europe/Lisbon','Europe/Athens','Europe/Helsinki','Europe/Oslo','Europe/Stockholm','Europe/Vienna','Europe/Warsaw','Europe/Prague','Europe/Zurich','Europe/Brussels','Europe/Istanbul','Asia/Tokyo'];
 for(const zone of zones)expect(calendarDay('2026-01-15T12:00:00Z',zone)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
 expect(formatter).toHaveBeenCalledTimes(17);
 expect(calendarDay('2026-01-15T12:00:00Z',zones.at(-1)!)).toBe('2026-01-15');expect(formatter).toHaveBeenCalledTimes(17);
 expect(calendarDay('2026-01-15T12:00:00Z',zones[0])).toBe('2026-01-15');expect(formatter).toHaveBeenCalledTimes(18);
});
