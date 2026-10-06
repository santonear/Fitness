# 同源服务、阶段总结与动作媒体

基线 a495cd733007e363efe4f14d0a507493bc68f3be；实现使用独立工作区 fitness-summary。

## 范围及所有权

- A：fitness-worker.ts、独立 fullstack 配置、纯阶段/进度计算提取、管理命令兼容与公共整合。原静态发布配置保留。
- B：总结契约、控制服务、HTTP、供应商提示与预算/次数兼容、后端测试。
- C：StageSummaryPreview 与新增总结流程组件和客户端、交互测试；不改变日期计划助手。
- D：现有四动作的媒体来源、固定视频白名单及反馈/回退、对应测试和来源证据；不增加动作。

不创建资源或迁移，不调用真实总结，不付费或发布。正式 origin、配额/费用边界和支持环境仍须正式启用前核实。默认模型关闭，mock 不能替代生产容量和内容质量证据。

## 总结共同契约

请求为 contractVersion=1、operation=summary、requestId、locale、restoreGeneration、sendConfirmation 及 stage。stage 包含本地选择、范围、sourceRevision、capturedAt、完整选定 payload、goals 和 completionLinks。后者仅包含范围内原任务与范围外完成记录的最小身份关联，不外发范围外组或备注；预览须明示。

响应保持 requestId/result/context/accounting。result 为 summary 和 nextStageAdvice 数组；不生成或自动保存新计划。未知费用沿用有效候选 pending 交付、完整预留和新请求对账门禁。

总结额度独立；旧配置无总结额度则关闭总结，旧账本不重置已有次数。服务端严格验证实体、引用、范围、完成状态和确认；不信任界面计数。发送前重读相关本地事实，恢复代次必使旧确认失效；普通无关修订不无条件销毁结果。

## 验证顺序

冻结共同契约后并行实现，先相关单元测试，再统一类型/构建/控制 dry-run，冻结源码执行受影响 Chromium/WebKit。独立审查安全、预算兼容、隐私和结果生命周期。媒体元数据、实际播放、内容专业审核分别记录，缺失证据不得标为通过。
