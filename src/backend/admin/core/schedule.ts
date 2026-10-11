import type {ConsoleEnv} from './console';
import {evaluateFinanceTodos} from '../finance';
import {releaseTodoSource} from '../releases/todos';
import {pendingOver48h} from '../users/handler';
import {evaluateQualityNotifications,dispatchAdminPush,reconcileNotificationIncidents} from '../quality';
import type {Category} from '../quality/contracts';
import type {AdminContext} from './contracts';
import {readFeatureFlags} from '../../feature-config';
/** Scheduled metadata-only evaluation; no model calls or account mutation. */
export async function runAdminSchedule(env:ConsoleEnv,now=Date.now()){
 if(env.ADMIN_CONSOLE_ENABLED!=='true'||!env.ADMIN_DB)return;
 const flags=await readFeatureFlags(env);if(!flags.adminConsole)return;
 const context:AdminContext<ConsoleEnv>={env,now,actor:'scheduler',fresh:false,requestId:'',audit:async()=>{}};
 await evaluateQualityNotifications(env,now,await pendingOver48h(context));
 const active:{id:string;category:Category;count:number}[]=[];
 for(const todo of [...await evaluateFinanceTodos(context),...await releaseTodoSource.evaluate(context)]){
  const category=todo.id.includes('100')?'budget100':todo.id.includes('80')?'budget80':todo.id.includes('smoke')?'smoke':todo.id.includes('ledger')?'ledger':undefined;
  if(category)active.push({id:todo.id,category,count:1});
 }
 await reconcileNotificationIncidents(env.ADMIN_DB,active,now);
 return dispatchAdminPush({...env,ADMIN_PUSH_ENABLED:flags.systemNotifications?env.ADMIN_PUSH_ENABLED:'false'},now);
}
