import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CoachPanel} from '../../../src/ui/components/CoachPanel';
import type {CoachRequest} from '../../../src/coach/contracts';
import '../../../src/themes/base/tokens.css';
import '../../../src/themes/qingci/tokens.css';
import '../../../src/themes/base/common.css';
const id='11111111-1111-4111-8111-111111111111';
const request:CoachRequest={version:'fitness-coach-v8',requestId:id,conversationId:id,restoreGeneration:0,inputSnapshot:'revision:0',sendConfirmation:'preview',locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[],task:'ONBOARD_PLAN',profile:{goalText:'养成运动习惯',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'每周两次',place:'home',equipment:[],adultConfirmed:true,cautions:[]},body:{age:25},history:'不应默认发送的记录'};
function Fixture(){const[open,setOpen]=useState(false);const[local,setLocal]=useState(false);return <main><button onClick={()=>setOpen(true)}>跟芽芽说</button><CoachPanel open={open} onClose={()=>setOpen(false)} request={location.search.includes('missing')?undefined:request} expectedRevision={0} onApply={async()=>{if(location.search.includes('apply-test')){const result=await fetch('/fixture/apply',{method:'POST'});if(!result.ok)throw Error('fixture save failed');}}} onLocalPlan={()=>{setLocal(true);setOpen(false);}}/>{local&&<p>基础计划入口已打开</p>}</main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
