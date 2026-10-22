import {Rules,calendarDay} from '../../../engine/data';
import {cautionJoints} from '../../../application/caution-safety';
import {useMainline,workflow} from '../../mainline/context';
import {Button} from '../../components/common';
import { DAY_MS } from '../../../domain/local-date';
const rules=new Rules();
/** A next-morning answer links to a real performed joint, never an inferred symptom. */
export function CautionMorningControls(){
 const {data,locale,busy,run}=useMainline();if(!data?.state?.coachProfile?.healthStorageConsent)return null;
 const zone=data.profile?.timeZone??'Asia/Shanghai',today=calendarDay(new Date().toISOString(),zone)!,labels=rules.get('caution.activation')[locale==='zh'?'ui_label_zh':'ui_label_en'];
 return <section>{cautionJoints.flatMap(joint=>{
  if(!data.state?.coachProfile?.cautions?.includes(joint))return [];
  const record=data.workouts.filter(row=>['complete','partial'].includes(row.status)&&row.endedAt&&row.sets.some(set=>(rules.byExercise.get(set.exerciseId)?.joint_load[joint]??0)>0)).sort((a,b)=>Date.parse(b.endedAt!)-Date.parse(a.endedAt!))[0];
  if(!record)return [];const ended=calendarDay(record.endedAt!,zone)!;
  if(Date.parse(today+'T00:00:00Z')-Date.parse(ended+'T00:00:00Z')!==DAY_MS)return [];
  return [<fieldset key={joint} disabled={busy}><legend>{labels[joint]}</legend><p>{locale==='zh'?'上次的疼痛是否持续到第二天早上':'Did the pain from your last session last until the next morning?'}</p>{([true,false] as const).map(answer=><Button key={String(answer)} onClick={()=>void run(async()=>{await workflow.reportCautionMorning({workoutId:record.id,joint,painLastedToNextMorning:answer},data.metadata.dataRevision);})}>{locale==='zh'?(answer?'是':'否'):(answer?'Yes':'No')}</Button>)}</fieldset>];
 })}</section>;
}
