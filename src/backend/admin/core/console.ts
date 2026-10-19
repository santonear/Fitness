import {createTodoRegistry} from './todos';
import {adminJson,AdminError,type AdminContext} from './contracts';
import {handleUsers,usersTodoSource,pendingOver48h} from '../users/handler';
import {handleFinance,evaluateFinanceTodos} from '../finance';
import {handleReleases} from '../releases';
import {releaseTodoSource} from '../releases/todos';
import type {ReleasesEnv} from '../releases/model';
import {handleQuality,qualityTodos,type QualityEnv} from '../quality';
import {readFeatureFlags} from '../../feature-config';
import {handleFeedbackAdmin} from '../feedback';
export interface ConsoleEnv extends ReleasesEnv,QualityEnv {}
export async function handleConsole(request:Request,c:AdminContext<ConsoleEnv>,forward:(operation:string,data:unknown)=>Promise<Response>){
 if(new URL(request.url).pathname.includes('/quality/')){const flags=await readFeatureFlags(c.env);c={...c,env:{...c.env,ADMIN_PUSH_ENABLED:flags.systemNotifications?c.env.ADMIN_PUSH_ENABLED:'false'}}}
 if(new URL(request.url).pathname.endsWith('/todos')){const registry=createTodoRegistry<AdminContext<ConsoleEnv>>();registry.registerTodoSource(usersTodoSource);registry.registerTodoSource({id:'finance',evaluate:evaluateFinanceTodos});registry.registerTodoSource(releaseTodoSource);registry.registerTodoSource({id:'quality',evaluate:async context=>context.env.ADMIN_DB?qualityTodos(context.env.ADMIN_DB,context.now,await pendingOver48h(context)):[]});return adminJson({items:await registry.evaluate(c)})}
 return await handleUsers(request,{...c,forward})??await handleFinance(request,{...c,settle:async(subjectId,requestId,actualCost)=>{const r=await forward('settle',{subjectId,requestId,actualCost});if(!r.ok)throw new AdminError('SETTLEMENT_UNAVAILABLE',r.status)}})??await handleReleases(request,c)??await handleQuality(request,c)??await handleFeedbackAdmin(request,c);
}
