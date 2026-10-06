# 同源服务与阶段总结验证

日期：2026-10-06。基线：a495cd733007e363efe4f14d0a507493bc68f3be。
工作区：D:/Project/xxgospel/Fitness/.worktrees/fitness-summary。
分支：codex/summary-service-integration。

## 实现结果

- 同源Worker装配：资产与API分流，默认CONTROL_MODE=disabled；旧静态配置保留，无新增资源或数据库迁移。
- 总结后端：严格阶段事实和结果契约、独立次数/预留、去重、取消、待核算及账本恢复兼容。首次用户的总结次数明确返回0；启用总结后的恢复证据必须明确提供总结次数。
- 总结界面：本地准备不外发；资格查询后展示完整本次发送JSON并独立确认；返回总结和建议仅展示，不写计划、训练或备忘。无关修订复核相关事实，恢复必使旧确认失效；恢复整页重载不保留页面候选。
- 四动作媒体：增加plank及walking固定资源，修正YouTube iframe Referer配置，保留失败、重试、关闭及文字回退。walking是防跌综合内容，普通健身步行教学仅有限覆盖。

范围外补练通过最小task/session/version/day关联保留完成归属，不外发范围外组和备注。后端只能核对实际传入的事实及引用，不能证明未外发整库的完整性。

## 验证

Windows；Node24；TypeScript5.9.3；Vitest4.1.11；Playwright1.63.0；Wrangler4.147.0。

1. npm run check：40文件、246单元测试、类型检查和构建通过。新增纯计算提取保留既有阶段/进度结果；管理CLI支持总结元数据与显式核算证据。
2. Chromium/WebKit，独立5226端口，320px，全部使用隔离合成库及mock：72个不同相关用例具有最终有效通过证据。72项批次中70项通过；两项失败为旧文案断言，修正后阶段16项全部通过（31.4秒，含这两项）。重复用例不累计。范围包括stage-summary、stage-summary-ai、media、media-retry、ai-public-flow、ai-control-status、ai-pending、fidelity、feedback。
3. 早期阶段用例的语言保存等待与恢复后控件断言已修正；仍逐表比较数据库，不放宽无写库断言。恢复沿用原整页重挂载，不要求旧页面结果跨恢复保存。
4. wrangler deploy --config wrangler.fullstack.jsonc --dry-run：通过；13资产，859.69KiB Worker（gzip140.09KiB），仅ASSETS与disabled变量，无D1或模型配置；无上传部署。打包产物无Dexie/IndexedDB依赖。
5. 针对性独立审查发现首次资格计数和账本恢复缺计数两问题，均补充复现及回归；差异格式检查通过。

## 未验证及发布边界

没有新增真实总结模型调用、账单、内容质量、供应商延迟、真实手机、Linux CI或生产容量证据。默认关闭策略不代表正式启用配置已验证。真实手机继续暂缓。

媒体来源和四视频元数据核实不等于实际播放、地区可用性或专业内容审核；详见media-completion-2026-10-06.md。

本轮结果在本地分支，未推送、创建PR、合并或公网发布。公网保持既有PR8版本与AI关闭状态。正式启用总结还需明确配额/费用边界、origin、供应商测试及控制资源配置；部署代码与启用模型分开进行。
