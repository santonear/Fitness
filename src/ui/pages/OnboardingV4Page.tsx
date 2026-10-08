import { StatusIcon } from '../components/AppIcon';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { guidedService } from '../../application/guided';
import { profileService } from '../../application/profile';
import { onboardingKeys, wheelRanges, durations, answered, localAgeAccess, type Answer, type OnboardingKey } from '../../domain/onboarding-v4';
import { questionTitles, optionLabels, customLabels, displayAnswer } from '../components/guided/onboarding-v4-content';
import { AppIcon } from '../components/AppIcon';
import { stageKeys, storedStep, visibleStep, bodyKeys, finishBody } from '../../domain/onboarding-v5';
import { V4Wheel } from '../components/guided/V4Wheel';

export function OnboardingV4Page() {
  const {i18n}=useTranslation();const zh=i18n.resolvedLanguage==='zh';const locale=zh?'zh':'en';const tr=(a:string,b:string)=>zh?a:b;const navigate=useNavigate();
  const [answers,setAnswers]=useState<Record<string,Answer>>({}); const [step,setStep]=useState(0); const [ready,setReady]=useState(false); const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [complete,setComplete]=useState(false);
  const revision=useRef(0);const latest=useRef<Record<string,Answer>>({});const pending=useRef(Promise.resolve());const failed=useRef(false);const title=useRef<HTMLHeadingElement>(null);
  const currentStep=useRef(0);currentStep.current=step;
  useEffect(()=>{let live=true;void profileService.initialize(locale).then(()=>guidedService.read()).then(data=>{if(!live)return;revision.current=data.revision;latest.current=guidedService.v4Answers(data);setAnswers(latest.current);setStep(data.onboarding?.version===4?visibleStep(data.onboarding.step):0);setComplete(Boolean(data.onboarding?.version===4&&data.onboarding.completed));setReady(true);}).catch(e=>setError(String(e)));return()=>{live=false;};},[]);
  useEffect(()=>{title.current?.focus();},[step]);
  const persist=(values:Record<string,Answer>,nextStep:number,deferred=false)=>{
    setComplete(false);setBusy(true);pending.current=pending.current.then(async()=>{
      if(failed.current)return;
      try{await guidedService.saveV4(values,storedStep(nextStep),revision.current,deferred);revision.current++;}
      catch(e){failed.current=true;setError(tr('保存失败或资料已变化，请重新打开此页核对。未发送AI。','Save failed or data changed. Reopen this page to review. Nothing was sent to AI.')+' '+String(e));}
    }).finally(()=>setBusy(false));return pending.current;
  };
  function update(key:OnboardingKey,answer:Answer){const next={...latest.current,[key]:answer};latest.current=next;setAnswers(next);void persist(next,currentStep.current);}
  async function go(next:number,skip=false){if(step===2){latest.current=finishBody(latest.current);setAnswers(latest.current);}else if(skip){const values={...latest.current,[stageKeys[step]]:{status:'skipped' as const}};latest.current=values;setAnswers(values);}await persist(latest.current,next);if(!failed.current)setStep(next);}
  async function leave(){if(complete){navigate('/');return;}await persist(latest.current,step,true);if(!failed.current)navigate('/');}
  const key=stageKeys[step] as OnboardingKey;const value=key?answered(answers,key):undefined;
  const selected=Array.isArray(value)?value:typeof value==='string'?[value.split('\n')[0]]:[];
  const options=optionLabels[key]??[];const custom=Array.isArray(value)?value.filter(v=>!options.some(o=>o[0]===v)).join('\n'):key==='experience'&&typeof value==='string'?value.split('\n').slice(1).join('\n'):'';
  function pick(item:string){if(key==='biologicalSex')update(key,{status:'answered',value:item});else if(key==='experience')update(key,{status:'answered',value:[item,custom].filter(Boolean).join('\n')});else{let next=selected.includes(item)?selected.filter(v=>v!==item):[...selected,item];if(key==='safety')next=item==='无已知限制'?[item]:next.filter(v=>v!=='无已知限制');update(key,next.length?{status:'answered',value:next}:{status:'skipped'});}}
  function writeCustom(text:string){const known=selected.filter(v=>options.some(o=>o[0]===v)&&!(key==='safety'&&text.trim()&&v==='无已知限制'));const values=[...known,...(text.trim()?[text]:[])];update(key,values.length?{status:'answered',value:key==='experience'?[known[0]??'',text].join('\n'):values}:{status:'skipped'});}
  const ageAccess=localAgeAccess(answers);
  if(!ready)return <p role="status"><AppIcon name="info"/>{error||tr('正在读取本地资料…','Loading local answers…')}</p>;
  return <div className="ob4"><aside className="ob4-intro"><span>FITNESS · START TOGETHER</span><h1>{tr('先了解你，再一起开始。','A starting point that is yours.')}</h1><p>{tr('一步一个问题，按自己的节奏。资料保存在这个浏览器，确认发送前不会交给 AI。','One question at a time. Your answers stay in this browser until you explicitly agree to send them.')}</p><p>{tr('可以返回修改、跳过未知信息，或暂时去手动训练。','Go back, leave unknown answers blank, or take a break for a manual workout.')}</p></aside>
    <section className="ob4-card" aria-label={tr('新手引导','Onboarding')}><div className="ob4-progress"><span>{step<10?`${step+1} / 10`:tr('资料汇总','Your summary')}</span><span>{tr('本地资料','Local profile')}</span></div><progress max={10} value={step<10?step+1:10}/>
      <h2 ref={title} tabIndex={-1}>{step<10?(step===2?tr('基础身体信息','Basic body information'):questionTitles[key][zh?0:1]):tr('这些，是你的出发点。','Your starting point.')}</h2>
      {error&&<p role="alert"><StatusIcon status="error"/>{error}</p>}
      {step<10?<><p className="ob4-hint">{tr('请选择或填写；不确定时可以跳过。','Choose or enter an answer. Skip if you are unsure.')}</p><div className="ob4-question">
        {options.length>0&&<div className="ob4-options" role="group" aria-label={questionTitles[key][zh?0:1]}>{options.map(([id,label])=><button type="button" key={id} aria-pressed={selected.includes(id)} onClick={()=>pick(id)}><AppIcon name={choiceIcon(id,key)} ceramic />{zh?(key==='biologicalSex'?id==='女性'?'女':'男':id):label}</button>)}</div>}
        {step===2&&<><div className="ob5-metrics" role="group" aria-label={tr('基础身体信息','Body measurements')}>{bodyKeys.map(item=><div key={item}><V4Wheel label={item==='heightCm'?tr('身高','Height'):item==='weightKg'?tr('体重','Weight'):tr('腰围','Waist')} zh={zh} values={Array.from({length:wheelRanges[item][1]-wheelRanges[item][0]+1},(_,i)=>wheelRanges[item][0]+i)} sample={item==='heightCm'?170:item==='weightKg'?70:80} value={typeof answered(answers,item)==='number'?answered(answers,item) as number:undefined} unit={item==='weightKg'?'kg':'cm'} onChange={value=>update(item,{status:'answered',value})}/><button className="ob5-unknown" onClick={()=>update(item,{status:'skipped'})}>{item==='waistCm'?tr('跳过腰围','Skip waist'):tr('保持未知','Leave unknown')}</button></div>)}</div><p className="ob4-hint">{tr('身高和体重建议填写，腰围可跳过。未确认的示例数字不会保存为事实。','Height and weight are recommended; waist is optional. Unconfirmed sample values are not saved as facts.')}</p></>}
        {key in wheelRanges&&(()=>{const [min,max]=wheelRanges[key as keyof typeof wheelRanges];return <V4Wheel label={questionTitles[key][zh?0:1]} zh={zh} values={Array.from({length:max-min+1},(_,i)=>min+i)} sample={key==='age'?25:key==='heightCm'?170:key==='weightKg'?70:80} value={typeof value==='number'?value:undefined} unit={key==='age'?tr('岁','years'):key==='weightKg'?'kg':'cm'} onChange={value=>update(key,{status:'answered',value})}/>;})()}
        {customLabels[key]&&<label className="ob4-custom">{customLabels[key]![zh?0:1]}<textarea maxLength={500} value={custom} onChange={e=>writeCustom(e.target.value)}/></label>}
        {key==='schedule'&&<div className="ob4-schedule">{[['训练启动时间','Training start time'],['每次训练时长','Session duration']].map(([cn,en],i)=><V4Wheel key={cn} label={tr(cn,en)} zh={zh} values={i===0?Array.from({length:24},(_,n)=>n):durations} sample={i===0?19:30} value={Array.isArray(value)&&value[i]!==''?Number(value[i]):undefined} unit={i===0?tr('点','h'):tr('分钟','min')} onChange={n=>{const pair=Array.isArray(value)?[...value]:['',''];pair[i]=String(n);setSchedule(pair);}}/>)}</div>}
        {key==='preferences'&&<label className="ob4-custom">{tr('其他偏好说明（可选）','Other preferences (optional)')}<textarea maxLength={500} value={typeof value==='string'?value:''} onChange={e=>update(key,e.target.value.trim()?{status:'answered',value:e.target.value}:{status:'skipped'})}/></label>}
        {key==='age'&&ageAccess==='minor'&&<p role="status"><AppIcon name="info"/>{tr('12–17岁可使用本地引导和手动训练。成人AI训练建议暂不开放。','Ages 12–17 can use local onboarding and manual workouts. Adult AI advice is unavailable.')}</p>}
      </div></>:<div className="ob4-summary">{onboardingKeys.map((item,index)=><article key={item}><div><strong>{questionTitles[item][zh?0:1]}</strong><p>{answered(answers,item)===undefined?tr('未知 / 已跳过','Unknown / skipped'):item==='schedule'?`${(answered(answers,item) as string[])[0]}:00 · ${(answered(answers,item) as string[])[1]} ${tr('分钟','min')}`:displayAnswer(answered(answers,item)!,locale)+(item in wheelRanges ? ' '+(item==='age'?tr('岁','years'):item==='weightKg'?'kg':'cm'):'')}</p></div><button onClick={()=>void go(visibleStep(index))}>{tr('修改','Edit')} {visibleStep(index)+1}</button></article>)}<p>{tr('资料体重不会自动记入身体测量历史。','Profile weight does not create a measurement history entry.')}</p>{ageAccess!=='adult'&&<p>{tr('年龄未确认成年时，不开放成人AI；手动训练不受影响。','Adult AI is unavailable until adult eligibility is confirmed. Manual workouts remain available.')}</p>}</div>}
      <div className="ob4-actions"><button disabled={busy||failed.current} onClick={()=>step?void go(step-1):void leave()}>{step?tr('上一步','Back'):tr('暂时离开','Leave for now')}</button>{step<10?<><button disabled={busy||failed.current} onClick={()=>void go(step+1,true)}>{step===2?tr('跳过未填项','Skip remaining'):tr('跳过此题','Skip')}</button><button className="ob4-primary" disabled={busy||failed.current||(step===2?!bodyKeys.some(k=>answers[k]):!answers[key])||(key==='schedule'&&Array.isArray(value)&&value.includes(''))} onClick={()=>void go(step+1)}>{tr('下一步 →','Next →')}</button></>:<button className="ob4-primary" disabled={busy||failed.current} onClick={()=>void confirm()}>{complete?tr('继续','Continue'):tr('确认资料','Confirm profile')}</button>}</div>
      {step>0&&<button className="ob4-leave" disabled={busy} onClick={()=>void leave()}>{tr('保存进度，先去手动训练','Save progress and train manually')}</button>}
      {complete&&<Link to={ageAccess==='adult'?'/ai':'/plans'}>{ageAccess==='adult'?tr('开始 AI 创建计划','Continue to AI planning'):tr('手动安排训练','Plan manually')}</Link>}
    </section></div>;
  function setSchedule(pair:string[]){ // Persist partial choices; advancing requires both wheels to be confirmed.
    const next={...latest.current,schedule:{status:'answered' as const,value:pair}};latest.current=next;setAnswers(next);
    void persist(next,step);
  }
  async function confirm(){await pending.current;if(failed.current)return;setBusy(true);try{await guidedService.completeOnboarding(revision.current);revision.current++;setComplete(true);navigate(ageAccess==='adult'?'/ai':'/plans');}catch(e){setError(String(e));}finally{setBusy(false);}}
}




function choiceIcon(id:string,key:string): import('../components/AppIcon').IconName {
const icons:Record<string,import('../components/AppIcon').IconName>={'减脂':'flame','增肌':'exercises','提升力量':'bolt','提升耐力':'run','改善灵活性':'leaf','保持健康':'heart','家里':'home','健身房':'exercises','户外':'leaf','公司健身区':'office','徒手':'person','哑铃':'exercises','弹力带':'band','跑步机':'treadmill','壶铃':'weight','杠铃':'exercises','无已知限制':'check'};return icons[id]??(key==='safety'?'shield':'person');}
