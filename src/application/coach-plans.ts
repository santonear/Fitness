import { repository, type Repository } from '../persistence/repository';
import { createGuidedService } from './guided';
import { createDayPlanService } from './day-plans';
import { type ProgramCandidate } from '../domain/guided-contracts';
import { DomainError } from '../domain/errors';

export function createCoachPlanService(repo:Repository){
  const guided=createGuidedService(repo);
  async function guard(planId:string,revision:number,generation:number){
    if(((await repo.readMetadata()).restoreGeneration??0)!==generation)throw new DomainError('CONFLICT','Library restored');
    const plan=await repo.db.plans.get(planId);if(!plan||plan.deletedAt||plan.revision!==revision)throw new DomainError('CONFLICT','Plan changed');return plan;
  }
  async function lifecycle(planId:string,revision:number,generation:number,action:'paused'|'active'|'terminated',reason:string,expectedContext:string){
    return repo.write(async()=>{
      if(await guided.capturePlanContext()!==expectedContext)throw new DomainError('CONFLICT','Plan context changed');const plan=await guard(planId,revision,generation);const state=await guided.read();const program=state.programs.find(p=>p.planIds.includes(plan.id)&&p.status!=='terminated');
      if(program) await guided.transition(program.id,action,state.revision,reason);
      else await guided.transitionLegacy(plan.id,action,state.revision,reason);
    });
  }
  async function apply(planId:string,revision:number,generation:number,candidate:ProgramCandidate,sourceSnapshot:string){
    return repo.write(async()=>{
      const plan=await guard(planId,revision,generation);const version=await repo.db.planVersions.get(plan.currentVersionId);const tasks=await repo.db.scheduledWorkouts.where('planVersionId').equals(plan.currentVersionId).toArray();
      if(JSON.stringify({plan,version,tasks})!==sourceSnapshot)throw new DomainError('CONFLICT','Plan or training changed');
      const state=await guided.read();if(state.programs.some(p=>p.planIds.includes(plan.id)))throw new DomainError('INVALID','Use phase editor for a managed phase');
      const day=candidate.days[0];if(plan.model!=='date-day'||tasks.length!==1||candidate.days.length!==1||day.date!==tasks[0].scheduledDate||candidate.timeZone!==plan.scheduleTimeZone||candidate.restoreGeneration!==generation)throw new DomainError('INVALID','Review exact independent day');
      const dependencies=await guided.captureDependencies();if(candidate.onboardingSnapshot!==dependencies.onboardingSnapshot||candidate.profileSnapshot!==dependencies.profileSnapshot)throw new DomainError('CONFLICT','Profile changed');
      return createDayPlanService(repo).saveDayPlan({id:plan.id,name:candidate.name,date:day.date,timeZone:candidate.timeZone,exercises:day.exercises,startTime:day.startTime,durationMinutes:day.durationMinutes,expectedRevision:revision,expectedGeneration:generation});
    });
  }
  return {lifecycle,apply};
}
export const coachPlanService=createCoachPlanService(repository);
