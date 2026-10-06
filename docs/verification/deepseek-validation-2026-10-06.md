# DeepSeek 合成接入验收（2026-10-06）

## 实现范围

基线502ab1c23884b98e7e33105f22ffa60a24901711；工作区D:/Project/xxgospel/Fitness/.worktrees/fitness-gemini。新增src/backend/deepseek.ts、tests/backend/deepseek.test.ts；未增加SDK依赖，复用buildAiPrompt、createSupplierTransport、validateCandidate与现有控制状态。默认Worker不启用供应商。

API标识deepseek-flash，官方对应DeepSeek-V4.1-Flash；endpoint https://api.deepseek.com/chat/completions，服务端DEEPSEEK_API_KEY Secret、Bearer鉴权。thinking disabled、JSON Object模式、非流式、每次2048输出tokens、无供应商自动重试。

## 问题及修复

首个英文计划返回供应商200/stop，但targetSets为单对象，而业务契约必须为逐组数组。本地严格校验正确拒绝。诊断仅使用固定合成候选，无真实训练数据，正文不进入D1/日志。

适配器在生成提示中补充targetSets始终为数组的明确指令、使用请求日期与受控动作目录构造形状示例，以及每组必须单独列出、不能仅在备注写组数。无自动对象转数组、无放宽指标/日期/目录校验。新测试修复前失败，修复后通过。

## 有效证据

npm run check：186单元/29测试文件、类型检查、构建通过。git diff --check通过。中英文理解成功证据在.deepseek-final两个前项；理解编码在本次修复中未改，复用有效结果。中英文单日生成由修复后版本验证，全部200/stop、validateCandidate通过，确定性器械/时长下界诊断无问题；内容质量仍not-assessed。

忽略目录中的原始证据：.superpowers/deepseek-final-followup-result.json、deepseek-diagnostic-followup-result.json、deepseek-repair-followup-result.json。实际六次供应商调用：两次理解、两次失败计划、两次修复后计划；total tokens为198+204+1006+1035+1219+1092=4754。Token统计不是费用结算凭证，未回传actualCost，未知费用仍待核算。

供应商资料：https://api-docs.deepseek.com/api/create-chat-completion/ ；https://api-docs.deepseek.com/news/news250821 。JSON模式只保证JSON形状，不替代业务校验。

## 运行与费用边界

本轮测试不另设累计金额上限，按实际用量记录；不改变生产月预算、个人配额或预算事务。已有Gemini累计16元保守预留不清零、不视为实际账单。供应商余额截图100元为测试前状态，测试后余额未核验。

Cloudflare曾提示最新Secret版本未部署，使用wrangler versions secret put更新临时管理员Secret后部署；未读取/输出供应商密钥。

临时合成入口已撤回。隔离预览control-only版本5e8bd878-2d61-461c-abf6-4c969714339c；/api/v1/health返回200、productionModelEnabled=false；理解/生成503 AI_DISABLED；临时入口404。正式fitness未部署更新。

本地未提交/推送/合并。未验收真机、完整浏览器、生产账务、真实用户内容质量或全前端端到端接入。成功结论限定固定合成目标理解和单日候选生成，不等于公网AI已上线。
