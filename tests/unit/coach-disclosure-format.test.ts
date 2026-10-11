import {describe,it,expect} from 'vitest';
import {displayTimeZone,instructionRepeatsLatestMessage} from '../../src/coach/disclosure-format';
import {coachScopeFields} from '../../src/coach/consent';
import type {CoachRequest} from '../../src/coach/contracts';
describe('coach disclosure presentation',()=>{
 it('formats whole and fractional offsets and follows daylight saving without altering IANA values',()=>{
  const winter=new Date('2026-01-15T12:00:00Z'),summer=new Date('2026-07-15T12:00:00Z');
  expect(displayTimeZone('Asia/Shanghai','zh',winter)).toBe('东八区（UTC+8）');
  expect(displayTimeZone('Asia/Kolkata','zh',winter)).toContain('UTC+5:30');
  expect(displayTimeZone('America/New_York','en',winter)).toContain('UTC-5');
  expect(displayTimeZone('America/New_York','en',summer)).toContain('UTC-4');
  expect(displayTimeZone('UTC','zh',winter)).toContain('UTC');
  expect(displayTimeZone('invalid','zh',winter)).toBe('invalid');
 });
 it('references only an identical latest user message and retains the entire raw payload',()=>{
  const request={task:'ADJUST_TODAY',timeZone:'Asia/Shanghai',instruction:'时间不够',messages:[{role:'user',content:'时间不够'}],sendConfirmation:'preview'} as CoachRequest;
  const before=structuredClone(request);expect(instructionRepeatsLatestMessage(request)).toBe(true);
  expect(coachScopeFields(request)).toEqual(Object.entries(before).filter(([key])=>key!=='sendConfirmation').map(([key,value])=>({key,value:typeof value==='string'?value:JSON.stringify(value)})));
  expect(instructionRepeatsLatestMessage({...request,messages:[...request.messages,{role:'user',content:'今天膝盖不舒服'}]})).toBe(false);
  expect(request).toEqual(before);
 });
});
