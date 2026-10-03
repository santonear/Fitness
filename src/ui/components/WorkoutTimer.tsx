import { useEffect, useRef, useState } from 'react';
import type { Locale, TimerEvent, TimerState } from '../../domain/models';
import { readTimer, transitionTimer } from '../../domain/timer';
import { timerService } from '../../application/timers';

interface Props {sessionId:string;exerciseInstanceId:string;locale:Locale;busy:boolean;onCandidate?:(seconds:string)=>void}
export function WorkoutTimer({sessionId,exerciseInstanceId,locale,busy,onCandidate}:Props){
 const zh=locale==='zh';
 const [timers,setTimers]=useState<TimerState[]>([]),[current,setCurrent]=useState<TimerState>();
 const [now,setNow]=useState(Date.now()),[ready,setReady]=useState(false),[saving,setSaving]=useState(false);
 const [rest,setRest]=useState('60'),[sound,setSound]=useState(false),[soundFailed,setSoundFailed]=useState(false);
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[reversed,setReversed]=useState(false);
 const audio=useRef<HTMLAudioElement|null>(null),announced=useRef(''),locked=useRef(false);
 useEffect(()=>{
  let live=true;
  void timerService.listTimers(sessionId).then(rows => {
    if (!live) return;
    const own = rows.filter(timer => timer.exerciseInstanceId === exerciseInstanceId);
    const activeTimer = own.find(timer => timer.status === 'running' || timer.status === 'paused');
    // Status is authoritative when the device clock has moved backwards.
    const latestInactive = [...own].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    setTimers(own);
    setCurrent(activeTimer ?? latestInactive);
    setReady(true);
  }).catch(error => {
    if (live) setError(error.message);
  });
  const interval=window.setInterval(()=>setNow(Date.now()),250);
  return ()=>{live=false;window.clearInterval(interval);};
 },[sessionId,exerciseInstanceId]);
 const display=current?readTimer(current,now):{elapsedMs:0,finished:false,clockReversed:false};
 useEffect(()=>{
  if(display.clockReversed)setReversed(true);
  if(!current||current.kind!=='rest'||!display.finished)return;
  const key=`${current.id}-${current.revision}`;if(announced.current===key)return;announced.current=key;
  if(sound&&audio.current)void audio.current.play().catch(()=>setSoundFailed(true));
 },[current,display.finished,display.clockReversed,sound]);
 async function change(event: TimerEvent, kind = current?.kind ?? 'exercise') {
  if (locked.current) return;
  locked.current = true;
  setSaving(true);
  setError('');
  setMessage('');
  try {
    const at = Date.now();
    const previous = timers.find(timer => timer.kind === kind);
    if (event.type === 'start' && kind === 'rest' && (
      !/^\d+$/.test(rest) || !Number.isSafeInteger(Number(rest) * 1000) || Number(rest) <= 0
    )) {
      throw new Error(zh ? '休息秒数需为正整数' : 'Rest seconds must be a positive integer');
    }
    const timestamp = new Date(at).toISOString();
    const initial: TimerState = {
      id: crypto.randomUUID(), sessionId, exerciseInstanceId, kind, status: 'idle', accumulatedMs: 0,
      createdAt: timestamp, updatedAt: timestamp, revision: 0,
    };
    const base = previous ?? initial;
    const candidate = transitionTimer({
      ...base,
      ...(kind === 'rest' && event.type === 'start' ? { targetMs: Number(rest) * 1000 } : {}),
    }, event, at);
    const next = { ...candidate, revision: previous ? candidate.revision : 0 };
    await timerService.saveTimer(next);
    setTimers(rows => [...rows.filter(timer => timer.id !== next.id), next]);
    setCurrent(next);
    setNow(at);
    setMessage(zh ? '计时已保存' : 'Timer saved');
    if (event.type === 'start') {
      setReversed(false);
      setSoundFailed(false);
      announced.current = '';
    }
    if (event.type === 'stop' && kind === 'exercise') {
      onCandidate?.(String(Math.floor(next.accumulatedMs / 1000)));
    }
  } catch (error) {
    setError(`${(error as { code?: string }).code ?? 'INVALID'}: ${(error as Error).message}`);
  } finally {
    locked.current = false;
    setSaving(false);
  }
 }
 const active=current?.status==='running'||current?.status==='paused';
 const disabled=busy||saving||!ready;
 return <div className="workout-timer" aria-label={zh?'计时器':'Workout timer'}>
  <p><strong>{current?.kind==='rest'?(zh?'休息':'Rest'):(zh?'动作计时':'Exercise timer')}</strong> · <output role="timer" aria-live="off" aria-label={zh?'计时秒数':'Timer seconds'}>{Math.floor((display.remainingMs??display.elapsedMs)/1000)}</output> {zh?'秒':'seconds'}</p>
  <button type="button" disabled={disabled||active} onClick={()=>void change({type:'start'},'exercise')}>{zh?'开始动作计时':'Start exercise timer'}</button>
  <label>{zh?'休息秒数':'Rest seconds'}<input inputMode="numeric" value={rest} disabled={disabled||active} onChange={e=>setRest(e.target.value)}/></label>
  <button type="button" disabled={disabled||active} onClick={()=>void change({type:'start'},'rest')}>{zh?'开始休息计时':'Start rest timer'}</button>
  {current?.status==='running'&&<button type="button" disabled={disabled} onClick={()=>void change({type:'pause'})}>{zh?'暂停计时':'Pause timer'}</button>}
  {current?.status==='paused'&&<button type="button" disabled={disabled} onClick={()=>void change({type:'resume'})}>{zh?'继续计时':'Resume timer'}</button>}
  {active&&<button type="button" disabled={disabled} onClick={()=>void change({type:'stop'})}>{zh?'停止计时':'Stop timer'}</button>}
  <label><input type="checkbox" checked={sound} onChange={e=>{setSound(e.target.checked);if(e.target.checked)audio.current=new Audio(reminderWav());}}/>{zh?'启用提醒声音':'Enable reminder sound'}</label>
  <p className="muted">{zh?'动作计时停止后仅填入候选时长，请核对后记录。休息不计入训练时长；锁屏提醒不保证。':'Stopping fills a duration candidate; review before recording. Rest is excluded from training duration. Lock-screen reminders are not guaranteed.'}</p>
  {current?.kind==='rest'&&display.finished&&<p role="alert">{zh?'休息结束':'Rest finished'}</p>}
  {(display.clockReversed||reversed)&&<p role="alert">{zh?'设备时钟倒退，请核对时长':'Device clock moved backwards; review duration'}</p>}
  {soundFailed&&<p role="alert">{zh?'声音不可用，视觉提醒仍有效':'Sound unavailable; visual reminder remains'}</p>}
  {error&&<p role="alert">{error}</p>}<p aria-live="polite">{message}</p>
 </div>;
}
function reminderWav(){
 const count=4000,bytes=new Uint8Array(44+count*2),view=new DataView(bytes.buffer);
 const text=(at:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[at+i]=value.charCodeAt(i);};
 text(0,'RIFF');view.setUint32(4,36+count*2,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,count*2,true);
 for(let i=0;i<count;i++)view.setInt16(44+i*2,Math.sin(2*Math.PI*660*i/8000)*6000*(1-i/count),true);
 return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}
