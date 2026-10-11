import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { featureNames, parseFeatureFlags } from '../../src/domain/feature-flags';
const storage = new Map<string,string>();
beforeEach(() => { vi.resetModules(); storage.clear(); vi.stubGlobal('localStorage', {getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const response = (flags:object) => new Response(JSON.stringify({version:1,flags,expiresAt:Date.now()+60000}));
test('all features default off, unknown keys and truthy strings cannot enable', () => {
 expect(Object.values(parseFeatureFlags(undefined)).every(v=>!v)).toBe(true);
 expect(parseFeatureFlags('{invalid')).toEqual(parseFeatureFlags(null));
 expect(parseFeatureFlags({nutrition:'true',activityImport:true,admin:true})).toEqual({...parseFeatureFlags(null),activityImport:true});
 expect(Object.keys(parseFeatureFlags({}))).toEqual([...featureNames]);
});
test('expiry, offline, HTTP failures and invalid responses retain last success; only explicit false disables',async()=>{
 vi.useFakeTimers();const f=await import('../../src/application/feature-flags');
 const transport=vi.fn().mockResolvedValue(response({planLifecycle:true}));await f.refreshFeatureFlags(transport);
 expect(transport.mock.calls[0][1].credentials).toBe('omit');
 await vi.advanceTimersByTimeAsync(90000);expect(f.isFeatureEnabled('planLifecycle')).toBe(true);
 for(const fetcher of [vi.fn().mockRejectedValue(new Error('offline')),vi.fn().mockResolvedValue(new Response(null,{status:503})),vi.fn().mockResolvedValue(response({planLifecycle:'false'})),vi.fn().mockResolvedValue(response({}))]){
  await f.refreshFeatureFlags(fetcher);expect(f.isFeatureEnabled('planLifecycle')).toBe(true);
 }
 await f.refreshFeatureFlags(async()=>response({planLifecycle:false}));expect(f.isFeatureEnabled('planLifecycle')).toBe(false);
 vi.resetModules();expect((await import('../../src/application/feature-flags')).isFeatureEnabled('planLifecycle')).toBe(false);
});
test('last successful flags survive page/module reload while offline',async()=>{
 let f=await import('../../src/application/feature-flags');await f.refreshFeatureFlags(async()=>response({planLifecycle:true}));
 vi.resetModules();f=await import('../../src/application/feature-flags');expect(f.isFeatureEnabled('planLifecycle')).toBe(true);
 await f.refreshFeatureFlags(vi.fn().mockRejectedValue(new Error('offline')));expect(f.isFeatureEnabled('planLifecycle')).toBe(true);
});
test('storage denied or corrupt never prevents in-memory success',async()=>{
 storage.set('fitness.feature-flags.v1','{broken');const f=await import('../../src/application/feature-flags');expect(f.isFeatureEnabled('planLifecycle')).toBe(false);
 vi.stubGlobal('localStorage',{getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}});
 await f.refreshFeatureFlags(async()=>response({planLifecycle:true}));await f.refreshFeatureFlags(vi.fn().mockRejectedValue(Error('offline')));expect(f.isFeatureEnabled('planLifecycle')).toBe(true);
});
test('duplicate starts share one poller, background over 60 seconds retains flags and sends no requests',async()=>{
 vi.useFakeTimers();const doc=Object.assign(new EventTarget(),{visibilityState:'visible'}),win=new EventTarget(),nav={onLine:true};
 vi.stubGlobal('document',doc);vi.stubGlobal('window',win);vi.stubGlobal('navigator',nav);
 const fetcher=vi.fn(async()=>response({planLifecycle:true}));vi.stubGlobal('fetch',fetcher);
 const f=await import('../../src/application/feature-flags');const stop1=f.startFeatureFlags(),stop2=f.startFeatureFlags();await Promise.resolve();await Promise.resolve();
 await vi.advanceTimersByTimeAsync(0);expect(fetcher).toHaveBeenCalledTimes(1);
 doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(90000);
 expect(fetcher).toHaveBeenCalledTimes(1);expect(f.isFeatureEnabled('planLifecycle')).toBe(true);
 doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('online'));await vi.advanceTimersByTimeAsync(0);expect(fetcher).toHaveBeenCalledTimes(2);
 stop1();await vi.advanceTimersByTimeAsync(30000);expect(fetcher).toHaveBeenCalledTimes(3);
 nav.onLine=false;await vi.advanceTimersByTimeAsync(60000);expect(fetcher).toHaveBeenCalledTimes(3);expect(f.isFeatureEnabled('planLifecycle')).toBe(true);
 stop2();stop2();await vi.advanceTimersByTimeAsync(60000);expect(fetcher).toHaveBeenCalledTimes(3);
});
test('concurrent callers share a single pending network request',async()=>{
 const f=await import('../../src/application/feature-flags');let finish!:(value:Response)=>void;
 const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));const a=f.refreshFeatureFlags(fetcher),b=f.refreshFeatureFlags(fetcher);
 expect(a).toBe(b);expect(fetcher).toHaveBeenCalledTimes(1);finish(response({planLifecycle:true}));await a;
});
test.each([true,false])('startup requests once even when hidden (online=%s), then pauses polling',async(onLine)=>{
 vi.useFakeTimers();vi.stubGlobal('document',Object.assign(new EventTarget(),{visibilityState:'hidden'}));vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine});
 const fetcher=vi.fn(async()=>response({planLifecycle:true}));vi.stubGlobal('fetch',fetcher);
 const f=await import('../../src/application/feature-flags');const stop=f.startFeatureFlags(),stopAgain=f.startFeatureFlags();await vi.advanceTimersByTimeAsync(0);expect(fetcher).toHaveBeenCalledTimes(1);expect(f.isFeatureEnabled('planLifecycle')).toBe(true);
 await vi.advanceTimersByTimeAsync(90000);expect(fetcher).toHaveBeenCalledTimes(1);stop();stopAgain();
});

test('admin flag requests preserve Access cookies and expose failure without revoking last success',async()=>{
 vi.stubGlobal('location',{pathname:'/admin/users'});const f=await import('../../src/application/feature-flags');
 const transport=vi.fn<typeof fetch>(async()=>response({adminConsole:true}));await f.refreshFeatureFlags(transport);
 expect(transport.mock.calls[0][1]).toMatchObject({credentials:'same-origin'});expect(f.getFeatureLoadState()).toBe('ready');
 await f.refreshFeatureFlags(async()=>new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}}));
 expect(f.getFeatureLoadState()).toBe('error');expect(f.isFeatureEnabled('adminConsole')).toBe(true);
});

