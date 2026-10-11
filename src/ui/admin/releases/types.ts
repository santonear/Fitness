export interface ReleaseItem {id:string;publishedAt:string;compatibleDataVersion:number}
export interface ReleaseOverview {
 environment:'preview'|'production';adapterAvailable:boolean;
 previewSimulation?:{mode:'preview-simulation';actualDeploymentUnchanged:true;selectedDeploymentId:string|null;changedAt:string|null}|null;
 features:{name:string;sensitive:boolean;states:{environment:'preview'|'production';enabled:boolean|null;pending:boolean;changedBy:string|null;changedAt:string|null}[]}[];
 registered:{environment:'preview'|'production';dataVersion:number;current:ReleaseItem;previous?:ReleaseItem}[];
 releases:{environment:string;current_id:string;previous_id:string|null;changed_at:string;operation_id:string|null}[];
 smoke:{environment:string;release_id:string;check_id:string;status:'passed'|'failed'|'unavailable';checked_at:string}[];
 prompts:{environment:string;task:string;version:string;changed_at:string;changed_by:string}[];
 promptTasks:string[];registeredPromptVersions:string[];
 history:{request_id:string;environment:string;kind:string;object_id:string;before_value:string|null;after_value:string;actor:string;created_at:string}[];
}
export interface ReleaseCommand {path:'flags'|'prompts'|'rollback'|'smoke'|'simulate-rollback';requestId:ReturnType<typeof crypto.randomUUID>;body:Record<string,unknown>;title:string;impact:string}
