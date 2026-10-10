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

## C 回顾计算待审补充

| 情况 | 决定 | 理由 | 涉及文件 |
|---|---|---|---|
| 新旧输入可能包含相同训练 ID | 按 ID 去重，原生 V8 记录优先；旧投影只读 | 防止重复统计 | src/application/review/compute.ts |
| 自由训练没有计划 | 不计每周计划目标或规范定义的“计划训练+活动”次数；实际有效用时与动作数据仍参与训练统计 | 不伪造计划归属、不丢实际训练 | src/application/review/compute.ts |
| 月边界跨周 | 图表按周一分组，只计本月事实；缺少次数按这些周的完整训练数计算，不给零散日期补训练 | 保持自然月范围及完整/部分区分；界面不将此值表述为“错过” | src/application/review/compute.ts |
| 多项动作进步并列 | 按相对提升排序，每动作最多一项、合计最多两项；只有存在前期真实值才比较 | 不把首次记录称为进步，不新增芽芽话术 | src/application/review/compute.ts |

本地验证：11 项计算单元测试与类型检查通过。此前 C 的 WebKit 日期采用用例定向复测通过，未改业务或盲目重跑旧 CI。完整新 CI 仍须通过。
## A 线主题偏好补充

| 日期 | 情况 | 决定 | 理由 | 涉及文件 |
|---|---|---|---|---|
| 2026-10-10 | 合法 V8 主题偏好与旧版偏好同时存在 | 使用已保存的合法 V8 选择；两个键均保留，不再阻塞迁移，不覆盖为青瓷 | 尊重较新的显式选择，保留旧值可回退，不打扰用户；依用户最新自主决定规则 | src/themes/preference.ts、tests/unit/v8-theme-preference.test.ts |

## 青瓷主线接入（2026-10-10）

| 情况 | 决定 | 理由 | 涉及文件 |
|---|---|---|---|
| 首次联调需要无费用的完整保存闭环 | 本地 VITE_FITNESS_V8=1 接入真实数据库和基础计划；候选确认前不写计划 | 不调用付费模型，先验证主线的数据闭环 | src/application/v8-workflow.ts、src/ui/mainline |
| 自由文本时间范围与场地 | 复用合法档位映射；20 分钟保留；无法识别场地不默认成在家 | 保留原话，避免编造资料 | src/application/rules/local-profile.ts |
| CI 默认浏览器配置没有 V8 开关 | 新主线套件使用独立配置，在 browser-flows 执行，默认套件排除它 | 避免错误环境重复执行 | playwright.config.ts、.github/workflows/ci.yml |

本轮验证：类型检查通过；基础计划和解析 6 项单元测试通过；Chromium 主线 2 项通过，覆盖候选确认、训练保存与刷新恢复、主题切换、反馈回顾、引导恢复及成人确认。没有模型请求。青瓷 390/1440 截图已生成；真机未验证。

当前进度：B/C 已随 #31 合入集成分支。A/E 与应用主线已在 codex/v8-qingci-mainline 接入。尚未完成：AI 主线、训练换动作、计划版本完整页面、旧引导资料回填、字体打包、其他主题完整验收及最终清理。本地基础版本不代表 V8 全部验收完成。

## 原型主线纠正（用户确认，2026-10-10）

| 情况 | 决定 | 理由 | 涉及文件 |
|---|---|---|---|
| 注意部位被当成整份计划的阻断条件 | 成年人仍生成基础草案，按保守部位排除清单选动作；不足4个时保留部分草案，未说明的其他限制可保留空草案但不允许保存空计划 | 用户明确批准安全优先、不要凑动作；只有未确认成年不生成计划 | basic-items.ts、v8-workflow.ts、PlanDraftPage.tsx |
| 旧版单次多日生成是否拆分 | 已查明 guided.saveIndependentCandidate 使用 saveDayPlans 为每日期建立独立 plan；created 事件 after 为 independent-candidate:ID，reason 保存 planIds。旧 confirmCandidate 也逐日保存，用 programs.candidateId / planIds 关联 | 使用原代码的明确归属，不能猜测同名或相近生成时间 | src/application/guided.ts、src/domain/v8/legacy-groups.ts |
| 同批同时有效的单日计划 | 按明确候选/请求归属分组，只合并 active、未删除且排期未隐藏/跳过者；冲突归属不合并；使用该组原当前计划作为代表，汇集各训练单；所有旧表和旧记录关联原样保留 | 执行最新用户纠正，取代此前“不合并、单日目标固定1”的决定 | legacy-plans.ts、legacy-groups.ts |
| 日期计划每周目标 | 按最早至最晚排期的含首尾天数向上取整为覆盖周数；不同训练日期数除以周数，四舍五入后限制1–7；无排期证据保守取1 | 对应用户平均每周次数要求；不把一日推断为每周7次 | legacy-groups.ts及单元测试 |
| 无器械上拉 | 增加 Fitness 自编“自阻力划船”，稳定ID，不使用或冒充RepDB素材；旧四个内置动作顺序和ID保持不变 | 基础计划可覆盖推拉下肢核心，不假定用户有哑铃或弹力带 | src/catalog/exercises.ts、exercise-ids.ts |
| 暂停里的放弃 | 保留实际已完成组，标记abandoned并从回顾排除；按钮直写“不计入回顾” | 不按原型演示删除已有训练事实 | WorkoutPage.tsx、v8-workflow.ts |
| 训练换动作 | 原计划和已完成组不变；追加替换事实，仅未来组采用新动作；不适原因单独留存 | 避免将“只换今天”误写入整份计划或历史 | v8-workflow.ts |

本轮主线页面已独立拆分；可见文案移入 features 中英资源。首页只推荐一份并可换一份；青瓷主卡流光；单动作训练、数字编辑、自由切换、替换、暂停三选项、Wake Lock；标签式结束反馈；外观在设置。已在浏览器渲染原型对照。真机常亮行为仍需实际设备验证。

验证：86个测试文件、722项通过，5项既存todo；三项主线浏览器测试通过（后续增量会再次验证受影响项）。PR #36已合入；本轮尚未公网发布。第3、4部分的完整工作仍待继续，现有V8测试数据库不通过覆写旧版本来追改迁移结果；旧版本导入/升级使用修正投影。
