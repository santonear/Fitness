import { useState } from 'react';
import { buildCoachRequest } from '../../../coach/request-builder';
import { coachMessageScope } from '../../../coach/consent';
import { CoachScopeDisclosure } from '../../components/CoachPanel';
import coachZh from '../../../i18n/features/coach/zh.json';
import coachEn from '../../../i18n/features/coach/en.json';
import { Button, Composer } from '../../components/common';
import { useMainline, format } from '../../mainline/context';
import { exercises } from '../../../catalog/exercises';
import { createV8DataService } from '../../../persistence/v8-access';
import { repository } from '../../../persistence/repository';
import { CoachVisual } from '../../components/CoachVisual';
export function NextPage(){
 const {data,facts,t,slots,name,start,navigate,busy,run,openCoach,locale,sendHomeCoach}=useMainline(); const [choice,setChoice]=useState<string>();
 const [message,setMessage]=useState('');const coachCopy=locale==='zh'?coachZh:coachEn;
 const version=data?.version, templates=version?.templates??[];
 const last=data?.workouts.filter(w=>w.planVersionId===version?.id&&w.status!=='in_progress'&&w.status!=='abandoned').sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
 const suggested=templates[(templates.findIndex(s=>s.id===last?.templateId)+1)%Math.max(1,templates.length)];
 const original=templates.find(s=>s.id===choice)??suggested;
 const override=data?.state?.nextWorkoutOverride;
 const selected=override&&original&&override.planVersionId===version?.id&&override.templateId===original.id ? {...override!.template,id:original!.id}:original;
 const homeRequest=data?buildCoachRequest({task:'ADJUST_TODAY',data,templateId:selected?.id}):undefined;
 const homePreview=homeRequest?coachMessageScope(homeRequest,message.slice(0,1600)):undefined;
 const acknowledge=(reminders=false)=>void run(async()=>{await createV8DataService(repository).acknowledgeMigrationNotice();if(reminders)navigate('/settings#reminders');});
 const lastSelected=data?.workouts.filter(w=>w.templateId===selected?.id&&w.planVersionId===version?.id&&w.status!=='abandoned').sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
 return <main><div className="v8-topline"><h1>{t.next}</h1><Button onClick={()=>navigate('/settings')}>{t.settings}</Button></div>
 {data?.state?.notice&&!data.state.notice.acknowledged&&(data.state.notice.planCount>1||data.hasFutureLegacyDates)&&<section className="v8-inline-panel">
 {data.state.notice.planCount>1&&<p>{format(t.migrationPlans,{count:data.state.notice.planCount,name:data.state.notice.currentPlanName??data.plan?.name??''})}</p>}
 {data.hasFutureLegacyDates&&<><p>{t.migrationDates}</p><Button onClick={()=>acknowledge(true)}>{t.setReminder}</Button></>}
 <Button onClick={()=>acknowledge()}>{data.hasFutureLegacyDates?t.dismissMigration:t.understood}</Button></section>}
 {facts&&version&&<slots.WeekProgress complete={facts.complete} partial={facts.partial} target={version.weeklyTarget} label={format(t.week,{complete:facts.complete,partial:facts.partial})}/>}
 {data?.active&&<Button onClick={()=>navigate(`/workout/${data.active!.id}`)}>{t.ongoing}</Button>}
 {selected?<><slots.FeatureCard context="next" motionReduced={false} trainingActive={false}><slots.StartHero {...selected} templateId={selected.id} templateLabel={selected.name} nextLabel={t.next} startLabel={t.start} disabled={busy||!!data?.active} onStart={()=>void start(selected.id)}/><p className="v8-center">{lastSelected?.status==='partial'?t.partialReason:format(t.reason,{minutes:selected.estimatedMinutes})}</p></slots.FeatureCard>
 <p>{t.details}</p><div className="v8-capsules">{selected.items.map((item,index)=><details key={index}><summary>{name(item.exerciseId)} · {item.sets} {t.sets}</summary><p>{exercises.find(e=>e.id===item.exerciseId)?.steps[data?.profile?.locale??'zh'].join(' ')}</p></details>)}</div>
 <div className="v8-row"><Button disabled={templates.length<2} onClick={()=>setChoice(templates[(templates.findIndex(item=>item.id===selected.id)+1)%templates.length].id)}>{t.switch}</Button><Button onClick={()=>navigate('/manual')}>{t.manual}</Button></div></>:<Button variant="primary" onClick={()=>navigate('/onboarding')}>{t.create}</Button>}
 <Button onClick={()=>navigate('/activity')}>{t.recordActivity}</Button>
 {homePreview&&<section><CoachScopeDisclosure request={homePreview} locale={locale}/><Composer value={message} onChange={value=>setMessage(value.slice(0,1600))} label={coachCopy.input} sendLabel={coachCopy.send} disabled={busy} onSend={()=>{if(homePreview&&message.trim())sendHomeCoach(homePreview,message);}}/></section>}
 <Button disabled={busy} onClick={()=>openCoach('ADJUST_TODAY',selected?.id)}><CoachVisual/>{t.askCoach}</Button>
 </main>;
}
