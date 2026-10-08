import { useId } from 'react';
import type { ReactNode } from 'react';
// Local vectors from the approved V5 prototype; no external runtime assets.
const ceramicShapes:Record<string,ReactNode>={
today:<><circle cx="32" cy="32" r="10"/><path d="M32 11v8 M32 45v8 M11 32h8 M45 32h8 M17 17l6 6 M41 41l6 6 M47 17l-6 6 M23 41l-6 6" className="ceramic-detail"/></>,
plans:<><rect x="16" y="18" width="32" height="30" rx="6"/><path className="ceramic-detail" d="M16 28h32 M24 13v11 M40 13v11 M24 35h3 M33 35h3 M42 35h2 M24 42h3 M33 42h3"/></>,
progress:<><rect x="17" y="34" width="8" height="14" rx="3"/><rect x="28" y="25" width="8" height="23" rx="3"/><rect x="39" y="16" width="8" height="32" rx="3"/></>,
exercises:<><rect x="14" y="22" width="7" height="20" rx="3"/><rect x="22" y="26" width="6" height="12" rx="2"/><rect x="36" y="26" width="6" height="12" rx="2"/><rect x="43" y="22" width="7" height="20" rx="3"/><rect x="25" y="30" width="14" height="4" rx="2"/></>,
settings:<><path d="M29 11h6l2 6 5 2 6-2 4 5-4 5v10l4 5-4 5-6-2-5 2-2 6h-6l-2-6-5-2-6 2-4-5 4-5V27l-4-5 4-5 6 2 5-2z"/><circle cx="32" cy="32" r="8" fill="var(--ceramic-top)" stroke="var(--ceramic-dark)" strokeWidth="2"/></>,
goal:<><circle cx="32" cy="32" r="18" fill="none" stroke="var(--ceramic-dark)" strokeWidth="6"/><circle cx="32" cy="32" r="9"/><circle cx="32" cy="32" r="3" fill="var(--ceramic-top)"/></>,
age:<><path d="M22 14h20l-5 12-5 7 5 7 5 10H22l5-10 5-7-5-7z"/></>,
height:<><rect x="24" y="12" width="16" height="40" rx="4"/><path className="ceramic-detail" d="M28 21h8 M28 28h5 M28 35h8 M28 42h5"/></>,
weight:<><path d="M22 26h20l5 22H17z"/><path className="ceramic-detail" d="M27 25v-5a5 5 0 0 1 10 0v5"/></>,
waist:<><path d="M19 22c5-8 21-8 26 0v20c-6 9-20 9-26 0z"/><path className="ceramic-detail" d="M20 31c7 3 17 3 24 0 M24 35v5 M31 35v5 M38 35v5"/></>,
home:<><path d="M13 30 32 15l19 15v19H13z"/><rect x="27" y="34" width="10" height="15" rx="2" fill="var(--ceramic-top)"/></>,
leaf:<><path d="M14 46C12 25 25 13 48 14c2 24-13 35-34 32z"/><path className="ceramic-detail" d="M20 43c5-10 12-16 22-23"/></>,
clock:<><circle cx="32" cy="32" r="19"/><path className="ceramic-detail" d="M32 19v14l10 6"/></>,
heart:<><path d="M32 49 14 32c-10-15 6-23 18-10 12-13 28-5 18 10z"/></>,
flame:<><path d="M32 12c3 11-1 16 5 22 3-2 4-5 4-8 16 20 2 28-9 28-14 0-25-16 0-42z"/></>,
shield:<><path d="M32 12 49 19v12c0 12-8 19-17 23-9-4-17-11-17-23V19z"/><path d="m24 32 6 6 11-12" className="ceramic-detail"/></>,
sparkles:<><path d="m32 12 6 14 14 6-14 6-6 14-6-14-14-6 14-6z"/></>,
bolt:<><path d="M35 10 18 35h14l-3 19 18-29H33z"/></>,
person:<><circle cx="32" cy="21" r="8"/><path d="M17 50c0-13 7-19 15-19s15 6 15 19z"/></>,
office:<><rect x="19" y="15" width="26" height="36" rx="3"/><path className="ceramic-detail" d="M26 24h4 M35 24h4 M26 32h4 M35 32h4 M26 40h4 M35 40h4"/></>,
band:<><path d="M17 38c-7-17 11-29 25-17 12 13-1 30-16 24-8-3-12-13-9-17" fill="none" stroke="var(--ceramic-symbol)" strokeWidth="8"/></>,
treadmill:<><rect x="16" y="35" width="33" height="9" rx="3"/><path className="ceramic-detail" d="M20 17h15v17 M18 48h33"/></>,
run:<><circle cx="38" cy="15" r="6"/><path className="ceramic-detail" d="M33 22l-8 10 13 6 M32 28l12 5 M32 35l-8 14 M37 37l11 12"/></>,
check:<><circle cx="32" cy="32" r="19"/><path className="ceramic-detail" d="m21 33 8 8 15-17"/></>,
recovery:<><path d="M32 46c-10-8-18-13-18-22 0-8 8-13 18-5 10-8 18-3 18 5 0 9-8 14-18 22z"/></>,
edit:<><path d="m18 43 5-14 19-16 9 9-18 19z"/><path className="ceramic-detail" d="m23 29 10 12"/></>,
};
const actionPaths={
  "back": "M15 5l-7 7 7 7",
  "next": "M9 5l7 7-7 7",
  "up": "M5 15l7-7 7 7",
  "down": "M5 9l7 7 7-7",
  "add": "M12 5v14M5 12h14",
  "minus": "M5 12h14",
  "close": "M5 5l14 14M19 5 5 19",
  "menu": "M4 6h16M4 12h16M4 18h16",
  "favorite": "m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z",
  "warning": "M12 3 2 21h20ZM12 9v5M12 17v1",
  "error": "M5 5l14 14M19 5 5 19",
  "success": "m4 12 5 5L20 6",
  "pending": "M5 3h14M5 21h14M7 3v5l5 4-5 4v5M17 3v5l-5 4 5 4v5",
  "copy": "M9 8h11v13H9ZM4 16V3h11",
  "save": "M4 3h13l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8",
  "download": "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  "upload": "M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4",
  "trash": "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  "play": "m7 3 14 9-14 9Z",
  "pause": "M8 4v16M16 4v16",
  "refresh": "M20 8A8 8 0 1 0 20 16M20 3v5h-5",
  "filter": "M3 4h18l-7 8v7l-4 2V12Z",
  "link": "M8 16 20 4M12 4h8v8M4 8v12h12",
  "info": "M12 11v7M12 6v1"
} as const;
export type IconName = 'today'|'plans'|'progress'|'exercises'|'settings'|'goal'|'age'|'height'|'weight'|'waist'|'home'|'leaf'|'clock'|'heart'|'flame'|'shield'|'sparkles'|'bolt'|'person'|'office'|'band'|'treadmill'|'run'|'check'|'recovery'|'edit' | keyof typeof actionPaths;
export function AppIcon({name,ceramic=false}:{name:IconName;ceramic?:boolean}) {
 const id=useId().replaceAll(':','');
 if(!ceramic&&name in actionPaths)return <svg className="app-action-icon" data-icon={name} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={actionPaths[name as keyof typeof actionPaths]}/></svg>;
 return <svg className="ceramic-svg" data-icon={name} viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id={id+'tile'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--ceramic-top)"/><stop offset="1" stopColor="var(--ceramic-bottom)"/></linearGradient><linearGradient id={id+'figure'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--ceramic-light)"/><stop offset=".6" stopColor="var(--ceramic-symbol)"/><stop offset="1" stopColor="var(--ceramic-dark)"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="19" fill={'url(#'+id+'tile)'} stroke="var(--ceramic-stroke)" strokeWidth="1.4"/><path d="M9 20Q9 9 20 9H44" fill="none" stroke="white" opacity=".7" strokeWidth="2" strokeLinecap="round"/><g className="ceramic-figure" fill={'url(#'+id+'figure)'} stroke="var(--ceramic-dark)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ceramicShapes[name]}</g></svg>;
}
export function StatusIcon({status}:{status:'success'|'warning'|'error'|'pending'}) {return <span className={'app-status-icon status-'+status}><AppIcon name={status}/></span>;}
