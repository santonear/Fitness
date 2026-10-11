import {useId,useRef,useState} from 'react';
import {bodyFields,missingBodyFields,type BodyField,type BodyValues} from '../../../domain/body-profile';
import {wheelRanges} from '../../../domain/onboarding-v4';
import {parseBodyText} from '../../../application/rules/local-profile';
import {bodyCopy} from '../../../i18n/features/onboarding/body';
import {Button,Chip,MorphPanel} from '../../components/common';
import './onboarding.css';
export function BodyConversation({locale,values,onChange,text='',onTextChange,busy=false,required=true}:{locale:'zh'|'en';values:BodyValues;onChange:(value:BodyValues,text?:string)=>void;text?:string;onTextChange?:(text:string)=>void;busy?:boolean;required?:boolean}){
 const t=bodyCopy[locale],id=useId(),trigger=useRef<HTMLElement|null>(null),touch=useRef<number|undefined>(undefined),wheelAt=useRef(0);
 const [field,setField]=useState<BodyField>(),[selected,setSelected]=useState<string|number>(30);
 const missing=missingBodyFields(values);
 const label=(key:BodyField,value:string|number)=>key==='biologicalSex'?value==='女性'?t.female:value==='男性'?t.male:t.private:`${value} ${key==='age'?t.years:key==='weightKg'?t.kg:t.cm}`;
 const options=field==='biologicalSex'?['女性','男性','不愿透露']:field?Array.from({length:wheelRanges[field][1]-wheelRanges[field][0]+1},(_,i)=>wheelRanges[field][0]+i):[];
 const index=options.indexOf(selected as never);
 const move=(by:number)=>setSelected(options[Math.max(0,Math.min(options.length-1,index+by))]);
 const tag=(key:BodyField)=><Chip key={key} selected={values[key]!==undefined} disabled={busy} onClick={event=>{trigger.current=event.currentTarget;setField(key);setSelected(values[key]??({biologicalSex:'女性',age:30,heightCm:170,weightKg:65,waistCm:80}[key]))}}>{t.labels[key]} · {values[key]===undefined?t.unset:label(key,values[key]!)}</Chip>;
 return <section className="body-conversation"><label htmlFor={id}>{t.input}</label><textarea id={id} rows={3} value={text} placeholder={t.placeholder} disabled={busy} onChange={event=>{const next={...values};for(const key of Object.keys(parseBodyText(text)) as BodyField[])delete next[key];Object.assign(next,parseBodyText(event.target.value));onTextChange?.(event.target.value);onChange(next,event.target.value)}}/><p className="plan-muted">{t.privacy}</p><div className="v8-onboarding-choices">{bodyFields.filter(key=>key!=='waistCm').map(tag)}</div><details><summary>{t.waist}</summary>{tag('waistCm')}</details>{required&&missing.length>0&&<p role="status">{t.missing.replace('{fields}',missing.map(key=>t.labels[key]).join(locale==='zh'?'、':', '))}</p>}
 <MorphPanel open={!!field} onClose={()=>setField(undefined)} title={field?t.labels[field]:t.title} closeLabel={t.cancel} triggerRef={trigger}>
 {field&&<><div className="body-wheel" role="listbox" tabIndex={0} aria-label={t.labels[field]} aria-activedescendant={`${id}-option-${index}`} onKeyDown={event=>{if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();if(event.key==='Home')setSelected(options[0]);else if(event.key==='End')setSelected(options[options.length-1]);else move(event.key==='ArrowUp'?-1:1)}}} onWheel={event=>{if(Date.now()-wheelAt.current>80){wheelAt.current=Date.now();move(event.deltaY>0?1:-1)}}} onTouchStart={event=>{touch.current=event.touches[0].clientY}} onTouchMove={event=>{if(touch.current===undefined)return;const y=event.touches[0].clientY;if(Math.abs(touch.current-y)>12){move(touch.current>y?1:-1);touch.current=y}}} onTouchEnd={()=>{touch.current=undefined}}>
 {[-2,-1,0,1,2].map(offset=>{const value=options[index+offset];return value===undefined?<span key={offset} className="body-wheel-option" aria-hidden="true"/>:<button type="button" role="option" className="body-wheel-option" id={`${id}-option-${index+offset}`} aria-selected={offset===0} key={offset} tabIndex={-1} onClick={()=>setSelected(value)}>{label(field,value)}</button>})}</div><div className="v8-row"><Button aria-label={locale==='zh'?'减少':'Decrease'} disabled={index===0} onClick={()=>move(-1)}>−</Button><Button aria-label={locale==='zh'?'增加':'Increase'} disabled={index===options.length-1} onClick={()=>move(1)}>+</Button></div><Button onClick={()=>{onTextChange?.('');onChange({...values,[field]:selected},'');setField(undefined)}}>{t.confirm}</Button></>}
 </MorphPanel></section>;
}
