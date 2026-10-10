import { useId } from 'react';
import type { NavIconProps } from '../contract';
import { NavIcon } from './slots';
/** Shared ceramic geometry; glaze colours are supplied by each signature. */
export function GlazedNavIcon({ className, ...props }: NavIconProps & { className: string }) {
 const id=useId();
 return <span className={className}><svg width="0" height="0" aria-hidden="true"><defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="var(--c-surface)"/><stop offset="1" stopColor="var(--c-surface-2)"/></linearGradient></defs></svg><span style={{'--nav-glaze':`url(#${id})`} as import('react').CSSProperties}><NavIcon {...props}/></span></span>;
}
