import type {ConsoleEnv} from './console';
import {evaluateFinanceTodos} from '../finance';
import {releaseTodoSource} from '../releases/todos';
import {pendingOver48h} from '../users/handler';
import {evaluateQualityNotifications,dispatchAdminPush,enqueueNotification} from '../quality';
import type {AdminContext} from './contracts';
/** Scheduled metadata-only evaluation; no model calls or account mutation. */
export async function runAdminSchedule(env:ConsoleEnv,now=Date.now()){if(env.ADMIN_CONSOLE_ENABLED!=='true'||!env.ADMIN_DB)return;const context:AdminContext<ConsoleEnv>={env,now,actor:'scheduler',fresh:false,requestId:'',audit:async()=>{}};await evaluateQualityNotifications(env,now,await pendingOver48h(context));for(const todo of [...await evaluateFinanceTodos(context),...await releaseTodoSource.evaluate(context)]){const category=todo.id.includes('100')?'budget100':todo.id.includes('80')?'budget80':todo.id.includes('smoke')?'smoke':todo.id.includes('ledger')?'ledger':undefined;if(category)await enqueueNotification(env.ADMIN_DB,category,1,todo.id,now)}return dispatchAdminPush(env,now)}
