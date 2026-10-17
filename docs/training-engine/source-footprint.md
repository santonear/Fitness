# 引擎源码行数口径（M3 后）

统计范围仅为 src/engine/ 下非 generated/ 的 TypeScript 源码，递归包含所有阶段、契约、纯函数和校验文件；保留注释、类型、空行。测试、generated/、YAML/JSON 规则数据不计入此表，最终交付分别列账。格式化工具固定 Prettier 3.6.2，使用文件类型默认格式。M3 已按此格式拆分源码；本表只统计该冻结版本。

## 历史口径纠正

- 先前 15,776 行：同一范围的全部格式化源码，逐文件原始快照见 .cache/formatted-engine-line-baseline.json。
- 先前 10,740 行：上述范围扣除 duration.ts、validation.ts、selection.ts、safety.ts、planning.ts 五个待删旧模块，尚未计入保留合法辅助函数后的最终拆分。
- 用户昨天测得 2,680 未格式化行。该时间点的完整文件快照未随数字提供，不能把今天的文件冒充昨天的相同快照。当前相同文件集合的存盘物理行实测 2824 行（已有部分文件在本轮格式化，并非纯粹的旧压行快照），格式化 16006 行，比例 5.67 倍；排除五个旧模块后为 2184/10970 行。不同时间点新增修复及部分文件已格式化，导致数值变动。
- 膨胀原因是旧代码普遍把多条语句、对象字段和长回调写在同一物理行；标准格式化展开这些语句及嵌套结构。此前约 1,645 行估算采用未格式化口径，不能作为验收数字。本次不以压行、删注释、删类型减少行数。
- 本机 main 是初始化提交 35e112f，仅有 README/.gitignore，不能用它代表已发布产品。当前已核实的远端跟踪 origin/main 为 0165768（PR #60），其 src/engine/ 也不存在；此目录的新引擎基线为 0。旧基础计划逻辑位于 application/rules/basic-items.ts 等其他模块，不能把整份应用工作流当成可比的旧引擎行数。最终 PR 前须刷新并核验实际远端 main；本段只是当前本地跟踪证据。

## M3 后格式化源码

总行数：14751；共101个文件。测试、generated和规则数据均未混入。

| 阶段 | 格式化行数 |
|---|---:|
| candidates | 583 |
| checkHard | 1263 |
| contracts | 741 |
| data | 427 |
| dose | 1969 |
| gates | 1524 |
| fill | 216 |
| fit | 878 |
| independent validation | 353 |
| improve | 285 |
| pipeline | 362 |
| notices | 166 |
| operations | 663 |
| progression | 3135 |
| score | 1694 |
| skeleton | 330 |
| structure | 162 |

超过1500行的阶段列入后续架构简化评审：dose 1969行；gates 1524行；progression 3135行；score 1694行。该评审不阻塞此次交付。

| 文件 | 格式化行数 |
|---|---:|
| src/engine/candidates.ts | 144 |
| src/engine/candidates/caution-substitutions.ts | 111 |
| src/engine/candidates/eligibility.ts | 328 |
| src/engine/checkHard/coverage.ts | 129 |
| src/engine/checkHard/eligibility.ts | 230 |
| src/engine/checkHard/item-context.ts | 28 |
| src/engine/checkHard/item-dose.ts | 257 |
| src/engine/checkHard/item-structure.ts | 281 |
| src/engine/contracts.ts | 18 |
| src/engine/contracts/api.ts | 127 |
| src/engine/contracts/pipeline.ts | 125 |
| src/engine/contracts/plan.ts | 164 |
| src/engine/contracts/profile.ts | 307 |
| src/engine/data.ts | 400 |
| src/engine/dose.ts | 21 |
| src/engine/dose/assign.ts | 113 |
| src/engine/dose/budget.ts | 72 |
| src/engine/dose/capacity-types.ts | 31 |
| src/engine/dose/capacity.ts | 328 |
| src/engine/dose/floor-order.ts | 147 |
| src/engine/dose/limits.ts | 59 |
| src/engine/dose/prescribe.ts | 266 |
| src/engine/dose/rep-ranges.ts | 117 |
| src/engine/dose/roles.ts | 94 |
| src/engine/dose/transforms.ts | 59 |
| src/engine/dose/types.ts | 12 |
| src/engine/dose/volume.ts | 68 |
| src/engine/dose/warmup-fold.ts | 63 |
| src/engine/dose/warmup-identity.ts | 26 |
| src/engine/dose/warmup-realize.ts | 182 |
| src/engine/dose/warmup-source.ts | 201 |
| src/engine/environment.ts | 185 |
| src/engine/equipment.ts | 27 |
| src/engine/fill.ts | 216 |
| src/engine/fit.ts | 4 |
| src/engine/fit/elapsed-time.ts | 236 |
| src/engine/fit/estimate.ts | 109 |
| src/engine/fit/finalize.ts | 27 |
| src/engine/fit/fitting.ts | 394 |
| src/engine/fit/item-order.ts | 13 |
| src/engine/fit/requirements.ts | 92 |
| src/engine/fit/types.ts | 3 |
| src/engine/gates.ts | 63 |
| src/engine/gates/population-limits.ts | 129 |
| src/engine/gates/redflag-review.ts | 197 |
| src/engine/gates/state.ts | 343 |
| src/engine/gates/strength-scoring-population.ts | 120 |
| src/engine/gates/strength-scoring.ts | 389 |
| src/engine/hard-checks.ts | 338 |
| src/engine/history-checks.ts | 353 |
| src/engine/improve.ts | 285 |
| src/engine/index.ts | 86 |
| src/engine/notices.ts | 166 |
| src/engine/operations.ts | 4 |
| src/engine/operations/adjust.ts | 150 |
| src/engine/operations/modify.ts | 133 |
| src/engine/operations/result.ts | 72 |
| src/engine/operations/shared.ts | 95 |
| src/engine/operations/substitute.ts | 209 |
| src/engine/pipeline.ts | 276 |
| src/engine/postpartum-risk.ts | 98 |
| src/engine/power.ts | 104 |
| src/engine/progression.ts | 400 |
| src/engine/progression/confirmed-pain.ts | 239 |
| src/engine/progression/fatigue.ts | 77 |
| src/engine/progression/feedback.ts | 93 |
| src/engine/progression/finalize.ts | 70 |
| src/engine/progression/item-actions.ts | 106 |
| src/engine/progression/legacy-blocks.ts | 352 |
| src/engine/progression/legacy-candidates.ts | 247 |
| src/engine/progression/legacy-cooldown-ensure.ts | 231 |
| src/engine/progression/legacy-cooldown-plan.ts | 388 |
| src/engine/progression/legacy-cooldown.ts | 163 |
| src/engine/progression/legacy-target.ts | 353 |
| src/engine/progression/legacy-warmup.ts | 191 |
| src/engine/progression/load-step.ts | 81 |
| src/engine/progression/recovery-guards.ts | 116 |
| src/engine/progression/schedule.ts | 28 |
| src/engine/score.ts | 80 |
| src/engine/score/batch-helpers.ts | 103 |
| src/engine/score/evaluate.ts | 54 |
| src/engine/score/facts.ts | 191 |
| src/engine/score/goal-items.ts | 105 |
| src/engine/score/helpers.ts | 81 |
| src/engine/score/marginal.ts | 217 |
| src/engine/score/math.ts | 21 |
| src/engine/score/registry.ts | 179 |
| src/engine/score/targets-01.ts | 58 |
| src/engine/score/targets-02.ts | 8 |
| src/engine/score/targets-03.ts | 68 |
| src/engine/score/targets-04.ts | 158 |
| src/engine/score/targets-05.ts | 60 |
| src/engine/score/targets-06.ts | 72 |
| src/engine/score/targets-07.ts | 29 |
| src/engine/score/targets-08.ts | 33 |
| src/engine/score/targets-09.ts | 58 |
| src/engine/score/targets-10.ts | 27 |
| src/engine/score/types.ts | 92 |
| src/engine/skeleton.ts | 330 |
| src/engine/source-warmup.ts | 6 |
| src/engine/structure.ts | 162 |

## 单独列账（不计入引擎源码）

| 目录 | 文件数 | 存盘物理行数 | 字节数 |
|---|---:|---:|---:|
| src/engine/generated | 4 | 4 | 1282668 |
| tests/training-engine | 85 | 30240 | 1146816 |
| tests/unit/engine | 102 | 5204 | 491974 |
| data/training-engine | 24 | 60972 | 1087735 |


## M3 删除、兼容范围与验证证据

已删除五个旧入口模块：`duration.ts`、`selection.ts`、`safety.ts`、`planning.ts`、`validation.ts`。必要纯计算分别迁入 fit、candidates 和 gates；显式 V1 持久计划的源目标兼容计算以 `readLegacySourceTarget` 及 progression/legacy-* 最小依赖闭包保留。V2 和未知版本仍保留声明目标，不重建历史或改写已完成记录。

旧 validator 移至 `tests/training-engine/reference/legacy-validation.ts`，相关配对计算保留在同目录的 `legacy-duration-reference.ts`；原断言继续执行。这是测试参考逻辑搬迁，不是生产能力，也不是 V2 独立安全证明。旧 planning 测试改用真实 pipeline 入口。

`.cache/regression-after-m3-manifest.json`（seed 20261015）记录 golden20、固定80、问题177（125 weighted + 52 extreme）三组输出逐字节一致：`outputBytesEqual` 和 `commonOutputBytesEqual` 均为 true，新增、移除及变化索引均为空。此证据证明上述输入的 M3 前后输出一致，不替代最终2200画像及完整测试验收；计时值仅报告。

`.cache/m3-unused-summary.json` 使用 TypeScript 5.9.3 对101个文件做引用审计，汇总258项 referenced、87项 protected-review-only、3项 tests-only-reference-candidate，工具未列出零引用项；但其中存在仅导入而未调用的遗留，不能据此宣称没有未使用代码，或 M3 未引用清理全部完成。静态引用不等于可达性或行为证明。三个仅测试引用的保留项如下：

| 保留项 | 当前理由与证据边界 |
|---|---|
| `weeklyElapsedAllocation` | 保留周耗时汇总断言和 V1 测试参考消费；如 goal-time-share、continuous-cardio-side-clock、introductory-main-share。审计记录10处测试引用。 |
| `sourceConditioningSlot` | test-only legacy validator 实际调用，保留原连续有氧处方槽位检查及既有断言；不作为 V2 生产检查入口。审计记录2处测试引用。 |
| `circuitBudgetConflict` | 唯一测试引用为 legacy validator 的导入，当前没有实际调用；明确待清理，暂保留为 V1 参考遗留，不声称有行为覆盖。此次冻结不据此扩大删除范围。 |

最终统计仍为101文件、14751格式化行。dose1969、gates1524、progression3135、score1694超过阶段1500行目标，作为后续简化评审遗留；当前不通过压行、删除类型或注释达标。## M3 后格式化源码

总行数：14751；共101个文件。测试、generated和规则数据均未混入。

| 阶段 | 格式化行数 |
|---|---:|
| candidates | 583 |
| checkHard | 1263 |
| contracts | 741 |
| data | 427 |
| dose | 1969 |
| gates | 1524 |
| fill | 216 |
| fit | 878 |
| independent validation | 353 |
| improve | 285 |
| pipeline | 362 |
| notices | 166 |
| operations | 663 |
| progression | 3135 |
| score | 1694 |
| skeleton | 330 |
| structure | 162 |

超过1500行的阶段列入后续架构简化评审：dose 1969行；gates 1524行；progression 3135行；score 1694行。该评审不阻塞此次交付。

| 文件 | 格式化行数 |
|---|---:|
| src/engine/candidates.ts | 144 |
| src/engine/candidates/caution-substitutions.ts | 111 |
| src/engine/candidates/eligibility.ts | 328 |
| src/engine/checkHard/coverage.ts | 129 |
| src/engine/checkHard/eligibility.ts | 230 |
| src/engine/checkHard/item-context.ts | 28 |
| src/engine/checkHard/item-dose.ts | 257 |
| src/engine/checkHard/item-structure.ts | 281 |
| src/engine/contracts.ts | 18 |
| src/engine/contracts/api.ts | 127 |
| src/engine/contracts/pipeline.ts | 125 |
| src/engine/contracts/plan.ts | 164 |
| src/engine/contracts/profile.ts | 307 |
| src/engine/data.ts | 400 |
| src/engine/dose.ts | 21 |
| src/engine/dose/assign.ts | 113 |
| src/engine/dose/budget.ts | 72 |
| src/engine/dose/capacity-types.ts | 31 |
| src/engine/dose/capacity.ts | 328 |
| src/engine/dose/floor-order.ts | 147 |
| src/engine/dose/limits.ts | 59 |
| src/engine/dose/prescribe.ts | 266 |
| src/engine/dose/rep-ranges.ts | 117 |
| src/engine/dose/roles.ts | 94 |
| src/engine/dose/transforms.ts | 59 |
| src/engine/dose/types.ts | 12 |
| src/engine/dose/volume.ts | 68 |
| src/engine/dose/warmup-fold.ts | 63 |
| src/engine/dose/warmup-identity.ts | 26 |
| src/engine/dose/warmup-realize.ts | 182 |
| src/engine/dose/warmup-source.ts | 201 |
| src/engine/environment.ts | 185 |
| src/engine/equipment.ts | 27 |
| src/engine/fill.ts | 216 |
| src/engine/fit.ts | 4 |
| src/engine/fit/elapsed-time.ts | 236 |
| src/engine/fit/estimate.ts | 109 |
| src/engine/fit/finalize.ts | 27 |
| src/engine/fit/fitting.ts | 394 |
| src/engine/fit/item-order.ts | 13 |
| src/engine/fit/requirements.ts | 92 |
| src/engine/fit/types.ts | 3 |
| src/engine/gates.ts | 63 |
| src/engine/gates/population-limits.ts | 129 |
| src/engine/gates/redflag-review.ts | 197 |
| src/engine/gates/state.ts | 343 |
| src/engine/gates/strength-scoring-population.ts | 120 |
| src/engine/gates/strength-scoring.ts | 389 |
| src/engine/hard-checks.ts | 338 |
| src/engine/history-checks.ts | 353 |
| src/engine/improve.ts | 285 |
| src/engine/index.ts | 86 |
| src/engine/notices.ts | 166 |
| src/engine/operations.ts | 4 |
| src/engine/operations/adjust.ts | 150 |
| src/engine/operations/modify.ts | 133 |
| src/engine/operations/result.ts | 72 |
| src/engine/operations/shared.ts | 95 |
| src/engine/operations/substitute.ts | 209 |
| src/engine/pipeline.ts | 276 |
| src/engine/postpartum-risk.ts | 98 |
| src/engine/power.ts | 104 |
| src/engine/progression.ts | 400 |
| src/engine/progression/confirmed-pain.ts | 239 |
| src/engine/progression/fatigue.ts | 77 |
| src/engine/progression/feedback.ts | 93 |
| src/engine/progression/finalize.ts | 70 |
| src/engine/progression/item-actions.ts | 106 |
| src/engine/progression/legacy-blocks.ts | 352 |
| src/engine/progression/legacy-candidates.ts | 247 |
| src/engine/progression/legacy-cooldown-ensure.ts | 231 |
| src/engine/progression/legacy-cooldown-plan.ts | 388 |
| src/engine/progression/legacy-cooldown.ts | 163 |
| src/engine/progression/legacy-target.ts | 353 |
| src/engine/progression/legacy-warmup.ts | 191 |
| src/engine/progression/load-step.ts | 81 |
| src/engine/progression/recovery-guards.ts | 116 |
| src/engine/progression/schedule.ts | 28 |
| src/engine/score.ts | 80 |
| src/engine/score/batch-helpers.ts | 103 |
| src/engine/score/evaluate.ts | 54 |
| src/engine/score/facts.ts | 191 |
| src/engine/score/goal-items.ts | 105 |
| src/engine/score/helpers.ts | 81 |
| src/engine/score/marginal.ts | 217 |
| src/engine/score/math.ts | 21 |
| src/engine/score/registry.ts | 179 |
| src/engine/score/targets-01.ts | 58 |
| src/engine/score/targets-02.ts | 8 |
| src/engine/score/targets-03.ts | 68 |
| src/engine/score/targets-04.ts | 158 |
| src/engine/score/targets-05.ts | 60 |
| src/engine/score/targets-06.ts | 72 |
| src/engine/score/targets-07.ts | 29 |
| src/engine/score/targets-08.ts | 33 |
| src/engine/score/targets-09.ts | 58 |
| src/engine/score/targets-10.ts | 27 |
| src/engine/score/types.ts | 92 |
| src/engine/skeleton.ts | 330 |
| src/engine/source-warmup.ts | 6 |
| src/engine/structure.ts | 162 |

## 单独列账（不计入引擎源码）

| 目录 | 文件数 | 存盘物理行数 | 字节数 |
|---|---:|---:|---:|
| src/engine/generated | 4 | 4 | 1282668 |
| tests/training-engine | 85 | 30240 | 1146816 |
| tests/unit/engine | 102 | 5204 | 491974 |
| data/training-engine | 24 | 60972 | 1087735 |


## M3 删除、兼容范围与证据

五旧模块 duration.ts、selection.ts、safety.ts、planning.ts、validation.ts 已删除。必要计算迁入所属阶段；显式V1持久计划保留 readLegacySourceTarget 及 progression/legacy-* 最小依赖闭包，V2/未知版本不重建历史目标，不改写完成记录。旧 validator 及配对计算仅保留于 tests/training-engine/reference，原断言保留，不作为生产能力或V2独立安全证明；planning测试改用真实pipeline。

.cache/regression-after-m3-manifest.json（seed20261015）确认golden20、固定80、问题177（125 weighted+52 extreme）三组 outputBytesEqual/commonOutputBytesEqual 均true，added/removed/changedIndices 均空。只证明这些输入的前后输出逐字节一致，不替代2200全量及完整测试验收；计时仅报告。

.cache/m3-unused-summary.json使用TypeScript5.9.3审计101文件：258 referenced、87 protected-review-only、3 tests-only-reference-candidate。工具未列出零引用项，但不能据此宣称无未使用代码或M3未引用清理全部完成。weeklyElapsedAllocation的10处测试引用支持周耗时断言及V1参考；sourceConditioningSlot的2处测试引用包含legacy validator实际调用；circuitBudgetConflict仅被该参考导入、没有实际调用，明确待清理，不声称行为覆盖。静态引用不等于运行时可达性。

冻结统计101文件/14751格式化行；dose1969、gates1524、progression3135、score1694超过阶段1500行目标，列后续简化评审遗留，不以压行、删除类型或注释处理。测试、generated及规则数据另列。
