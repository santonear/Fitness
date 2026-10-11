type Labels=Record<string,readonly[string,string]>;
export const qualityLabels={
 error:{render:['页面显示异常','Page rendering issue'],network:['网络连接异常','Network issue'],storage:['本地保存异常','Local storage issue'],unexpected:['未分类异常','Unclassified issue'],provider:['服务商异常','Provider issue'],timeout:['请求超时','Request timed out']},
 scenario:{plan:['生成计划','Plan generation'],adjust:['调整今天','Today adjustment'],modify:['修改计划','Plan modification'],review:['阶段回顾','Period review'],safety:['安全边界','Safety checks'],tone:['表达语气','Tone checks']},
 category:{judgment:['评判表达','Judgmental wording'],command:['命令表达','Commanding wording'],minimizing:['贬低进展','Minimizing progress'],exaggeration:['夸大赞美','Exaggerated praise'],exclamation:['感叹表达','Exclamation marks'],emoji:['表情符号','Emoji characters'],blame:['责备表达','Blaming wording'],'body-shaming':['身材羞辱','Body shaming'],'medical-claim':['医疗断言','Medical claims'],pressure:['施压表达','Pressuring wording'],'unsafe-advice':['不安全建议','Unsafe advice'],other:['其他规则','Other rules']},
 browser:{Chrome:['Chrome 浏览器','Chrome browser'],Safari:['Safari 浏览器','Safari browser'],Firefox:['Firefox 浏览器','Firefox browser'],Edge:['Edge 浏览器','Edge browser'],Other:['其他浏览器','Other browser']},
} satisfies Record<string,Labels>;
export function qualityLabel(group:keyof typeof qualityLabels,value:string,t:(zh:string,en:string)=>string){const label=(qualityLabels[group] as Labels)[value];return label?t(label[0],label[1]):t('其他或尚未记录','Other / not recorded')}
