import {useEffect,useState} from 'react';
import {assistantPreferences} from '../../../persistence/assistant-preferences';
import type {AiMemoryNote} from '../../../domain/models';
import {exercises} from '../../../catalog/exercises';
import {equipmentLabel} from '../../../catalog/taxonomy';
import {Button} from '../../components/common';

const days={mon:['周一','Mon'],tue:['周二','Tue'],wed:['周三','Wed'],thu:['周四','Thu'],fri:['周五','Fri'],sat:['周六','Sat'],sun:['周日','Sun']} as const;
const cautions={knee:['膝盖','Knee'],lower_back:['腰背','Lower back'],shoulder:['肩','Shoulder'],wrist:['手腕','Wrist'],other:['其他','Other']} as const;
function noteText(note:AiMemoryNote,locale:'zh'|'en'){
 const zh=locale==='zh',value=note.value;
 if(note.kind==='dislike_exercise')return `${zh?'以后不安排':'Avoid'} ${exercises.find(exercise=>exercise.id===value)?.name[locale]??value}`;
 if(note.kind==='cannot_do')return value==='jumping'?(zh?'避免跳跃':'Avoid jumping'):`${zh?'避免':'Avoid'} ${value}`;
 if(note.kind==='caution_area')return `${zh?'注意部位：':'Caution: '}${cautions[value as keyof typeof cautions]?.[zh?0:1]??value}`;
 if(note.kind==='preferred_days')return `${zh?'训练日：':'Training days: '}${(Array.isArray(value)?value:[]).map(day=>days[day as keyof typeof days]?.[zh?0:1]??day).join(zh?'、':', ')}`;
 return `${zh?'可用器械：':'Equipment: '}${(Array.isArray(value)?value:[]).map(item=>equipmentLabel(item,locale)).join(zh?'、':', ')}`;
}
export function AssistantPreferencesPanel({locale}:{locale:'zh'|'en'}){
 const [rows,setRows]=useState<AiMemoryNote[]>([]),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void assistantPreferences.list().then(value=>{if(alive)setRows(value)}).catch(()=>{if(alive)setError(locale==='zh'?'无法读取已记住的偏好。':'Could not load saved preferences.')});return()=>{alive=false}},[locale]);
 return <section aria-label={locale==='zh'?'芽芽记住的偏好':'Yaya saved preferences'}><h2>{locale==='zh'?'芽芽记住的偏好':'Yaya saved preferences'}</h2><p>{locale==='zh'?'这里只保存你确认过的长期偏好。删除后，芽芽之后的建议不会再使用它。':'Only preferences you confirmed are saved here. Delete one to stop using it in future suggestions.'}</p>{error&&<p role="alert">{error}</p>}{rows.length?<ul>{rows.map(note=><li key={note.id}>{noteText(note,locale)} <Button onClick={()=>void assistantPreferences.remove([note.id]).then(()=>setRows(current=>current.filter(row=>row.id!==note.id))).catch(()=>setError(locale==='zh'?'删除失败，请重试。':'Could not delete. Try again.'))}>{locale==='zh'?'删除':'Delete'}</Button></li>)}</ul>:<p>{locale==='zh'?'暂无已记住的偏好。':'No saved preferences yet.'}</p>}</section>;
}
