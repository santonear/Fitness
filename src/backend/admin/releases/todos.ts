import { requireAdminDb,type AdminContext,type AdminTodo,type TodoSource } from '../core/contracts';
export const releaseTodoSource:TodoSource={id:'releases',async evaluate(context:AdminContext):Promise<AdminTodo[]> {
  const db=requireAdminDb(context);
  const [pending,smoke]=await Promise.all([
    db.prepare("SELECT name FROM admin_feature_flags WHERE environment='production' AND environment=? AND pending=1").bind(context.env.ADMIN_ENVIRONMENT??'').all<{name:string}>(),
    db.prepare("SELECT s.environment,s.release_id,COUNT(*) AS count FROM admin_release_smoke s JOIN admin_release_state r ON r.environment=s.environment AND r.current_id=s.release_id WHERE s.status!='passed' AND s.environment=? GROUP BY s.environment,s.release_id").bind(context.env.ADMIN_ENVIRONMENT??'').all<{environment:string;release_id:string;count:number}>(),
  ]);
  return [...pending.results.map(row=>({id:`sensitive:${row.name}`,level:'warn' as const,title:'敏感开关等待确认',text:`${row.name} 尚未开启，请核对影响。`,actions:[{label:'查看并确认',href:'/admin/releases'}]})),...smoke.results.map(row=>({id:`smoke:${row.environment}:${row.release_id}`,level:'alert' as const,title:'发布检查需要处理',text:`${row.environment} 有 ${row.count} 项检查未通过或暂不可用。`,actions:[{label:'查看发布',href:'/admin/releases'}]}))];
}};
