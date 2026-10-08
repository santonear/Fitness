import { AppIcon, StatusIcon } from './AppIcon';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { profileService } from '../../application/profile';
import { guidedService } from '../../application/guided';
import { useTranslation } from 'react-i18next';
export function OnboardingGate({children}:{children:ReactNode}) {
  const location=useLocation();const {i18n}=useTranslation();const zh=i18n.resolvedLanguage==='zh';
  const [result,setResult]=useState<{path:string;required:boolean;error?:string}>();
  const check=location.pathname==='/'||location.pathname==='/ai';
  useEffect(()=>{
    let live=true;
    if(check)void profileService.initialize(zh?'zh':'en').then(()=>guidedService.onboardingEntry()).then(r=>{
      const unfinishedV4=location.pathname==='/ai' && r.state.onboarding?.version===4 && !r.state.onboarding.completed;
      if(live)setResult({path:location.key,required:r.required || unfinishedV4});
    }).catch(e=>{if(live)setResult({path:location.key,required:false,error:String(e)});});
    return()=>{live=false;};
  },[location.pathname,location.key,check]);
  if(check&&result?.path!==location.key)return <p role="status"><AppIcon name="info"/>{zh?'正在读取本地资料…':'Loading local profile…'}</p>;
  if(check&&result?.required)return <Navigate to="/onboarding" replace/>;
  return <>{result?.error&&<p role="alert"><StatusIcon status="warning"/>{result.error}</p>}{children}</>;
}

