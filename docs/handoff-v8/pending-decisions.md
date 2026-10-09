# V8 待审决定

执行授权：2026-10-10 用户最新规则。普通细节采用不丢数据、不编造数据、不打扰用户的保守方案；本清单记录后继续，不以“待审”阻塞开发。安全、隐私、外发、不可恢复数据改写、删除字段或改变字段含义、芽芽话术仍须先询问。规范按日集中到一个 PR，只升一次版本。以下无新增芽芽话术。

| 日期 / 项 | 情况 | 决定 | 理由 | 涉及文件 |
|---|---|---|---|---|
| 2026-10-10 / 自由训练（用户已批准） | 自由训练没有所属计划 | WorkoutRecord.planVersionId 可缺省；有 templateId 时仍必须有合法计划版本 | 不补造计划关联，继续校验真实关联 | src/domain/v8/contracts.ts、src/domain/schemas.ts、src/application/backup.ts |
| 2026-10-10 / 旧训练投影 | 原记录需进入新回顾，旧组没有独立完成时间 | 只读投影，保留原计划版本引用；新增可选 ReviewInput.legacyWorkouts；组保留 legacyUpdatedAt，不伪称 completedAt，不存重复训练记录 | 避免历史改写、重复计数与伪造时间；原组备注仍在旧表 | src/domain/v8/legacy-workouts.ts、src/domain/v8/contracts.ts、src/application/review/contracts.ts、src/persistence/v8-access.ts |
| 2026-10-10 / 旧状态 | 旧 completed 仅表示结束，不保证每组完成 | 对照真实目标逐组判断 complete/partial，零完成组为 not_started；进行中和放弃原样保留，未知目标不推断为全部完成 | 与真实组事实一致，不补造反馈或不适原因 | src/domain/v8/legacy-workouts.ts |
| 2026-10-10 / 每周目标 | 周期旧计划有合法 daysPerWeek，日期计划每份仅一天 | 周期计划直接取原 daysPerWeek（与已校验的 days.length/durationWeeks 等价）；单日独立计划保守取 1，不把全局当前引导偏好写成旧计划事实 | 不跨独立计划合并，不错用当前资料解释旧计划 | src/domain/v8/legacy-plans.ts |
| 2026-10-10 / 回归数据 | 部分旧测试混用新数据库元数据与旧备份头 | 更新当前版本断言；显式旧备份样本移除 V8 集合；旧表快照仅比较旧表并保留全部原字段 | 不通过放宽生产校验让测试通过 | tests/e2e/cal-*、capacity、guided-lifecycle、training-schedule、v31-transactions |

## 当日汇总

- 完成：#34 已合入；#35 本地迁移、备份与回归修复；自由训练契约、旧训练只读投影和每周目标修正已实施。
- 主线还差：#35 全绿合入；C 周/月回顾完整计算；A 青瓷挂载；E/F 主线数据接入与完整端到端；其余主题与后台后排。
- 本清单对应 V8.0.6 日合并；测试结果直接更新 PR，不新增独立验证文档。
