import {engineDisplayNotices} from '../../application/engine-presentation';
import type {EnginePlan} from '../../engine/contracts';
import {engineCopy} from '../../coach/engine-copy';

const labels:Record<string,[string,string]>={duration:['时长','Duration'],volume:['训练量','Training volume'],pattern:['动作模式覆盖','Movement coverage'],exposure:['训练频次覆盖','Training exposure'],core:['核心动作覆盖','Core coverage'],carry:['负重移动覆盖','Carry coverage'],load:['负荷','Load'],exercise:['动作条件','Exercise constraints'],equipment:['器械','Equipment'],intensity:['强度','Intensity'],reps:['次数','Repetitions'],stretch:['拉伸时长','Stretch duration'],balance:['平衡训练','Balance training'],data:['规则数据','Rule data'],copy:['提示内容','Notice content'],pair:['动作配对','Exercise pairing'],plan:['方案','Plan'],ladder:['动作进阶','Exercise progression'],substitution:['动作替换','Substitution'],finite:['数值','Numbers']};
const parts:Record<string,[string,string]>={chest:['胸部','Chest'],back:['背部','Back'],quads:['股四头肌','Quadriceps'],hamstrings:['大腿后侧','Hamstrings'],glutes:['臀部','Glutes'],shoulders:['肩部','Shoulders'],biceps:['肱二头肌','Biceps'],triceps:['肱三头肌','Triceps'],calves:['小腿','Calves'],squat:['深蹲','Squat'],hinge:['髋铰链','Hip hinge'],lunge:['弓步','Lunge'],push:['推','Push'],pull:['拉','Pull'],knee_dominant:['膝主导','Knee dominant'],hip_dominant:['髋主导','Hip dominant']};
export function EngineResultNotice({plan,locale}:{plan:EnginePlan;locale:'zh'|'en'}){
 const blocked=plan.gates.some(gate=>gate.status==='blocked');
 const language=locale==='zh'?0:1,issues=blocked?[]:plan.quality?.issues??[];
 return <section role="status"><h2>{engineCopy(plan.quality?.status==='limited'?'engine.copy.limited':'engine.copy.unavailable',locale)}</h2>{engineDisplayNotices(plan).map((notice,index)=><p key={`notice:${index}`}>{notice.message[locale]}</p>)}<ul>{issues.map((issue,index)=>{
  const key=Object.keys(labels).find(key=>issue.code.includes(key)),label=key?labels[key][language]:(locale==='zh'?'条件检查':'Constraint check');
  const number=issue.reason.match(/^([a-z_]+):([\d.]+)([<>])([\d.]+)$/),part=number?parts[number[1]]:parts[issue.reason];
  const detail=number?`${part?.[language]??(locale==='zh'?'项目':'Item')} ${number[2]} ${number[3]} ${number[4]}`:part?.[language];
  const templateIndex=plan.templates.findIndex(row=>row.id===issue.templateId);
  return <li key={index}>{label}{templateIndex>=0?` · ${locale==='zh'?'训练单':'Session'} ${templateIndex+1}`:''}{issue.itemIndex!==undefined?` · ${locale==='zh'?'动作':'Exercise'} ${issue.itemIndex+1}`:''}{detail?` · ${detail}`:''}</li>;
 })}</ul></section>;
}
