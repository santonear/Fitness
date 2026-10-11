import {afterEach,expect,test,vi} from 'vitest';
afterEach(()=>{vi.useRealTimers();vi.resetModules()});
test('route changes share notices; failures retain valid notices, never expired ones',async()=>{
 vi.useFakeTimers();const {readAnnouncement}=await import('../../src/application/announcements');const now=Date.now(),notice={text:'Maintenance',start:now-1,end:now+120000};const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({announcement:notice})));
 expect(await readAnnouncement(fetcher)).toEqual(notice);expect(await readAnnouncement(fetcher)).toEqual(notice);expect(fetcher).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(60000);fetcher.mockRejectedValue(Error('offline'));expect(await readAnnouncement(fetcher)).toEqual(notice);await vi.advanceTimersByTimeAsync(60000);expect(await readAnnouncement(fetcher)).toBeNull();
});
