/** Source hard content boundaries. Categories only: never retain rejected health prose. */
const pelvicContext='(?:盆底(?:肌)?|凯格尔|提肛|pelvic[- ]floor|kegels?)';
const pelvicAction='(?:收缩|收紧|夹紧|保持|放松|提起|每天做|每日做|重复|\\b(?:contract|squeeze|tighten|hold|relax|perform|repeat|do)\\b)';
const pelvicDose='(?:\\d+(?:\\.\\d+)?|[零〇一二三四五六七八九十百两]+)[\\s-]*(?:秒钟?|分钟|次|组|seconds?|secs?|minutes?|repetitions?|reps?|sets?|times?)';
// Require an actual action plus a numerical dose. Mere mentions, appointments and referrals are not instructions.
const pelvicInstructions=new RegExp(`${pelvicContext}[^\\n\\p{Sentence_Terminal}]{0,24}${pelvicAction}[^\\n\\p{Sentence_Terminal}]{0,8}${pelvicDose}|${pelvicAction}[^\\n\\p{Sentence_Terminal}]{0,8}${pelvicContext}[^\\n\\p{Sentence_Terminal}]{0,8}${pelvicDose}|${pelvicAction}[^\\n\\p{Sentence_Terminal}]{0,8}${pelvicDose}[^\\n\\p{Sentence_Terminal}]{0,12}${pelvicContext}|(?:提肛|凯格尔|kegels?|盆底肌(?:训练|练习)|pelvic[- ]floor exercises?)\\s*[:：-]?\\s*${pelvicDose}`,'giu');
const rules:readonly [string,RegExp][]=[
 ['pregnancy.pelvic_floor',pelvicInstructions],
 ['postpartum.pelvic_floor',pelvicInstructions],
 ['caution.never',/(?:诊断(?:为|出)|你(?:患有|得了)|你(?:的)?[^。.!?]{0,16}(?:就是|属于|是))[^。.!?]{0,30}(?:椎间盘突出|关节炎|肌腱炎|骨折|撕裂)|\b(?:you have|you suffer from|i diagnose|your (?:pain|symptoms?).{0,16}(?:is|means)).{0,40}(?:herniat|arthritis|tendinitis|fracture|tear)/gi],
 ['older.never',/骨质疏松[^。.!?]{0,60}(?:\d+\s*(?:公斤|千克|kg)|重量|负重)[^。.!?]{0,20}(?:安全|没问题)|osteoporosis[^.!?]{0,60}(?:\d+\s*(?:kg|kilograms?)|load|weight)[^.!?]{0,20}(?:safe|fine)/gi],
 ['pregnancy.never',/(?:治疗|治好|治愈|根治)[^。.!?]{0,20}(?:妊娠糖尿病|先兆子痫|孕期疾病)|(?:cure|treat|heal)[^.!?]{0,30}(?:gestational diabetes|preeclampsia|pregnancy disease)/gi],
 ['postpartum.never',/(?:治好|治愈|治疗|修复|闭合)[^。.!?]{0,20}腹直肌分离|(?:cure|treat|heal|close|fix)[^.!?]{0,30}(?:diastasis recti|abdominal separation)/gi],
 ['fatloss.spot_reduction.ban',/局部减脂|专门燃烧[^。.!?]{0,12}脂肪|\b(?:spot[- ]reduc(?:e|tion)|targeted fat loss|burn (?:only |specifically )?(?:belly|abdominal) fat)\b/gi],
 ['caution.never',/(?:康复|治疗)处方|腰(?:痛|背痛)[^。.!?]{0,30}(?:完全卧床|绝对卧床)|(?:胸痛|晕厥|危险信号)[^。.!?]{0,30}(?:继续练|坚持训练|忍着练)|\b(?:rehabilitation protocol|treatment prescription|complete bed rest for back pain|train through red flags)\b/gi],
 ['older.never',/防跌倒治疗|跌倒风险(?:评分|为\d|是\d)|跌倒后[^。.!?]{0,30}(?:这样站起|自行起身|起身技巧)|(?:胸痛|警示症状)[^。.!?]{0,30}继续训练|\b(?:fall prevention treatment|your fall risk (?:score|is)|get up after a fall by|train through warning symptoms)/gi],
 ['pregnancy.never',/(?:运动|训练)[^。.!?]{0,30}(?:催产|诱导分娩)|(?:出血|胸痛|宫缩)[^。.!?]{0,30}继续(?:运动|训练)|(?:应用|芽芽)[^。.!?]{0,20}(?:批准|医学许可|医学放行)|\b(?:exercise to induce labo[u]?r|continue exercising despite (?:bleeding|chest pain|contractions)|the app (?:medically clears|grants medical clearance))/gi],
 ['postpartum.never',/腹直肌分离[^。.!?]{0,15}(?:宽度为|间距为|测量为)\d|盆底康复处方|(?:漏尿|沉重感|出血|盆腔疼痛)[^。.!?]{0,30}(?:继续练|忍着练|硬撑)|自查结果[^。.!?]{0,15}(?:完全正常|一定正常)|\b(?:diastasis (?:gap|width) is \d|pelvic floor rehabilitation protocol|push through (?:leakage|heaviness|bleeding)|your self[- ]check results are normal)/gi],
 ['caution.never',/(?:腰痛|膝痛|肩痛|关节炎)[^。.!?]{0,12}(?:康复训练|专用运动方案)|你的[^。.!?]{0,12}(?:痛|症状|不适)[^。.!?]{0,6}(?:是因为|源于|来自)|\b(?:rehab(?:ilitation)? (?:workout|session)|condition[- ]specific exercise protocol|your (?:pain|symptoms?).{0,15}(?:is caused by|comes from))/gi],
 ['older.never',/你属于[^。.!?]{0,8}跌倒风险|骨折[^。.!?]{0,35}\d+\s*(?:公斤|千克|kg)[^。.!?]{0,20}安全|\b(?:you (?:are|have) (?:a )?(?:high|low|medium) fall risk|fracture.{0,40}\d+\s*(?:kg|kilograms?).{0,20}safe)/gi],
 ['pregnancy.never',/(?:先兆子痫|孕期并发症)[^。.!?]{0,15}(?:可以|适合|安全)(?:运动|锻炼)?|孕期[^。.!?]{0,12}(?:出血|症状)[^。.!?]{0,12}(?:只是正常|是正常|不用担心)|\b(?:preeclampsia.{0,30}(?:safe|fine) to exercise|pregnancy bleeding.{0,20}(?:normal|nothing to worry))/gi],
 ['postpartum.never',/你(?:有|患有)[^。.!?]{0,12}(?:盆腔器官脱垂|腹直肌分离)|腹直肌(?:间隙|分离)[^。.!?]{0,12}闭合|\b(?:you have.{0,15}(?:prolapse|diastasis)|close.{0,20}abdominal gap)/gi],
 ['fatloss.spot_reduction.ban',/定向瘦(?:大腿|肚子|腰|手臂)|\b(?:targeted (?:thigh|arm|belly) slimming)\b/gi],
];
function negated(prefix:string){return /(?:不|无法|不能|不应|不会|并非|不是|不要|没有|避免|不提供|不作|不做)(?:进行|作出|用于|保证|通过运动|通过|靠动作|盆底|运动|锻炼|帮助)?\s*$|\b(?:not|cannot|can't|won't|do not|doesn't|don't)\s+(?:(?:provide|offer)\s+)?(?:a\s+)?$/i.test(prefix);}
export function prohibitedTrainingClaims(text:string):string[]{
 return [...new Set(rules.flatMap(([id,pattern])=>[...text.matchAll(new RegExp(pattern.source,pattern.flags))].some(match=>!negated(text.slice(Math.max(0,match.index!-30),match.index))&&!/(?:应用|芽芽)(?:不|不能|不会|不应|不得)(?:授予|给予|提供|批准)/.test(match[0]))?[id]:[]))];
}
