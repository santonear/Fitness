# 页面与 e2e 测试对照（2026-10-22）

改哪个页面，就先跑表里对应的 e2e 文件，例如 `npx playwright test tests/e2e/v9-me-reorg.spec.ts --project=chromium`；用独立配置的文件见下方「CI 分组」。全量只在 PR 和每晚跑。

表格按关键词粗略统计（路径、helper 名、页面标题），只作为起点，不保证完整；「试用 / 邀请码」也计入了 mock `/api/v1/trial/**` 的文件。

| 页面 | 路径 | 覆盖的 e2e 文件 |
|---|---|---|
| 初见三问 / 制定计划 | `/onboarding` | 26：ai-picked-dates, body-profile, english-ui, f-engine-environment, followup-finish, followup-pwa, mainline-polish, onboarding-v4-storage … |
| 计划草稿 | `/plan-draft` | 20：ai-picked-dates, body-profile, english-ui, f-engine-environment, followup-pwa, mainline-polish, plan-lifecycle, polish-coach … |
| 给未来的自己 | `/letter` | 21：ai-picked-dates, body-profile, english-ui, f-engine-environment, followup-finish, followup-pwa, mainline-polish, plan-lifecycle … |
| 今天（首页、肌肉图） | `/` | 21：assistant-v2, body-profile, english-ui, f-engine-environment, followup-finish, followup-pwa, mainline-polish, plan-lifecycle … |
| 今日重点 | `/today-focus` | 2：v9-me-reorg, v9-plan-upgrade |
| 训练中 / 完成 | `/workout/:id` | 16：acog-pregnancy, assistant-v2, b-postpartum-evidence, b-safety-entry, engine-followup, english-ui, f-engine-environment, followup-pwa … |
| 静心 | `/calm` | 1：v9-plan-upgrade |
| 活动记录 | `/activity` | 3：english-ui, followup-lifestyle, v8-mainline |
| 计划与版本 | `/plans` | 19：acog-pregnancy, assistant-v2, cal-plans, cal-safety, engine-followup, english-ui, f-engine-environment, fidelity … |
| 动作库 | `/exercises` | 10：coach-reminders, english-ui, followup-finish, mainline-polish, plan-lifecycle, polish-coach, repdb-catalog, training-engine … |
| 回顾 | `/review` | 15：assistant-v2, body-profile, followup-pwa, mainline-polish, plan-lifecycle-data, plan-lifecycle, polish-coach, review-suggestion-duration … |
| 手动训练 | `/manual` | 9：english-ui, mainline-polish, panel-fallback-dates, polish-coach, training-engine, training-guide-focus, v8-manual, v9-plan-calendar-nav … |
| 我的 | `/settings` | 19：assistant-round6, assistant-v2, body-profile, capacity-feedback, coach-reminders, english-ui, followup-lifestyle, guided-backup … |
| 外观 / 语言 | `/settings/appearance` | 13：acog-pregnancy, followup-finish, language-entry, mainline-polish, me-feedback, pr61-preview-fixes, training-engine, v8-coach-panel … |
| 身体资料 | `/settings/body` | 3：assistant-v2, body-profile, english-ui |
| 训练安全档案 | `/settings/engine` | 8：acog-pregnancy, assistant-body-change, b-safety-entry, engine-followup, english-ui, f-engine-environment, pr61-preview-fixes, training-engine |
| 自记录 | `/settings/changes` | 3：english-ui, v9-me-reorg, v9-plan-upgrade |
| 体能自测 | `/settings/fitness-test` | 2：v9-me-reorg, v9-plan-upgrade |
| 热量 / 营养素计算 | `/settings/calories, /settings/macros` | 1：v9-energy-calculators |
| 营养建议 | `/settings/nutrition` | 3：english-ui, followup-lifestyle, v9-me-reorg |
| 导入活动 | `/settings/import` | 1：followup-lifestyle |
| 试用 / 邀请码 | `/trial` | 22：acog-pregnancy, admin-account-actions, admin-h, ai-picked-dates, assistant-v2, b-postpartum-evidence, b-safety-entry, body-profile … |
| 芽芽对话 | `(浮窗)` | 21：ai-picked-dates, assistant-body-change, assistant-round6, assistant-schedule-migration, assistant-v2, body-profile, engine-followup, english-ui … |

单元测试不在表内：领域和引擎逻辑在 `tests/unit/`、`tests/training-engine/`，后台在 `tests/backend/`、`tests/admin/`。

## CI 分组（.github/workflows/ci.yml）

| 任务 | 配置 | 内容 |
|---|---|---|
| browser-main（2 片） | `playwright.config.ts` | `tests/e2e/` 下其余全部 spec |
| browser-flows | `playwright.trial.config.ts`、`tests/e2e/v8-mainline.config.ts`、`tests/e2e/mainline-polish.config.ts`、`tests/e2e/v8-plan-review.config.ts`、`playwright.v8-coach.config.ts` | 试用、主线、主线细节、计划回顾、教练面板 |
| browser-followup | `tests/e2e/followup-finish.config.ts`、`followup-pwa.config.ts`（打包后的应用） | 完成页、离线 PWA |
| browser-engine | `tests/e2e/training-engine.config.ts` | 训练引擎 |
| browser-admin | `tests/admin/*.config.ts` | 后台 |

- 标了 `@screens` 的测试只是截主题和宽度截图，PR 和推送时跳过，每晚和手动运行时才跑。
- 所有截图都写到 `test-results-review/`，这个目录被 git 忽略。`outputs/` 里的是历史评审图，测试不会再改它们。
