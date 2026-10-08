import { useId } from 'react';

export type CoachVisualState = 'idle' | 'thinking' | 'replying' | 'success';

/** Original vector artwork; ceramic sprout character, no remote image dependencies. */
export function CoachAvatar({ state = 'idle' }: { state?: CoachVisualState }) {
  const id = useId().replace(/:/g, '');
  return <svg className="coach-avatar" data-state={state} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}-shell`} cx="32%" cy="22%" r="85%"><stop stopColor="#fffef2"/><stop offset=".5" stopColor="var(--coach-glaze)"/><stop offset="1" stopColor="var(--coach-shadow)"/></radialGradient>
      <linearGradient id={`${id}-leaf`} x2="1" y2="1"><stop stopColor="#bdd49f"/><stop offset="1" stopColor="#557d61"/></linearGradient>
      <radialGradient id={`${id}-face`} cx="35%" cy="25%"><stop stopColor="#718674"/><stop offset="1" stopColor="#354c42"/></radialGradient>
    </defs>
    <ellipse cx="60" cy="108" rx="33" ry="5" fill="var(--coach-shadow)" opacity=".18"/>
    <g className="coach-avatar-body">
      <path d="M61 29 Q57 10 38 12 Q37 30 61 29 M61 28 Q63 9 81 9 Q84 27 61 28" fill={`url(#${id}-leaf)`}/>
      <path d="M59 33 Q60 21 65 17" fill="none" stroke="#6b8d69" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="60" cy="67" rx="43" ry="39" fill={`url(#${id}-shell)`}/>
      <ellipse cx="46" cy="43" rx="18" ry="7" fill="#fff" opacity=".35" transform="rotate(-22 46 43)"/>
      <rect x="33" y="48" width="58" height="42" rx="20" fill={`url(#${id}-face)`}/>
      <g fill="none" stroke="#f5f8e9" strokeWidth="3.5" strokeLinecap="round">
        {state === 'thinking' ? <><path d="M44 64 l7 1 M70 65 l7 -1"/><path d="M57 76 h8"/></> : <><path d="M44 64 q3 -6 7 0 M70 64 q3 -6 7 0"/><path d={state === 'success' ? 'M54 74 q8 13 16 0 Z' : state === 'replying' ? 'M57 76 a4 3 0 1 0 8 0 a4 3 0 1 0 -8 0' : 'M56 75 q6 6 12 0'}/></>}
      </g>
      <ellipse cx="43" cy="73" rx="5" ry="2.5" fill="#dfb7a0" opacity=".5"/><ellipse cx="79" cy="73" rx="5" ry="2.5" fill="#dfb7a0" opacity=".5"/>
    </g>
  </svg>;
}
