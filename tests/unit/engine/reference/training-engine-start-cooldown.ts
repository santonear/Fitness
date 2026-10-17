/** Legacy independent unit-test reference only; never used by V2 generation or acceptance. */
import {Rules} from '../../../../src/engine/data';
import type {EngineProfile} from '../../../../src/engine/contracts';
import type {PlannedItem} from '../../../../src/domain/v8/contracts';
import {independentlyPossibleIds,matches,postpartumPhase} from '../../../../tools/eval/training-engine-quality';

const r=new Rules();
/** Replays only the public deterministic cold-block choice, with independent seconds arithmetic.
 * The ordinary table is a budget: its unused remainder cannot conjure a zero-duration cardio set. */
export function independentStartCooldown(work:PlannedItem[],p:EngineProfile,cap:number):number|undefined{
 // Historical positive PAR-Q / reviewed red flags can change the candidate universe through
 // date-bound clearance. This bounded replay does not certify that separate medical state machine.
 const birth=p.birthYearMonth?.split('-').map(Number),asOf=p.asOfDate?.split('-').map(Number),age=birth&&asOf?asOf[0]-birth[0]-(asOf[1]<birth[1]?1:0):p.ageYears,automaticOlder=p.population.kind==='general'&&age!==undefined&&age>=r.get('older.activation').trigger.any[0].gte;
 if(p.screening.parqAnswers?.some(Boolean)||p.screening.redFlagReview||automaticOlder)return undefined;
 const map=r.get('dose.muscle_groups').catalog_map,major=r.get('dose.muscle_groups').target_groups as string[],fractional=r.get('dose.volume.fractional'),possible=new Set(independentlyPossibleIds(p));
 const credited=(i:PlannedItem)=>{const e=r.byExercise.get(i.exerciseId),rir=i.prescription?.rir[0]??r.get('dose.rir.targets').beginner[0],effort=rir<=3?fractional.set_effort_multiplier.rir_0_to_3:rir===4?fractional.set_effort_multiplier.rir_4:fractional.set_effort_multiplier.rir_5_plus;if(!e||fractional.excluded_modalities.includes(e.modality)||fractional.excluded_patterns.includes(e.primary_pattern)||effort*i.sets<=0)return [];const known=[...e?.primaryMuscles??[],...e?.secondaryMuscles??[]].map(m=>map[m]).filter(g=>major.includes(g));return known.length?[...new Set(known)]:Object.keys(fractional.pattern_fallback_if_no_muscles[e?.primary_pattern??'']??{}).filter(g=>major.includes(g));};
 const relevant=work.filter(i=>['main','accessory'].includes(i.prescription?.block??'')),all=[...new Set([...relevant.filter(i=>i.prescription?.block==='main'),...relevant.filter(i=>i.prescription?.block!=='main')].flatMap(credited))];
 const priorityCount=Math.max(...[...r.get('session.cooldown.stretch').priority_when_time_short.matchAll(/M(\d+)/g)].map(match=>Number(match[1]))),legacy=relevant.filter(i=>i.prescription?.block==='main'&&!/^(main|acc|core)_\d+$/.test(i.prescription?.sourcePosition??'')).slice(0,priorityCount),priority=[...new Set([...relevant.filter(i=>{const match=i.prescription?.sourcePosition?.match(/^main_(\d+)$/);return match&&Number(match[1])>=1&&Number(match[1])<=priorityCount;}),...legacy])].sort((a,b)=>Number(a.prescription?.sourcePosition?.split('_')[1]??Infinity)-Number(b.prescription?.sourcePosition?.split('_')[1]??Infinity)).flatMap(i=>{const mapped=(r.byExercise.get(i.exerciseId)?.primaryMuscles??[]).map(m=>map[m]).filter(g=>major.includes(g));return mapped.length?mapped:credited(i).length?credited(i):all;}),groups=[...new Set([...priority,...all])];
 const base=r.get('dose.stretch'),source=r.get('session.cooldown.stretch'),range=base.hold_s[p.population.kind==='older_adult'?'older_adult':'range'],sets=base.reps_per_muscle[0],side=r.get('session.time.model').per_side_multiplier,overhead=r.get('duration.set.overhead').mobility_overhead_s_per_set;
 // The zero-pool proof deliberately retains ambiguous population candidates. A deterministic
 // replay must additionally apply the explicit source exclusions that can distinguish static poses.
 const pop=p.population,phase=postpartumPhase(p),cautious=pop.kind==='older_adult'&&(pop.balanceCautious||pop.walkingAid||pop.fallsAnswers?.some(Boolean)),user={postpartum_phase:phase,balance_cautious:cautious,walking_aid:pop.kind==='older_adult'&&pop.walkingAid};
 const allowed=(e:typeof r.data.exercises[number])=>{
  if(p.screening.restingBp!=='known_below_threshold'&&r.get('safety.hypertension.limits').exclude_flags.some((flag:string)=>e.flags.includes(flag)))return false;
  if(pop.kind==='older_adult'){
   const base=r.get('older.exclude.base');if((!base.when||matches(base.when,e,user))&&matches(base.exclude_if,e,user)||matches(base.default_low_impact.exclude_if,e,user))return false;
   const balance=r.get('older.exclude.balance_cautious');if(cautious&&((!balance.when||matches(balance.when,e,user))&&matches(balance.exclude_if,e,user)||e.requires_floor_transition||matches(r.get('older.floor.transitions').floor_based_if,e,user)))return false;
   if(pop.boneFlag&&matches(r.get('older.bone').until_clearance_exclude_if,e,user))return false;
  }
  if(pop.kind==='postpartum'&&phase<3){const source=r.get('postpartum.exclude.pre_phase3');if((!source.when||matches(source.when,e,user))&&matches(source.exclude_if,e,user))return false;}
  return true;
 };
 const pool=r.data.exercises.filter(e=>possible.has(e.id)&&allowed(e)&&e.modality==='mobility'&&e.mobility_type==='static'&&e.stretch_targets?.length&&e.use.includes('cooldown')&&e.difficulty<=r.get('select.difficulty.window').warmup_cooldown_max).flatMap(e=>{const low=Math.max(range[0],e.stretch_hold_s?.[0]??range[0]),high=Math.min(range[1],e.stretch_hold_s?.[1]??range[1]);return low<=high?[{e,low,high}]:[];});
 const chosen:{id:string;targets:string[];hold:number;low:number;factor:number}[]=[],used=work.map(i=>r.byExercise.get(i.exerciseId)!).filter(Boolean),seconds=()=>chosen.reduce((sum,c)=>sum+c.hold*c.factor+sets*overhead,0),cost=(c:typeof pool[number],hold:number)=>sets*(hold*(c.e.time.per_side?side:1)+overhead);
 for(const group of groups){
  if(chosen.some(c=>c.targets.includes(group)))continue;
  const choices=pool.filter(c=>c.e.stretch_targets!.includes(group)&&![...used,...chosen.map(c=>r.byExercise.get(c.id)!)].some(e=>e.id===c.e.id||c.e.ladder.id&&e.ladder.id===c.e.ladder.id)&&c.e.stretch_targets!.every(g=>work.filter(i=>r.byExercise.get(i.exerciseId)?.mobility_type==='static'&&r.byExercise.get(i.exerciseId)?.stretch_targets?.includes(g)).reduce((n,i)=>n+i.sets,0)+chosen.filter(c=>c.targets.includes(g)).length*sets+sets<=base.reps_per_muscle[1])).sort((a,b)=>Number(a.e.time.per_side)-Number(b.e.time.per_side)||b.e.stretch_targets!.filter(g=>groups.includes(g)&&!chosen.some(c=>c.targets.includes(g))).length-a.e.stretch_targets!.filter(g=>groups.includes(g)&&!chosen.some(c=>c.targets.includes(g))).length||a.e.id.localeCompare(b.e.id,'en'));
  const preferred=(c:typeof pool[number])=>Math.max(c.low,Math.min(c.high,source.dose.default.hold_s));let candidate=choices.find(c=>seconds()+cost(c,preferred(c))<=cap),hold=candidate?preferred(candidate):0;
  if(!candidate){candidate=choices.find(c=>seconds()+cost(c,c.low)<=cap);if(candidate)hold=candidate.low;}
  if(!candidate){const recoverable=chosen.reduce((sum,c)=>sum+(c.hold-c.low)*c.factor,0);candidate=choices.find(c=>seconds()+cost(c,c.low)-recoverable<=cap);if(candidate){hold=candidate.low;for(const c of [...chosen].reverse()){const excess=seconds()+cost(candidate,hold)-cap;if(excess<=0)break;c.hold=Math.max(c.low,c.hold-Math.ceil(excess/c.factor));}}}
  if(candidate)chosen.push({id:candidate.e.id,targets:candidate.e.stretch_targets!,hold,low:candidate.low,factor:sets*(candidate.e.time.per_side?side:1)});
 }
 const filler=r.data.exercises.filter(e=>possible.has(e.id)&&allowed(e)&&e.modality==='cardio'&&e.use.includes('cooldown')&&![...used,...chosen.map(c=>r.byExercise.get(c.id)!)].some(other=>other.id===e.id||e.ladder.id&&other.ladder.id===e.ladder.id)).sort((a,b)=>a.difficulty-b.difficulty||a.id.localeCompare(b.id,'en'))[0];
 if(seconds()<cap&&filler){const minimum=r.get('duration.set.overhead').overhead_s_per_set+(filler.time.per_side?side:1);if(cap-seconds()<minimum)for(const c of [...chosen].reverse()){c.hold=Math.max(c.low,c.hold-Math.ceil((minimum-(cap-seconds()))/c.factor));if(cap-seconds()>=minimum)break;}if(cap-seconds()>=minimum){const multiplier=filler.time.per_side?side:1,cardio=r.get('duration.set.overhead').overhead_s_per_set+Math.max(1,Math.ceil((cap-seconds()-r.get('duration.set.overhead').overhead_s_per_set)/multiplier))*multiplier;if(seconds()+cardio<=cap)return seconds()+cardio;}}
 return seconds();
}
