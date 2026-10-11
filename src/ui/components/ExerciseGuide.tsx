import { useState, type RefObject } from 'react';
import { getExerciseGuide } from '../../catalog/exercise-guide';
import type { Locale } from '../../domain/models';
import { MorphPanel } from './common';
import { RepDBAttribution } from './RepDBAttribution';
import { RepDBMedia } from './RepDBMedia';
import { exerciseVisualMetadata } from '../../catalog/exercise-visual';
import zh from '../../i18n/features/training/guide.zh.json';
import en from '../../i18n/features/training/guide.en.json';
import './exercise-guide.css';

export function ExerciseGuideImage({id,locale}:{id:string;locale:Locale}) {
 const guide=getExerciseGuide(id,locale),copy=locale==='zh'?zh:en;
 const [failed,setFailed]=useState(false);
 return <figure className="exercise-guide-image">
  {guide.media&&!failed?<img src={guide.media.src} alt={guide.media.alt} onError={()=>setFailed(true)}/>:<figcaption>{copy.unavailable}</figcaption>}
 </figure>;
}
export function ExerciseGuideAttribution({id,locale}:{id:string;locale:Locale}) {
 const media=getExerciseGuide(id,locale).media;
 return media?.attribution.includes('RepDB')?<RepDBAttribution/>:media?.attribution?<small>{media.attribution==='Fitness original illustration'?(locale==='zh'?zh:en).original:media.attribution}</small>:null;
}
export function ExerciseGuidePanel({id,locale,open,onClose,triggerRef}:{id?:string;locale:Locale;open:boolean;onClose:()=>void;triggerRef:RefObject<HTMLElement|null>}) {
 const guide=id?getExerciseGuide(id,locale):undefined,copy=locale==='zh'?zh:en;
 return <MorphPanel open={open&&!!guide} onClose={onClose} triggerRef={triggerRef} title={guide?.name??copy.details} closeLabel={copy.close}>
  {guide&&id&&<div className="exercise-guide-detail">{exerciseVisualMetadata(id)?<RepDBMedia exerciseId={id} exerciseName={guide.name} locale={locale}/>:<><ExerciseGuideImage key={id} id={id} locale={locale}/><ExerciseGuideAttribution id={id} locale={locale}/></>}
   <h3>{copy.points}</h3><ul>{guide.keyPoints.map((v,i)=><li key={i}>{v}</li>)}</ul>
   <h3>{copy.steps}</h3><ol>{guide.steps.map((v,i)=><li key={i}>{v}</li>)}</ol>
   {!!guide.mistakes.length&&<><h3>{copy.mistakes}</h3><ul>{guide.mistakes.map((v,i)=><li key={i}>{v}</li>)}</ul></>}
   {!!guide.cautions.length&&<><h3>{copy.cautions}</h3><ul>{guide.cautions.map((v,i)=><li key={i}>{v}</li>)}</ul></>}
  </div>}
 </MorphPanel>;
}
