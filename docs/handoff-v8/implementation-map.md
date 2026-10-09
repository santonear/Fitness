# V8 implementation map — Wave 0

状态：Wave 0 接口候选已完成，待用户整体验收。唯一设计规范为 docs/uiux/UIUX20261008.md。

基线：9d2a2120e85fbe33e025734ee1ce5433fe0ce92c；集成分支 v8/integration。主目录旧工作树保留不动。

## 波次与文件所有权

|线|工作树 / 分支（Wave 1/2 启动时创建）|独占文件范围|
|---|---|---|
|0 统筹|fitness-v8-integration / v8/integration|AGENTS.md、DESIGN.md、规范归位文件、docs/handoff-v8、CI、tools/v8、路由表、共享接口冻结文件|
|A|fitness-v8-a / codex/v8-a|src/themes（G 接手前）、src/ui/components/common/、public/fonts/、src/ui/theme.css、Appearance.tsx、AppIcon.tsx、NavigationIcon.tsx；不改其他业务组件|
|B|fitness-v8-b / codex/v8-b|src/persistence/、src/domain/models.ts、schemas.ts、src/domain/v8/、src/application/backup.ts、plans.ts、workouts.ts、day-plans.ts；对应数据测试|
|C|fitness-v8-c / codex/v8-c|src/application/review/、src/application/rules/、src/application/coach-reminders.ts、src/domain/coach-reminders.ts；对应规则/提醒测试|
|D|fitness-v8-d / codex/v8-d|src/coach/、src/backend/（不改后台页面）、src/application/coach-context.ts、coach-plans.ts、AI评测与对应测试|
|E|fitness-v8-e / codex/v8-e|src/ui/pages/training/、src/ui/pages/onboarding/、src/i18n/features/training/、onboarding/；对应E2E|
|F|fitness-v8-f / codex/v8-f|src/ui/pages/plan/、review/、settings/、src/ui/components/FloatingCoach.tsx、CoachAvatar.tsx、CoachPreferences.tsx、CoachNudge.tsx、src/i18n/features/plan/、review/、settings/、coach/；对应E2E|
|G|fitness-v8-g / codex/v8-g|src/themes/liubai/、jingshe/、zhuangse/；A 合并后转交，不改页面|
|H|fitness-v8-h / codex/v8-h|src/ui/pages/ManagementPage.tsx、src/ui/admin/、src/i18n/features/admin/；后台UI测试，不改后端|

共享接口仅由统筹修改，必须先获用户确认；目录所有权不授予冻结接口修改权。Wave 0 串行，不启动 A–H。Wave 1 A–D，Wave 2 E–H；实际平台最多4个代理槽，含统筹，不超过用户5条线限制。

## 验证与限制

- CI骨架拒绝新页面颜色/字体、主题选择器越界、开发入口、独立文案中的禁用词。旧文件按规则/路径暂列baseline，第3波清零；不是完整样式验收。
- 现有类型检查、单元、浏览器CI保留。未增加模型调用、数据库升级或产品入口。
- Dexie 当前最高版本7，下一版本8只预留，不注册升级。
- 未创建所有工作流以避免在冻结接口前分叉。
- 用户已确认 not_started 不计次数；时长按规范 C.2 映射，不追问。计划保留原话及15–120分钟实际时长。

## 现有文件逐项处置

|文件|处置|负责线 / 原因|
|---|---|---|
|src/application/ai-candidate-save.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/ai-context.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/backup.ts|改造|B：扩展存储与兼容迁移，历史事实保留|
|src/application/body-weight.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/coach-plans.ts|改造|D：接入新任务，保留写入授权边界|
|src/application/coach-reminders.ts|改造|C：仅用户设置的前台提醒|
|src/application/day-plans.ts|改造|B：旧资料与历史读取保留；新流程按冻结契约接入|
|src/application/guided-history.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/application/guided.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/application/history-context.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/legacy-collisions.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/plans.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/profile.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/progress-calculation.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/progress.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/stage-summary-core.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/stage-summary.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/timers.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/training-memory.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/application/workouts.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/domain/calendar.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/domain/coach-reminders.ts|改造|C：仅用户设置的前台提醒|
|src/domain/day-date-projection.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/domain/day-plan-contracts.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/domain/day-slot-policy.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/domain/errors.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/domain/guided-ai-contracts.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/domain/guided-contracts.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/domain/guided-limits.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/domain/models.ts|改造|B：扩展存储与兼容迁移，历史事实保留|
|src/domain/onboarding-v4.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/domain/onboarding-v5.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/domain/schemas.ts|改造|B：扩展存储与兼容迁移，历史事实保留|
|src/domain/timer.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/domain/training-time.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/domain/units.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/i18n/en.json|保留|0：保持既有业务边界，按需由统筹转交|
|src/i18n/index.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/i18n/zh.json|保留|0：保持既有业务边界，按需由统筹转交|
|src/persistence/db.ts|改造|B：扩展存储与兼容迁移，历史事实保留|
|src/persistence/repository.ts|改造|B：扩展存储与兼容迁移，历史事实保留|
|src/ui/analytics-theme.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/App.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/calendar-projection.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/coach.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/components/AiCandidateEditor.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/Appearance.tsx|改造|A：主题与陶瓷组件|
|src/ui/components/AppIcon.tsx|改造|A：主题与陶瓷组件|
|src/ui/components/BackupPanel.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/CoachAvatar.tsx|改造|F：保留全局单实例与状态|
|src/ui/components/CoachNudge.tsx|改造|F：保留全局单实例与状态|
|src/ui/components/CoachPlanActions.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/CoachPreferences.tsx|改造|F：保留全局单实例与状态|
|src/ui/components/CoachScopeDetails.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/CompletionReview.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/DateCalendar.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/DayPlanEditor.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/DayPlansPanel.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/ExerciseDetails.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/ExerciseEditor.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/ExerciseMedia.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/ExerciseTargets.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/FloatingCoach.tsx|改造|F：保留全局单实例与状态|
|src/ui/components/guided/CandidateEditor.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/GuidedMeasurements.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/GuidedOnboarding.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/index.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/LifecycleDialog.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/NumericWheel.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/onboarding-content.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/onboarding-v4-content.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/OnboardingInputDialog.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/ProgramDashboard.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/QuestionIllustration.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/ScheduleConfirmation.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/TrainingAnalytics.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/TrainingCalendar.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/TrainingTimeEditor.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/guided/V4Wheel.tsx|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/components/HistoryDetail.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/ManualInvites.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/NavigationIcon.tsx|改造|A：主题与陶瓷组件|
|src/ui/components/OnboardingGate.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/PlanDatePicker.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/PlanEditor.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/RepDBAttribution.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/RepDBMedia.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/StageSummaryAi.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/StageSummaryPreview.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/TrialAccess.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/WorkoutLifecycleControls.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/components/WorkoutTimer.tsx|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/day-plan-feedback.ts|改造|0：旧资料与历史读取保留；新流程按冻结契约接入|
|src/ui/guided-theme.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/guided.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/icons-v5.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/legacy-confirmation.ts|保留|0：保持既有业务边界，按需由统筹转交|
|src/ui/onboarding-theme.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/onboarding-v4.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/pages/AiPage.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/CatalogPage.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/GuidedDialoguePage.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/GuidedHome.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/ManagementPage.tsx|改造|H：后台紧凑UI|
|src/ui/pages/OnboardingV4Page.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/PlansPage.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/PlansWorkspace.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/ProgressPage.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/SettingsPage.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/TodayPage.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/pages/WorkoutPage.tsx|改造|0：E/F在独占目录实现新页，统筹第3波替换旧路由|
|src/ui/styles.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/training-calendar.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/trial-access.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/ui-ux-max-theme.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/v31-ai.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/v31-plans.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/v31-progress-catalog.css|删除|0：第3波替换并确认无引用后删除；暂不删除|
|src/ui/v31.css|删除|0：第3波替换并确认无引用后删除；暂不删除|

## 冻结接口与测试桩

|文件|接口 / 后续实现者|
|---|---|
|src/themes/contract.ts|九签名组件 props、令牌名、可扩展 ThemeManifest；A 实现，G 只消费|
|src/domain/v8/contracts.ts|V8 数据、反馈、提醒、ScheduleMapping、Dexie 8 类型占位；B 实现|
|src/application/review/contracts.ts|周/月事实、建议、基础计划签名；C 实现|
|src/coach/contracts.ts|四任务 zod 请求/响应及适配函数类型；D 实现|
|src/ui/routes.contract.ts|页面路径、文件名、E/F/H 所有权；统筹接入旧路由兼容|
|src/i18n/namespaces.contract.ts|每功能中英独立文件；common 归 A，coach 归 F|
|tests/unit/v8-contracts.test.ts|4项当前契约测试＋5项明确 TODO；统筹维护接口断言，B/C/D在各自测试目录实现业务验证|

上述文件在用户批准 Wave 0 后冻结。任何变更先停下向用户确认，由统筹统一修改；所属目录负责人不得自行改接口。

## Wave 0 证据

- TypeScript --noEmit 通过。
- 契约测试4通过、5 TODO；TODO并非已实现或通过的业务测试。
- CI检查器3通过；0新增违规，2条旧文件规则豁免待第3波清理。
- Chromium原型：只换今天后计划JSON及版本未变，当前训练动作变为臀桥。
- 未注册Dexie版本8、未接入路由、未调用AI或改动公网；真机未验证。
- 规范全文搬入及原型是交接文件，不计手写有效代码行数；本次规范导入较大，在PR单独注明。

## 后续仍需兑现的验证

真实旧备份3份由B线验收；当前未取得，不能用合成夹具代替。CI骨架不等于全部V8机械验收；数值字号/圆角/阴影、对比度与触控几何验收由A补齐。旧路由Trial/Backup/历史等由统筹保持兼容，不因新路由表遗漏而删除。
