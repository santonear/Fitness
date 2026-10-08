import { AppIcon } from '../AppIcon';
import { useEffect, useRef } from 'react';
export function V4Wheel({label,values,value,sample,unit,onChange,zh}:{label:string;values:readonly number[];value?:number;sample:number;unit:string;onChange:(n:number)=>void;zh:boolean}) {
  const drag=useRef<{id:number;kind:string;y:number} | undefined>(undefined);
  const element=useRef<HTMLDivElement>(null); const current=value??sample; const index=values.indexOf(current);
  const move=(delta:number)=>onChange(values[Math.max(0,Math.min(values.length-1,index+delta))]);
  const moveRef=useRef(move);moveRef.current=move;
  useEffect(()=>{const node=element.current;if(!node)return;const wheel=(event:WheelEvent)=>{event.preventDefault();if(event.deltaY)moveRef.current(event.deltaY>0?1:-1);};node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);},[]);
  return <div className="ob4-wheel-group"><span className="ob4-label">{label}</span><div ref={element} className="ob4-wheel" role="spinbutton" tabIndex={0} aria-label={label} aria-valuemin={values[0]} aria-valuemax={values.at(-1)} aria-valuenow={current} aria-valuetext={`${current} ${unit}${value===undefined?(zh?'，示例，未确认':', sample, unconfirmed'):''}`}
    onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='Home')onChange(values[0]);else if(e.key==='End')onChange(values[values.length-1]);else move(e.key==='ArrowUp'?1:-1);}}}
    onPointerDown={e=>{if((e.target as HTMLElement).closest('button'))return;drag.current={id:e.pointerId,kind:e.pointerType,y:e.clientY};if(e.isTrusted)e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{const active=drag.current;if(active&&active.id===e.pointerId&&active.kind===e.pointerType&&Math.abs(e.clientY-active.y)>=20){move(e.clientY<active.y?1:-1);active.y=e.clientY;}}}
    onPointerUp={()=>{drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;}}>
    <button type="button" tabIndex={-1} aria-label={`${label} −`} disabled={index===0} onClick={()=>move(-1)}><AppIcon name="minus"/></button>
    <span aria-hidden="true" className="ob4-wheel-neighbor">{values[index-1]??'—'}</span><strong>{current}<small>{unit}</small></strong><span aria-hidden="true" className="ob4-wheel-neighbor">{values[index+1]??'—'}</span>
    <button type="button" tabIndex={-1} aria-label={`${label} +`} disabled={index===values.length-1} onClick={()=>move(1)}><AppIcon name="add"/></button>
  </div><button type="button" className="ob4-wheel-confirm" onClick={()=>onChange(current)}>{value===undefined?(zh?'确认此数值':'Confirm value'):(zh?'已选择':'Selected')}</button></div>;
}
