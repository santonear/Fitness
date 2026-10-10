import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { liveQuery } from 'dexie';
import { repository } from '../../persistence/repository';
import { restoreChannelName, restoreEventName, restoreStorageKey } from '../../application/backup';
import i18n from '../../i18n';
import zh from '../../i18n/features/training/zh.json';
import en from '../../i18n/features/training/en.json';

/** Unmount stale editors synchronously before a restored repository accepts writes. */
export function RestoreBoundary({children}:{children:ReactNode}){
 const [key,setKey]=useState(0),[blocked,setBlocked]=useState(false),[error,setError]=useState(false),[restored,setRestored]=useState(false);
 const t=i18n.resolvedLanguage==='en'?en:zh;
 useEffect(()=>{
  let generation:number|undefined,active=true,restoring=false;
  async function reset(){
   if(restoring||!active)return;restoring=true;
   flushSync(()=>{setBlocked(true);setError(false);});
   try{
    const meta=await repository.readMetadata(),profile=await repository.db.profiles.toCollection().first();
    generation=meta.restoreGeneration??0;repository.adoptGeneration(generation);
    if(profile)await i18n.changeLanguage(profile.locale);
    if(active){setKey(k=>k+1);setBlocked(false);setRestored(true);}
   }catch{if(active)setError(true);}finally{restoring=false;}
  }
  async function check(){const meta=await repository.readMetadata();const value=meta.restoreGeneration??0;if(generation!==undefined&&generation!==value)await reset();else generation=value;}
  const subscription=liveQuery(()=>repository.db.metadata.toCollection().first()).subscribe({next:meta=>{if(!meta)return;const value=meta.restoreGeneration??0;if(generation!==undefined&&generation!==value)void reset();else generation=value;},error:()=>{}});
  const onRestore=(event:Event)=>{if((event as CustomEvent).detail?.databaseName===repository.db.name)void reset();};
  const onStorage=(event:StorageEvent)=>{if(event.key===restoreStorageKey(repository.db.name))void check().catch(()=>{});};
  window.addEventListener(restoreEventName,onRestore);window.addEventListener('storage',onStorage);
  const channel=typeof BroadcastChannel==='undefined'?undefined:new BroadcastChannel(restoreChannelName);
  if(channel)channel.onmessage=event=>{if(event.data?.databaseName===repository.db.name)void check().catch(()=>{});};
  return()=>{active=false;subscription.unsubscribe();channel?.close();window.removeEventListener(restoreEventName,onRestore);window.removeEventListener('storage',onStorage);};
 },[]);
 return blocked?<main role={error?'alert':'status'}>{error?t.loadError:t.loading}</main>:<div key={key} className="v8-restored-library">{restored&&<p role="status" data-testid="restore-result">{t.restoreSucceeded}</p>}{children}</div>;
}
