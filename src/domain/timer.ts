import type { TimerState, TimerEvent, TimerDisplay } from './models';
export function readTimer(state: TimerState, nowMs: number): TimerDisplay {
 const delta=state.status==='running' && state.startedAtMs!==undefined ? nowMs-state.startedAtMs : 0;
 const elapsedMs=Math.min(Number.MAX_SAFE_INTEGER,state.accumulatedMs+Math.max(0,delta));
 return {elapsedMs,clockReversed:delta<0,finished:state.targetMs!==undefined&&elapsedMs>=state.targetMs,
  ...(state.targetMs===undefined?{}:{remainingMs:Math.max(0,state.targetMs-elapsedMs)})};
}
export function transitionTimer(state: TimerState, event: TimerEvent, nowMs: number): TimerState {
 let next:TimerState;
 switch(event.type){
  case 'start': next={...state,status:'running',accumulatedMs:0,startedAtMs:nowMs};break;
  case 'pause': if(state.status!=='running')return state;next={...state,status:'paused',accumulatedMs:readTimer(state,nowMs).elapsedMs,startedAtMs:undefined};break;
  case 'resume': if(state.status!=='paused')return state;next={...state,status:'running',startedAtMs:nowMs};break;
  case 'stop': next={...state,status:'stopped',accumulatedMs:readTimer(state,nowMs).elapsedMs,startedAtMs:undefined};break;
  case 'reset': next={...state,status:'idle',accumulatedMs:0,startedAtMs:undefined};break;
 }
 return {...next,updatedAt:new Date(nowMs).toISOString(),revision:state.revision+1};
}
