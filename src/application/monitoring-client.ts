import { isFeatureEnabled } from './feature-flags';
import { monitoringError, type AnonymousEvent, type SafeErrorEvent } from './monitoring';
const optKey='fitness.anonymous-usage';
let counts: Partial<Record<AnonymousEvent,number>> = {};
const reported = new Set<string>();
export const anonymousUsageEnabled = () => { try { return localStorage.getItem(optKey)==='true'; } catch { return false; } };
export function setAnonymousUsage(enabled:boolean) { localStorage.setItem(optKey,String(enabled)); if(!enabled)counts={}; }
export function countUsage(event:AnonymousEvent, count=1) {
 if(!isFeatureEnabled('anonymousUsage')||!anonymousUsageEnabled()||!Number.isSafeInteger(count)||count<1)return;
 counts[event]=Math.min(1000,(counts[event]??0)+count);
}
export async function flushUsage() {
 if(!isFeatureEnabled('anonymousUsage')||!anonymousUsageEnabled()){counts={};return;}
 const batch=counts; counts={};
 for(const [event,count] of Object.entries(batch)) {
  if(!isFeatureEnabled('anonymousUsage')||!anonymousUsageEnabled())return;
  // No persistent queue/identifier and no automatic retry: a lost count is preferable to duplication.
  try { await fetch('/api/v1/telemetry/counts',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({optedIn:true,event,count}),keepalive:true}); } catch { /* optional aggregate */ }
 }
}
export function reportSafeError(type:SafeErrorEvent['type']) {
 const path=location.pathname, page:SafeErrorEvent['page']=path==='/onboarding'?'onboarding':path.startsWith('/workout')?'training':path.startsWith('/plans')?'plan':path==='/review'?'review':path.startsWith('/settings')?'settings':'other';
 const agent=navigator.userAgent, browser:SafeErrorEvent['browser']=/Firefox/.test(agent)?'firefox':/Chrome|Chromium|Edg/.test(agent)?'chromium':/Safari/.test(agent)?'safari':'other';
 const event=monitoringError({type,page,version:'v8',browser},isFeatureEnabled('errorReports'));
 const key=`${type}:${page}`;if(!event||reported.has(key)||reported.size>=10)return;reported.add(key);
 void fetch('/api/v1/telemetry/errors',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)}).catch(()=>{});
}
export function startMonitoring() {
 const error=()=>reportSafeError('unexpected');window.addEventListener('error',error);window.addEventListener('unhandledrejection',error);
 const timer=setInterval(()=>void flushUsage(),60_000);
 return()=>{clearInterval(timer);window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',error);};
}
