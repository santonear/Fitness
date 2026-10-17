import {Button} from './common';
import type {EnginePlan} from '../../engine/contracts';
import {engineDisplayNotices} from '../../application/engine-presentation';
export function EnginePlanNotices({plan,locale,onEditEnvironment}:{plan:Pick<EnginePlan,'notices'>&Partial<Pick<EnginePlan,'gates'>>;locale:'zh'|'en';onEditEnvironment?:()=>void}){
 return <>{engineDisplayNotices(plan).map((notice,index)=>notice.code.startsWith('engine.copy.environment_')&&onEditEnvironment?<p key={`${notice.code}:${index}`} role="status"><Button onClick={onEditEnvironment}>{notice.message[locale]}</Button></p>:<p key={`${notice.code}:${index}`} role={notice.severity==='stop'?'alert':'status'}>{notice.message[locale]}</p>)}</>;
}
