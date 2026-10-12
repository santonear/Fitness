import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CoachPanel,type CoachPanelProps} from '../../../src/ui/components/CoachPanel';
import {basicProposal} from '../../../src/application/v8-workflow';
import type {CoachRequest} from '../../../src/coach/contracts';
import '../../../src/themes/base/tokens.css';
import '../../../src/themes/qingci/tokens.css';
import '../../../src/themes/base/common.css';
const id='11111111-1111-4111-8111-111111111111';
const request:CoachRequest={version:'fitness-coach-v8',requestId:id,conversationId:id,restoreGeneration:0,inputSnapshot:'revision:0',sendConfirmation:'preview',locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[],task:'ONBOARD_PLAN',profile:{goalText:'养成运动习惯',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'每周两次',place:'home',equipment:[],adultConfirmed:true,cautions:[]},body:{age:25,heightCm:180},history:'不应默认发送的记录'};
const {profile:_profile,...common}=request;
const adjust:CoachRequest={...common,task:'ADJUST_TODAY',target:{planId:id,versionId:id,revision:0},instruction:'时间不够',template:basicProposal({...request.profile,sessionMinutes:30,scheduleOriginalText:'每次30分钟',confirmedAt:'2026-10-10T00:00:00Z'})!.templates[0]};
function Fixture(){const[open,setOpen]=useState(false);const[local,setLocal]=useState(false);const[review,setReview]=useState(false);const[initialSend,setInitialSend]=useState<CoachPanelProps['initialSend']>();return <main><button onClick={()=>setOpen(true)}>跟芽芽说</button><button onClick={()=>{setInitialSend({nonce:'explicit-home-send',message:'首页已确认的话',request,expectedRevision:0});setOpen(true);}}>首页发送</button><CoachPanel initialSend={initialSend} open={open} onClose={()=>setOpen(false)} request={location.search.includes('missing')?undefined:location.search.includes('local-adjust')?adjust:request} expectedRevision={0} onApply={async()=>{const failure=new URLSearchParams(location.search).get('apply-error');if(failure)throw Error(failure);if(location.search.includes('apply-test')){const result=await fetch('/fixture/apply',{method:'POST'});if(!result.ok)throw Error('fixture save failed');}}} onLocalReview={()=>{setReview(true);setOpen(false);}} onLocalPlan={()=>{setLocal(true);setOpen(false);}}/>{review&&<p>本周回顾已打开</p>}{local&&<p>基础计划入口已打开</p>}</main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
