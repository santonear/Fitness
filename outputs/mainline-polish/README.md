# 主线修复与动作体验验收

隔离预览：https://fitness-mainline-polish-preview.initdevl.workers.dev

Worker版本：10f4af19-9b80-4375-b773-e4f672a4ebdd；PR #52 用户复查五项修正。2026-10-11，Chromium新浏览器资料，375/1280宽度；回顾入口额外检查320宽度及多处滚动位置。合成输入，无真实设备、无付费模型。截图关闭捕获时动画。

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

本次公网预览：16/16通过（46.6秒）；集成单元895通过、29跳过、5待办，类型/构建/样式检查通过。跳过和待办为已有项目项，不计入通过数。
