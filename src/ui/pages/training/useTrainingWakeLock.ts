import { useEffect } from 'react';
/** Release on pause/navigation; reacquire only while visible and still training. */
export function useTrainingWakeLock(enabled:boolean){
 useEffect(()=>{let ended=false;let sentinel:WakeLockSentinel|undefined;
 const acquire=async()=>{if(ended||document.visibilityState!=='visible'||!navigator.wakeLock)return;try{const next=await navigator.wakeLock.request('screen');if(ended)await next.release();else sentinel=next;}catch{/* Optional browser capability; training remains usable. */}};
 if(enabled){void acquire();document.addEventListener('visibilitychange',acquire);}
 return()=>{ended=true;document.removeEventListener('visibilitychange',acquire);void sentinel?.release();};
 },[enabled]);
}
