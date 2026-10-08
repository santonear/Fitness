import { AppIcon } from './AppIcon';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
export function DateCalendar({locale,today,selected,onChange,onActive,occupied}:{locale:'en'|'zh';today:string;selected:string[];onChange:Dispatch<SetStateAction<string[]>>;onActive:(date:string)=>void;occupied:string[]}) {
  const zh=locale==='zh';const [month,setMonth]=useState(today.slice(0,7));const grid=useRef<HTMLDivElement>(null);
  const gesture=useRef<{before:string[];add:boolean;seen:Set<string>}|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const touchStart=useRef<{x:number;y:number;date:string}|null>(null);
  function clearTimer(){if(timer.current){clearTimeout(timer.current);timer.current=null;}}
  function apply(date:string){const g=gesture.current;if(!g||g.seen.has(date))return;g.seen.add(date);onChange(values=>g.add?[...new Set([...values,date])].sort():values.filter(value=>value!==date));onActive(date);}
  function start(date:string){gesture.current={before:[...selected],add:!selected.includes(date),seen:new Set()};apply(date);}
  function stop(){clearTimer();touchStart.current=null;gesture.current=null;}
  function cancel(){clearTimer();if(gesture.current)onChange(gesture.current.before);gesture.current=null;touchStart.current=null;}
  useEffect(()=>{function escape(event:KeyboardEvent){if(event.key==='Escape'&&gesture.current){cancel();event.preventDefault();}}window.addEventListener('keydown',escape);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',cancel);return()=>{window.removeEventListener('keydown',escape);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',cancel);};},[]);
  useEffect(()=>{const element=grid.current;function preventScroll(event:TouchEvent){if(gesture.current)event.preventDefault();}element?.addEventListener('touchmove',preventScroll,{passive:false});return()=>{clearTimer();element?.removeEventListener('touchmove',preventScroll);};},[]);
  const first=new Date(`${month}-01T00:00:00Z`);const offset=(first.getUTCDay()+6)%7;
  const dates=Array.from({length:42},(_,index)=>{const date=new Date(first);date.setUTCDate(1-offset+index);return date.toISOString().slice(0,10);});
  function move(delta:number){const date=new Date(first);date.setUTCMonth(date.getUTCMonth()+delta);setMonth(date.toISOString().slice(0,7));}
  return <div className="date-calendar" onKeyDown={event=>{if(event.key==='Escape'){cancel();event.preventDefault();}}}>
    <div className="date-calendar-header"><button type="button" aria-label={zh?'上个月':'Previous month'} onClick={()=>move(-1)}><AppIcon name="back"/></button>
      <label>{zh?'日历月份':'Calendar month'}<input type="month" required value={month} onChange={event=>{if(/^\d{4}-\d{2}$/.test(event.target.value)&&Number(event.target.value.slice(0,4))>=1&&Number(event.target.value.slice(5))>=1&&Number(event.target.value.slice(5))<=12)setMonth(event.target.value);}} /></label>
      <button type="button" aria-label={zh?'下个月':'Next month'} onClick={()=>move(1)}><AppIcon name="next"/></button></div>
    <p className="muted">{zh?'点击或拖选具体日期；触屏长按后拖选，滚动不会自动选择。选择不保存计划。':'Click or drag exact dates. On touch, hold before dragging; scrolling does not select. Selection does not save plans.'}</p>
    <div className="date-calendar-grid" ref={grid} onPointerUp={event=>{if(event.pointerType==='touch'&&touchStart.current&&!gesture.current)start(touchStart.current.date);stop();}}
      onPointerCancel={cancel} onPointerMove={event=>{if(touchStart.current&&!gesture.current&&Math.hypot(event.clientX-touchStart.current.x,event.clientY-touchStart.current.y)>10){clearTimer();touchStart.current=null;}
        if(gesture.current){const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-cal-date]');if(cell&&grid.current?.contains(cell))apply(cell.dataset.calDate!);}}}>
      {(zh?['一','二','三','四','五','六','日']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).map(day=><span className="date-calendar-weekday" key={day}>{day}</span>)}
      {dates.map(date=><button type="button" key={date} data-cal-date={date} aria-label={date} aria-pressed={selected.includes(date)}
        className={`${date.slice(0,7)!==month?'outside-month ':''}${occupied.includes(date)?'occupied ':''}${date===today?'today':''}`}
        onPointerDown={event=>{if(event.button!==0)return;if(event.pointerType==='touch'){touchStart.current={x:event.clientX,y:event.clientY,date};clearTimer();timer.current=setTimeout(()=>{start(date);timer.current=null;},350);}else{start(date);}}}
        onPointerEnter={event=>{if(event.pointerType!=='touch'&&event.buttons===1)apply(date);}}
        onClick={event=>{if(event.detail===0){start(date);stop();}}}
        onKeyDown={event=>{const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key as 'ArrowLeft'];if(delta!==undefined){event.preventDefault();const index=dates.indexOf(date)+delta;if(dates[index])grid.current?.querySelector<HTMLButtonElement>(`[data-cal-date="${dates[index]}"]`)?.focus();}}}>
        {Number(date.slice(8))}{occupied.includes(date)&&<span aria-hidden="true"> ·</span>}
      </button>)}
    </div>
    <p>{zh?'已选择日期':'Selected dates'}: {selected.join(' · ')|| (zh?'无':'None')}</p>
  </div>;
}
