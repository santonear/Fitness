import { describe, it, expect } from 'vitest';
import { readTimer, transitionTimer } from '../../src/domain/timer';
import type { TimerState } from '../../src/domain/models';
const idle: TimerState = { id:'a',sessionId:'s',createdAt:'2026-10-03T00:00:00.000Z',updatedAt:'2026-10-03T00:00:00.000Z',revision:0,kind:'exercise',status:'idle',accumulatedMs:0 };
describe('timestamp timer',()=>{
 it('starts, pauses, resumes and stops without counting paused time',()=>{
  const started=transitionTimer(idle,{type:'start'},1000);
  expect(started.status).toBe('running');
  const paused=transitionTimer(started,{type:'pause'},4000);
  expect(readTimer(paused,9000).elapsedMs).toBe(3000);
  const resumed=transitionTimer(paused,{type:'resume'},9000);
  const stopped=transitionTimer(resumed,{type:'stop'},11000);
  expect(stopped.status).toBe('stopped');expect(readTimer(stopped,50000).elapsedMs).toBe(5000);
 });
 it('reads delayed displays directly from timestamp rather than ticks',()=>{
  const state={...idle,status:'running' as const,startedAtMs:1000,accumulatedMs:500};
  expect(readTimer(state,101000).elapsedMs).toBe(100500);
  expect(state.accumulatedMs).toBe(500);
 });
 it('reports reversed clock and clamps elapsed nonnegative',()=>{
  const state={...idle,status:'running' as const,startedAtMs:5000};
  expect(readTimer(state,1000)).toMatchObject({elapsedMs:0,clockReversed:true});
  expect(transitionTimer(state,{type:'stop'},1000).accumulatedMs).toBe(0);
 });
 it('marks rest finished with nonnegative remaining time',()=>{
  expect(readTimer({...idle,kind:'rest',status:'running',startedAtMs:1000,targetMs:3000},5000)).toMatchObject({elapsedMs:4000,remainingMs:0,finished:true});
 });
 it('reset clears elapsed and start restarts a stopped timer',()=>{
  const stopped={...idle,status:'stopped' as const,accumulatedMs:3000};
  expect(transitionTimer(stopped,{type:'start'},9000)).toMatchObject({status:'running',accumulatedMs:0,startedAtMs:9000});
  expect(transitionTimer(stopped,{type:'reset'},9000)).toMatchObject({status:'idle',accumulatedMs:0});
 });
});
