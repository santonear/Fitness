import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CoachPanel} from '../../../src/ui/components/CoachPanel';
import type {CoachRequest} from '../../../src/coach/contracts';
import '../../../src/themes/base/tokens.css';
import '../../../src/themes/qingci/tokens.css';
import '../../../src/themes/base/common.css';
const id='11111111-1111-4111-8111-111111111111';
const request:CoachRequest={version:'fitness-coach-v8',requestId:id,conversationId:id,restoreGeneration:0,inputSnapshot:'revision:0',sendConfirmation:'preview',locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[],task:'ONBOARD_PLAN',profile:{goalText:'养成运动习惯',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'每周两次',place:'home',equipment:[],adultConfirmed:true,cautions:[]},body:{age:25},history:'不应默认发送的记录'};
function Fixture(){const[open,setOpen]=useState(false);return <main><button onClick={()=>setOpen(true)}>跟芽芽说</button><CoachPanel open={open} onClose={()=>setOpen(false)} request={request} expectedRevision={0} onApply={async()=>{}}/></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
