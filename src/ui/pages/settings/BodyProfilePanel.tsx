import {useFeature} from '../../useFeature';
import {useEffect,useRef,useState} from 'react';
import {bodyProfileService} from '../../../application/body-profile';
import {type BodyValues} from '../../../domain/body-profile';
import {bodyCopy} from '../../../i18n/features/onboarding/body';
import {BodyConversation} from '../onboarding/BodyConversation';
import {Button,MorphPanel} from '../../components/common';
import {useMainline} from '../../mainline/context';
import {TEXT_LIMITS,textIssue} from '../../../domain/input-guard';
import {repository} from '../../../persistence/repository';
import type {BodyWeightObservation} from '../../../domain/models';
export function BodyProfilePanel(){const c=useMainline();return <Button onClick={()=>c.navigate('/settings/body')}>{bodyCopy[c.locale].settingsTitle}</Button>}
export function BodyProfilePage(){const enabled=useFeature('bodyProfile'),c=useMainline(),t=bodyCopy[c.locale];const[values,setValues]=useState<BodyValues>({}),[text,setText]=useState(''),[open,setOpen]=useState(false),[revision,setRevision]=useState(0),[rows,setRows]=useState<BodyWeightObservation[]>([]),[message,setMessage]=useState('');const trigger=useRef<HTMLElement|null>(null);
 useEffect(()=>{let active=true;void Promise.all([bodyProfileService.read(),repository.db.bodyWeights.toArray()]).then(([details,weights])=>{if(active){setValues(details?.values??{});setRows(weights.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));setRevision(c.data?.metadata.dataRevision??0)}});return()=>{active=false}},[c.data?.metadata.dataRevision]);
 return <main className="v8-onboarding"><h1>{t.settingsTitle}</h1><p>{t.purpose}</p>{c.data?.profile?.bodyDetails?.source==='migrated'&&!c.data.profile.bodyDetails.confirmedAt&&<p>{t.migrated}</p>}{enabled&&<BodyConversation locale={c.locale} values={values} onChange={setValues} text={text} onTextChange={setText} busy={c.busy} required={false}/>} {enabled&&<Button disabled={c.busy||!!textIssue(text,TEXT_LIMITS.note)} onClick={()=>void c.run(async()=>{await bodyProfileService.save(values,revision);c.setAnswers({...c.answers,body:values,bodyText:'',...(values.age!==undefined&&values.age<18?{adultConfirmed:false}:{})});c.setCandidate(undefined);setText('');setMessage(t.saved)})}>{t.save}</Button>} {!enabled&&<dl>{Object.entries(values).map(([key,value])=><div key={key}><dt>{t.labels[key as keyof typeof t.labels]}</dt><dd>{key==='biologicalSex'?(value==='女性'?t.female:value==='男性'?t.male:t.private):value}</dd></div>)}</dl>}<p role="status">{message}</p>
 <h2>{t.history}</h2>{rows.length?<ul>{rows.map(row=><li key={row.id}><time dateTime={row.createdAt}>{new Intl.DateTimeFormat(c.locale,{dateStyle:'medium',timeStyle:'short',timeZone:c.data?.profile?.timeZone}).format(new Date(row.createdAt))}</time> · {row.weightGrams/1000} {t.kg}</li>)}</ul>:<p>{t.empty}</p>}
 <Button onClick={event=>{trigger.current=event.currentTarget;setOpen(true)}}>{t.remove}</Button><Button onClick={()=>c.navigate('/settings')}>{t.back}</Button>
 <MorphPanel open={open} onClose={()=>setOpen(false)} triggerRef={trigger} title={t.deleteTitle} closeLabel={t.cancel}><p>{t.deleteText}</p><Button disabled={c.busy} onClick={()=>void c.run(async()=>{await bodyProfileService.remove(revision);c.setAnswers({...c.answers,body:{},bodyText:''});c.setCandidate(undefined);setText('');setOpen(false);setMessage(t.deleted)})}>{t.remove}</Button><Button onClick={()=>setOpen(false)}>{t.cancel}</Button></MorphPanel></main>;
}
