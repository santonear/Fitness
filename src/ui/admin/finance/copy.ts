export const financeCopy={zh:{dailyMessageLimit:'每人每天消息上限',ledger:'账本',settings:'运行配置',costs:'芽芽费用',month:'月份',settled:'已核算费用',pending:'待核算预留',unattributed:'未归属费用',export:'导出 CSV',empty:'这个月还没有记录',unavailable:'暂时无法读取，请稍后重试',loading:'正在读取',task:'任务',status:'状态',user:'用户',request:'请求',reconcile:'核算',amount:'供应商账单金额（分）',confirm:'确认',cancel:'取消',impact:'仅影响之后的请求，不改写已有用量和费用。',save:'查看改动',before:'改前',after:'改后',history:'修改历史',restore:'恢复此版本',defaults:'恢复环境默认值',announcement:'维护公告',text:'公告内容',start:'开始时间',end:'结束时间',publish:'发布公告',withdraw:'撤下公告',notice:'公告最多显示七天，训练中不显示。',retry:'重试同一次',verify:'重新验证',day:'日期',calls:'调用次数',fallback:'本地规则降级',legacy:'历史账本没有按天信息；以下日统计从接入监控后开始。',budget:'月预算',progress:'含待核算预留',dismiss:'关闭公告',version:'版本',quotaUnderstand:'理解额度默认值',quotaGenerate:'计划额度默认值',quotaSummary:'回顾额度默认值',monthlyBudgetFen:'月预算上限（元）',reservationFen:'单次预留（元）',maxConcurrent:'并发上限',retentionDays:'申请保留天数',settleImpact:'按供应商账单核算这笔调用。核算后将释放对应预留，并记录实际费用。'},en:{dailyMessageLimit:'Daily messages per person',ledger:'Ledger',settings:'Runtime settings',costs:'AI costs',month:'Month',settled:'Settled cost',pending:'Pending reservation',unattributed:'Unattributed cost',export:'Export CSV',empty:'No records this month',unavailable:'Unable to load. Please try again later.',loading:'Loading',task:'Task',status:'Status',user:'User',request:'Request',reconcile:'Settle',amount:'Supplier invoice amount (fen)',confirm:'Confirm',cancel:'Cancel',impact:'Applies to future requests only. Existing usage and costs remain intact.',save:'Review changes',before:'Before',after:'After',history:'Version history',restore:'Restore version',defaults:'Restore environment defaults',announcement:'Maintenance notice',text:'Notice text',start:'Start',end:'End',publish:'Publish notice',withdraw:'Withdraw notice',notice:'Visible for up to seven days, hidden during training.',retry:'Retry same request',verify:'Verify again',day:'Day',calls:'Calls',fallback:'Local fallbacks',legacy:'Historical ledger entries have no daily timestamps. Daily totals start when monitoring is connected.',budget:'Monthly budget',progress:'Including pending reservations',dismiss:'Dismiss notice',version:'Version',quotaUnderstand:'Default understanding quota',quotaGenerate:'Default planning quota',quotaSummary:'Default review quota',monthlyBudgetFen:'Monthly budget (CNY)',reservationFen:'Reservation per call (CNY)',maxConcurrent:'Concurrency limit',retentionDays:'Application retention days',settleImpact:'Settle this call against the supplier invoice. Its reservation will be released and the actual cost recorded.'}};
export type FinanceLanguage='zh'|'en';
export function financeLabel(value:string,language:FinanceLanguage){const labels:Record<string,[string,string]>={ONBOARD_PLAN:['生成计划','Create plan'],ADJUST_TODAY:['今日调整','Adjust today'],MODIFY_PLAN:['修改计划','Modify plan'],PERIOD_REVIEW:['回顾','Review'],CHAT:['对话','Chat'],understand:['理解目标','Understand goal'],generate:['生成计划','Generate plan'],adjust:['今日调整','Adjust today'],modify:['修改计划','Modify plan'],review:['回顾','Review'],summary:['回顾','Review'],reserved:['已预留','Reserved'],submitted:['已提交','Submitted'],pending:['待核算','Pending settlement'],settled:['已核算','Settled'],released:['已释放','Released'],fallback:['本地规则','Local rules']};return labels[value]?.[language==='zh'?0:1]??(language==='zh'?'其他或尚未记录':'Other / not recorded')}

export type UsageOutcome='success'|'fallback'|'failed';
/** Usage rows store a result or a provider failure code; operators only see plain outcomes. */
export function usageResultOutcome(result:string):UsageOutcome{return result==='success'||result==='repaired'||result==='no_change'?'success':result==='fallback'?'fallback':'failed'}
const failureReasons:[RegExp,string,string][]=[
 [/^TIMEOUT$|^HTTP_408$/,'等待超时','timed out'],
 [/^NETWORK_ERROR$|^ABORTED$/,'网络中断','connection interrupted'],
 [/^HTTP_429$/,'服务商繁忙','provider busy'],
 [/^HTTP_5XX$|^MODEL_UNAVAILABLE$/,'服务商暂时不可用','provider unavailable'],
 [/^HTTP_4\d\d$|^HTTP_OTHER$/,'服务商拒绝了请求','provider rejected the request'],
 [/^COACH_LANGUAGE$/,'回复用语没通过检查','reply wording failed checks'],
 [/^VALIDATION_FAILED$|^INVALID_OUTPUT$|^INVALID_STREAM$|^EMPTY_TEXT$|^TEXT_LIMIT$|^ATTACHMENT_/,'回复内容不合格，已丢弃','reply was unusable and discarded'],
 [/^NO_SAFE_PLAN$|^NO_APPLICABLE_CHANGE$/,'没有可用的安全调整','no safe change available'],
 [/^PROMPT_BUILD_FAILED$|^INVALID_PROMPT_VERSION$/,'系统配置问题','system configuration problem'],
];
export function usageResultLabel(result:string,language:FinanceLanguage){
 const zh=language==='zh';
 if(result==='success')return zh?'成功':'Succeeded';
 if(result==='repaired')return zh?'成功（自动修正了格式）':'Succeeded (format corrected automatically)';
 if(result==='no_change')return zh?'成功（无需调整）':'Succeeded (no change needed)';
 if(result==='fallback')return zh?'改用本地建议':'Used local suggestion instead';
 const reason=failureReasons.find(([pattern])=>pattern.test(result));
 return reason?(zh?`失败：${reason[1]}`:`Failed: ${reason[2]}`):(zh?'失败':'Failed');
}
