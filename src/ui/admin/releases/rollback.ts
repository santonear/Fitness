import type {ReleaseOverview} from './types';
type Entry=ReleaseOverview['registered'][number];
type State=ReleaseOverview['releases'][number]|undefined;
type RollbackBlock='no_previous'|'same_deployment'|'data_unknown'|'data_incompatible'|'state_changed'|'busy'|'adapter';
/** The first reason that makes rollback unsafe; undefined means the button may be used. */
export function rollbackBlock(entry:Entry,state:State,adapterAvailable:boolean):RollbackBlock|undefined{
 const current=state?.current_id??entry.current.id,previous=state?.previous_id??entry.previous?.id;
 if(!entry.previous||!previous)return 'no_previous';
 if(entry.previous.deploymentId&&entry.previous.deploymentId===entry.current.deploymentId)return 'same_deployment';
 if(entry.previous.compatibleDataVersion===undefined)return 'data_unknown';
 if(entry.previous.compatibleDataVersion!==entry.dataVersion)return 'data_incompatible';
 if(state?.operation_id)return 'busy';
 if(current!==entry.current.id||previous!==entry.previous.id)return 'state_changed';
 if(!adapterAvailable)return 'adapter';
 return undefined;
}
export const rollbackBlockCopy:Record<RollbackBlock,[string,string]>={
 no_previous:['回滚不可用：没有已登记的上一版本。','Rollback unavailable: no registered previous version.'],
 same_deployment:['回滚不可用：登记的上一版本与当前是同一个部署。','Rollback unavailable: the registered previous version is the same deployment.'],
 data_unknown:['回滚不可用：上一版本没有登记数据版本，无法确认与当前数据兼容。','Rollback unavailable: the previous version has no registered data version, so compatibility cannot be confirmed.'],
 data_incompatible:['回滚不可用：上一版本与当前数据版本不兼容。','Rollback unavailable: the previous version is not compatible with the current data version.'],
 state_changed:['回滚不可用：版本状态已变化，请刷新后再看。','Rollback unavailable: the release state changed. Refresh and check again.'],
 busy:['回滚不可用：已有一次回滚正在进行。','Rollback unavailable: another rollback is in progress.'],
 adapter:['回滚不可用：后台未连接部署接口。请在 GitHub 运行「Roll back Fitness production」工作流。','Rollback unavailable here: the console has no deployment connection. Run the “Roll back Fitness production” GitHub workflow.'],
};
