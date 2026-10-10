import { afterEach, expect, test, vi } from 'vitest';
const mocks=vi.hoisted(()=>({configure:vi.fn().mockResolvedValue(undefined),suspend:vi.fn(),background:vi.fn(),disable:vi.fn().mockResolvedValue(true)}));
vi.mock('../../src/application/pwa',()=>({configurePwa:mocks.configure,suspendSystemNotifications:mocks.suspend}));
vi.mock('../../src/application/pwa-push',()=>({configureBackgroundPush:mocks.background,disableBackgroundPush:mocks.disable}));
import { startFeatureRuntime } from '../../src/application/feature-runtime';
import { refreshFeatureFlags } from '../../src/application/feature-flags';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
test('a delayed removal cannot restore an obsolete feature configuration',async()=>{
 vi.stubGlobal('navigator',{onLine:true});vi.stubGlobal('localStorage',{setItem:vi.fn(),getItem:()=>null});
 let finish!:()=>void;mocks.disable.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;})).mockResolvedValue(true);
 const stop=startFeatureRuntime();const publish=(flags:object)=>refreshFeatureFlags(async()=>new Response(JSON.stringify({version:1,flags,expiresAt:Date.now()+60000})));
 await publish({pwaOffline:true});await publish({});await Promise.resolve();finish();await Promise.resolve();await Promise.resolve();
 expect(mocks.configure).toHaveBeenCalledTimes(1);expect(mocks.configure).toHaveBeenLastCalledWith({offlineEnabled:false,notificationsEnabled:false});stop();
});
