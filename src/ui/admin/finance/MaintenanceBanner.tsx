import {useEffect,useState} from 'react';
import {readAnnouncement} from '../../../application/announcements';
import type {Announcement} from '../../../backend/admin/finance/runtime';
import {financeCopy,type FinanceLanguage} from './copy';
import './finance.css';
/** Public endpoint contains only the operator's currently active announcement. */
export function MaintenanceBanner({training,language='zh'}:{training:boolean;language?:FinanceLanguage}){
 const[notice,setNotice]=useState<Announcement|null>(null),[closed,setClosed]=useState('');
 useEffect(()=>{if(training)return;let alive=true;async function load(){const next=await readAnnouncement();if(alive)setNotice(next)}void load();const timer=setInterval(()=>void load(),60000);return()=>{alive=false;clearInterval(timer)}},[training]);
 const id=notice?`${notice.start}:${notice.end}:${notice.text}`:'';
 if(training||!notice||Date.now()<notice.start||Date.now()>=notice.end||closed===id)return null;
 return <div className="maintenance-line"><span>{notice.text}</span><button aria-label={financeCopy[language].dismiss} onClick={()=>setClosed(id)}>×</button></div>;
}
