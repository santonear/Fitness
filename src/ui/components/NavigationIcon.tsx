import { AppIcon } from './AppIcon';
export function NavigationIcon({name}:{name:'today'|'plans'|'progress'|'exercises'|'settings'|'load'}) {return <span className="app-nav-icon" aria-hidden="true"><AppIcon name={name==='load'?'progress':name} ceramic/></span>;}
