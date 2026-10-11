# 主线修复与动作体验验收

隔离预览：https://fitness-mainline-polish-preview.initdevl.workers.dev

Worker版本：a0890b43-d869-4710-8520-455b76eb6fcf；应用代码 e9a06c8，PR #52 本轮开关保持、旧计划重用与回顾/焦点修复。2026-10-11，Chromium新浏览器资料，375/1280宽度；回顾入口额外检查320宽度及多处滚动位置。合成输入，无真实设备、无付费模型。截图关闭捕获时动画。

新增复查截图：
- [375空筛选恢复](preview-375-manual-empty-recovery.png) / [1280](preview-1280-manual-empty-recovery.png)
- [375回顾入口](preview-375-review-coach-clearance.png) / [1280](preview-1280-review-coach-clearance.png)
- [剩余466项通用指导清单](../../docs/verification/catalog-generic-guidance-remaining.md)

新增审计修复截图：
- [375手动相近结果](preview-375-manual-near-matches.png) / [1280](preview-1280-manual-near-matches.png)
- [375手动完整指导](preview-375-manual-full-guide.png) / [1280](preview-1280-manual-full-guide.png)
- [375动作库完整指导](preview-375-library-full-guide.png) / [1280](preview-1280-library-full-guide.png)
- [375手动AI候选模拟](mock-375-manual-ai-candidate.png) / [1280](mock-1280-manual-ai-candidate.png)：仅本地HTTP合成返回，验证重复动作目标、估算和确认界面，不能当作真实DeepSeek响应证据。

- [preview-1280-appearance-撞色.png](preview-1280-appearance-撞色.png)
- [preview-1280-appearance-留白.png](preview-1280-appearance-留白.png)
- [preview-1280-appearance-青瓷.png](preview-1280-appearance-青瓷.png)
- [preview-1280-appearance-静奢.png](preview-1280-appearance-静奢.png)
- [preview-1280-appearance.png](preview-1280-appearance.png)
- [preview-1280-coach-local-pain.png](preview-1280-coach-local-pain.png)
- [preview-1280-digits-撞色.png](preview-1280-digits-撞色.png)
- [preview-1280-digits-留白.png](preview-1280-digits-留白.png)
- [preview-1280-digits-青瓷.png](preview-1280-digits-青瓷.png)
- [preview-1280-digits-静奢.png](preview-1280-digits-静奢.png)
- [preview-1280-draft-guide.png](preview-1280-draft-guide.png)
- [preview-1280-draft.png](preview-1280-draft.png)
- [preview-1280-finish.png](preview-1280-finish.png)
- [preview-1280-manual-cards.png](preview-1280-manual-cards.png)
- [preview-1280-manual-filter.png](preview-1280-manual-filter.png)
- [preview-1280-manual-search.png](preview-1280-manual-search.png)
- [preview-1280-pause.png](preview-1280-pause.png)
- [preview-1280-repdb-guide.png](preview-1280-repdb-guide.png)
- [preview-1280-week-review.png](preview-1280-week-review.png)
- [preview-1280-workout-guide.png](preview-1280-workout-guide.png)
- [preview-1280-workout.png](preview-1280-workout.png)
- [preview-375-appearance-撞色.png](preview-375-appearance-撞色.png)
- [preview-375-appearance-留白.png](preview-375-appearance-留白.png)
- [preview-375-appearance-青瓷.png](preview-375-appearance-青瓷.png)
- [preview-375-appearance-静奢.png](preview-375-appearance-静奢.png)
- [preview-375-appearance.png](preview-375-appearance.png)
- [preview-375-coach-local-pain.png](preview-375-coach-local-pain.png)
- [preview-375-digits-撞色.png](preview-375-digits-撞色.png)
- [preview-375-digits-留白.png](preview-375-digits-留白.png)
- [preview-375-digits-青瓷.png](preview-375-digits-青瓷.png)
- [preview-375-digits-静奢.png](preview-375-digits-静奢.png)
- [preview-375-draft-guide.png](preview-375-draft-guide.png)
- [preview-375-draft.png](preview-375-draft.png)
- [preview-375-finish.png](preview-375-finish.png)
- [preview-375-manual-cards.png](preview-375-manual-cards.png)
- [preview-375-manual-filter.png](preview-375-manual-filter.png)
- [preview-375-manual-search.png](preview-375-manual-search.png)
- [preview-375-pause.png](preview-375-pause.png)
- [preview-375-repdb-guide.png](preview-375-repdb-guide.png)
- [preview-375-week-review.png](preview-375-week-review.png)
- [preview-375-workout-guide.png](preview-375-workout-guide.png)
- [preview-375-workout.png](preview-375-workout.png)


补充截图：preview-375/1280-manual-illustration-高脚杯深蹲.png、preview-375/1280-manual-illustration-自阻力划船.png。源图和姿势参考说明见public/media/NOTICE.md；未做专业姿势审查。23项媒体针对性单元通过，类型/构建/V8样式通过。旧测试选择器与备份版本同步，远程完整CI以PR52最新检查为准。

上次五项修正预览：16/16通过（46.6秒）；当时集成单元895通过、29跳过、5待办，类型/构建/样式检查通过。跳过和待办为已有项目项，不计入通过数。

## 计划删除补充验收（2026-10-11）
- 上轮预览18/18通过（1.1分钟）：含删除、10秒撤销、设置恢复、以前的计划、删除后回顾数字不变。planLifecycle仅在隔离预览开启。
- 集成单元907通过，29跳过、5待办；类型、构建、样式/话术和前后端边界通过。
- Chromium/WebKit生命周期、真实IndexedDB DB10→11与旧版迁移、清理/恢复事务回滚共46项通过（初轮34通过，修正草案跳转、提示文字节点与旧格式测试预期后12项通过）。
- 日期计划/引导备份/训练时间旧契约16项通过；当前容量夹具小备份与断网恢复2项通过。
- 全部16份旧UI导出样本（含此次旧预览DB10真实导出）往返保留事实。模板ID可与历史调整快照ID不同，保留旧合法数据。新数据库11、备份9；生产发布与兼容回退仍需用户验收。
- [375删除确认](preview-375-plan-delete-confirm.png) / [1280](preview-1280-plan-delete-confirm.png)
- [375无计划首页](preview-375-no-plan.png) / [1280](preview-1280-no-plan.png)
- [375设置恢复](preview-375-plan-restore.png) / [1280](preview-1280-plan-restore.png)
- [375以前的计划](preview-375-previous-plans.png) / [1280](preview-1280-previous-plans.png)

桌面浏览器模拟不等于真机；本轮无付费模型调用。远程CI以PR最新提交为准。

## 本轮复查补充验收（2026-10-11）
- 单元919通过，29跳过、5待办；类型、构建、样式与前后端提示词边界检查通过。
- Chromium/WebKit共38项最终通过：首轮37通过，修正测试等待旧引导进度恢复后，1项WebKit复验通过。覆盖离线、模拟后台90秒、失败后重载、删除/恢复/撤销、重新启用及训练事实不变、无计划周/月回顾、各动作面板真实触发按钮回焦（两种动效）。
- 公网预览375/1280共20项最终通过：18项原有流程通过，修正同一引导等待时序后2项新增组合流程通过。无付费模型；浏览器模拟不冒充iPhone真机。
- 独立审查发现公共配置端点缺键被补false，已改为保留缺键、读取故障503；内部安全门仍默认关闭。单测覆盖显式false与缺键区别。
- [375离线恢复](preview-375-offline-restore.png) / [1280](preview-1280-offline-restore.png)
- [375无当前计划回顾](preview-375-no-plan-review.png) / [1280](preview-1280-no-plan-review.png)
- [375重新使用确认](preview-375-reuse-confirm.png) / [1280](preview-1280-reuse-confirm.png)
- [375切换后的以前计划](preview-375-reuse-previous-list.png) / [1280](preview-1280-reuse-previous-list.png)
- 只更新PR52和隔离预览；尚未合并或生产部署。远程CI以最新提交为准。
