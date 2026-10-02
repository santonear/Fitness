# Fitness 本地 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or, if the user selects delegated execution, superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 交付可在本地使用的中英文健身 Web 应用，完成手动计划、训练、进度、全量训练备忘与备份闭环。

**Architecture:** 浏览器 IndexedDB 是训练事实权威存储，领域规则独立于 React。训练备忘与记录同事务更新，AI 在后续阶段读取已确认上下文；本阶段无需云账号或模型密钥。

**Tech Stack:** React、TypeScript、Vite、React Router、CSS Modules、Dexie、Zod、i18next、Vitest、Playwright；后续 Hono、Cloudflare Workers/D1/R2。

**Spec:** [SDD v0.7](../../software-design.md)、[技术与部署](../../technology-deployment.md)、[视频清单](../../video-sources.md)。

日期：2026-10-03；状态：用户已批准开始，采用子代理实现与独立审查，由主代理整体把关。当前仓库仅文档，没有产品代码。本文件是第一阶段详细计划；第二、三阶段在本文件尾部给出路线和验收，接入前分别细化实施计划，避免用未经实测的接口承诺上线效果。

## Global Constraints

- 手机优先 Web；zh/en；公制；普通成年人健身，力量/有氧/徒手；无登录本地数据。
- 自动计划周期整数 1–12 周；固定星期数量与每周天数一致；按起始日连续 7 天划分周。
- 最多一个当前计划及一个进行中训练；完成记录只读，不可修改或删除。
- 每组主动记录后保存；训练完成前汇总确认；全部历史留存本地备忘，离线更新不调用 AI。
- 本地数据库可能被浏览器清理；JSON 手动备份恢复，整库替换前先备份并确认，失败不部分覆盖。
- 月总预算 ¥100：Worker/D1 预留 ¥40、AI ¥35、媒体 ¥5、余量 ¥20；不能把估算当作账单保证。
- AI 默认月每人 8 次目标理解、4 次计划、4 次总结，仍受全局预算；目标20秒/计划120秒/总结60秒待实测。
- 近期完整记录＋较早历史可追溯摘要；本地始终全量。近期28天为工程默认，可调整；摘要本地计算，不新增模型调用。
- 图片公开访问、YouTube 官方嵌入，AI 邀请码保护；首阶段尚未审核媒体不用假资源占位。
- iPhone Safari、Android Chrome、桌面 Chrome/Edge/Safari；Playwright WebKit 不能代替真实 Safari 验收。
- 不在第一阶段安装云凭据、调用真实模型、发布外部服务；版本在搭建时核验并锁定。执行前检查适用 AGENTS.md 与工作区已有修改，不覆盖用户改动。

## Review Focus

1. 多标签页同时训练/导入：revision 或导入锁阻止覆盖与重复；任务5、8验证。
2. 浏览器配额不足或事务中断：事实与备忘一起成功或回滚；任务3、5、8验证。
3. DST、改时区和补练跨阶段：原日程与实际历史口径保持一致；任务4、7验证。
4. 旧目录及备份版本：历史快照可读、未知引用拒绝、迁移不丢原记录；任务2、8验证。
5. 后台节流与系统时钟变化：计时恢复有明确状态，提醒失败不影响保存；任务6验证。

## 文件与任务约定

类型和运行时契约集中于 src/domain，应用命令通过 src/application 操作仓储，UI 不直接写数据库。每个任务列出的路径都相对于仓库根目录 D:/Project/xxgospel/Fitness；全部为拟创建文件，README.md 为修改。命令逐条执行，不用分号作为实际 shell 组合。每项实现保留最小必要测试，不为低影响样式或实现镜像添加测试。

接口中的输入/返回类型在任务2定义于 models.ts/schemas.ts；FitnessDatabase 在任务3定义。LocalDate 为 YYYY-MM-DD 字符串，Locale 为 zh/en，Revision 为整数；TimePoint 为 UTC ISO 字符串，nowMs 为毫秒时间戳。错误统一 DomainError(code, details)，UI 使用翻译键。数据库查询异步、纯计算同步，禁止在 IndexedDB 事务内等待网络。

---

### Task 1: 可启动的双语应用与测试工具

**Files:** package.json、package-lock.json、vite.config.ts、tsconfig.json、vitest.config.ts、playwright.config.ts、src/main.tsx、src/ui/App.tsx、src/ui/styles.css、src/i18n/index.ts、src/i18n/zh.json、src/i18n/en.json、tests/e2e/shell.spec.ts。

**Interfaces:**
- Consumes: 无产品依赖；实施时核验 React/Vite/测试工具与 Node 24 的兼容性，锁定安装版本。
- Produces: App(): ReactElement；五个导航入口；npm run typecheck / test / build / test:e2e。

- [ ] **Step 1:** 编写行为测试：shell.spec.ts：320px 视口无横向溢出；键盘可到达导航；切换 zh/en 并刷新仍保留选择；未知语言回退 en。
- [ ] **Step 2:** 运行对应测试，确认因未实现行为失败；任务1先建立可执行的最小工具配置，避免将安装失败当作行为失败。
- [ ] **Step 3:** 在指定文件实现上述接口：配置最小 React SPA 与可访问导航；CSS Modules/变量采用柔和配色。仅 shell 采用端到端测试，不为装饰性样式添加单元测试。
- [ ] **Step 4:** 依次运行 `npm run typecheck`、`npm run build`、`npm run test:e2e -- tests/e2e/shell.spec.ts`，预期退出码0、测试通过；失败先修复本任务。
- [ ] **Step 5:** 审查本任务差异，暂存上列文件并提交独立变更；提交不包含 secrets、用户备份或无关改动。记录命令和结果。

### Task 2: 领域契约、内置目录与公制

**Files:** src/domain/models.ts、src/domain/errors.ts、src/domain/schemas.ts、src/domain/units.ts、src/catalog/exercises.ts、src/catalog/catalog-service.ts、src/ui/pages/CatalogPage.tsx、tests/domain/catalog.test.ts。

**Interfaces:**
- Consumes: 任务 1 的双语资源。
- Produces: Exercise、Plan、PlanVersion、WorkoutSession、SetRecord、ScheduledWorkout、BodyWeightObservation、TrainingMemo、TimerState、BackupEnvelope 类型；searchExercises(query: string, locale: Locale, filters: CatalogFilters): Exercise[]；parseMetric(input: MetricInput): SetMetrics。

- [ ] **Step 1:** 编写行为测试：catalog.test.ts：至少每种力量/有氧/徒手各一条目录项；zh/en 可搜索；未知 exerciseId 拒绝；1.25kg → 1250g；小数与负值按指标契约拒绝，不以语言改单位。
- [ ] **Step 2:** 运行对应测试，确认因未实现行为失败；任务1先建立可执行的最小工具配置，避免将安装失败当作行为失败。
- [ ] **Step 3:** 在指定文件实现上述接口：约定固定 UUID/整数公制、UTC 时间点及本地日期字段；目录包含中英文文本和可选媒体引用，尚未审核的媒体不能作为已上线资源。
- [ ] **Step 4:** 依次运行 `npm run test -- tests/domain/catalog.test.ts`，预期退出码0、测试通过；失败先修复本任务。
- [ ] **Step 5:** 审查本任务差异，暂存上列文件并提交独立变更；提交不包含 secrets、用户备份或无关改动。记录命令和结果。

### Task 3: 真实 IndexedDB 事务、资料与体重

**Files:** src/persistence/db.ts、src/persistence/repository.ts、src/application/profile.ts、src/application/body-weight.ts、src/ui/pages/SettingsPage.tsx、tests/e2e/persistence.spec.ts。

**Interfaces:**
- Consumes: 任务 2 的实体与 Zod schema。
- Produces: createDatabase(name: string): FitnessDatabase；saveProfile(input: ProfileInput, expectedRevision: number): Promise<LocalProfile>；saveBodyWeight(input: BodyWeightInput, expectedRevision?: number): Promise<BodyWeightObservation>；deleteBodyWeight(id: string, expectedRevision: number): Promise<void>。

- [ ] **Step 1:** 编写行为测试：persistence.spec.ts：保存后刷新可读；同日体重录入要求显式编辑；回填/删除体重可用；冲突 revision 拒绝；升级失败不显示成功；测试隔离数据库不删除用户库。
- [ ] **Step 2:** 运行对应测试，确认因未实现行为失败；任务1先建立可执行的最小工具配置，避免将安装失败当作行为失败。
- [ ] **Step 3:** 在指定文件实现上述接口：定义所有 store/index 与数据库版本；资料清除不删除训练历史；迁移保留事实，写入失败和 STORAGE_FULL 明确反馈。真实浏览器验证事务，不靠纯内存替身证明持久化。
- [ ] **Step 4:** 依次运行 `npm run test:e2e -- tests/e2e/persistence.spec.ts`，预期退出码0、测试通过；失败先修复本任务。
- [ ] **Step 5:** 审查本任务差异，暂存上列文件并提交独立变更；提交不包含 secrets、用户备份或无关改动。记录命令和结果。

### Task 4: 手动计划、周期日程与当前计划

**Files:** src/domain/calendar.ts、src/application/plans.ts、src/ui/pages/PlansPage.tsx、src/ui/components/PlanEditor.tsx、tests/domain/calendar.test.ts、tests/e2e/plans.spec.ts。

**Interfaces:**
- Consumes: FitnessDatabase、Plan/PlanVersion/ScheduledWorkout、目录。
- Produces: expandSchedule(version: PlanVersion, startDate: LocalDate, timeZone: string): ScheduledWorkout[]；savePlan(input: PlanInput, expectedRevision?: number): Promise<Plan>；activateDraftPlan(planId: string, expectedRevision: number): Promise<Plan>；rescheduleWorkout(id: string, date: LocalDate, expectedRevision: number): Promise<void>；skipWorkout(id: string, expectedRevision: number): Promise<void>。

- [ ] **Step 1:** 编写行为测试：calendar.test.ts：周三开始＋周一/三/五时首周依次周三/周五/下周一；1/12 周及跨 DST 不丢日；星期数不匹配拒绝。plans.spec.ts：新当前计划与旧计划归档原子提交；进行中训练时保留草稿；改期不改 originalDate；手动入口不强制身高体重。
- [ ] **Step 2:** 运行对应测试，确认因未实现行为失败；任务1先建立可执行的最小工具配置，避免将安装失败当作行为失败。
- [ ] **Step 3:** 在指定文件实现上述接口：实现不可变 PlanVersion；未完成日程手动改期/跳过，遗漏不自动重排。用数据库事务维护最多一个当前计划。
- [ ] **Step 4:** 依次运行 `npm run test -- tests/domain/calendar.test.ts`、`npm run test:e2e -- tests/e2e/plans.spec.ts`，预期退出码0、测试通过；失败先修复本任务。
- [ ] **Step 5:** 审查本任务差异，暂存上列文件并提交独立变更；提交不包含 secrets、用户备份或无关改动。记录命令和结果。

### Task 5: 训练记录、完成确认与全量备忘

**Files:** src/application/workouts.ts、src/application/training-memory.ts、src/ui/pages/WorkoutPage.tsx、src/ui/components/CompletionReview.tsx、tests/e2e/workouts.spec.ts。

**Interfaces:**
- Consumes: 任务 3 仓储、任务 4 计划快照、任务 2 训练与备忘类型。
- Produces: startWorkout(input: StartWorkoutInput): Promise<WorkoutSession>；recordSet(sessionId: string, input: SetInput, expectedRevision: number): Promise<WorkoutSession>；adjustWorkout(sessionId: string, command: Adjustment, expectedRevision: number): Promise<WorkoutSession>；completeWorkout(sessionId: string, expectedRevision: number): Promise<WorkoutSession>；abandonWorkout(sessionId: string, expectedRevision: number): Promise<WorkoutSession>；readTrainingMemo(): Promise<TrainingMemo>；rebuildTrainingMemo(): Promise<TrainingMemo>。

- [ ] **Step 1:** 编写行为测试：workouts.spec.ts：每组保存后刷新继续；汇总可返回编辑；完成后不能改/删；临时训练无计划关联；增加/替换动作不改计划；重复点击不重复记录；备忘含每个 session 和每组实际值；故障注入时事实与备忘一起回滚；双标签冲突只一个提交成功；放弃条目与完成条目明确区分。
- [ ] **Step 2:** 运行对应测试，确认因未实现行为失败；任务1先建立可执行的最小工具配置，避免将安装失败当作行为失败。
- [ ] **Step 3:** 在指定文件实现上述接口：训练状态与全量备忘同事务提交，备忘按 sessionId 更新而非反复追加整个历史；首次启用重建旧历史。只有确认组数据成为事实，不依赖 AI 保存，不自动调用模型。
- [ ] **Step 4:** 依次运行 `npm run test:e2e -- tests/e2e/workouts.spec.ts`，预期退出码0、测试通过；失败先修复本任务。
- [ ] **Step 5:** 审查本任务差异，暂存上列文件并提交独立变更；提交不包含 secrets、用户备份或无关改动。记录命令和结果。

### Task 6: 计时与休息提醒

**Files:** src/domain/timer.ts、src/application/timers.ts、src/ui/components/WorkoutTimer.tsx、tests/domain/timer.test.ts、tests/e2e/timer.spec.ts。

**Interfaces:**
- Consumes: TimerState、recordSet 和本地仓储。
- Produces: transitionTimer(state: TimerState, event: TimerEvent, nowMs: number): TimerState；readTimer(state: TimerState, nowMs: number): TimerDisplay；saveTimer(state: TimerState): Promise<void>。

- [ ] **Step 1:** 编写行为测试：timer.test.ts：开始/暂停/继续/停止、后台 tick 延迟不累积误差、时钟倒退显示可识别状态不产生负值；timer.spec.ts：刷新恢复；停止只填候选时长；声音失败仍有视觉结束提示。
- [ ] **Step 2:** 运行对应测试，确认因未实现行为失败；任务1先建立可执行的最小工具配置，避免将安装失败当作行为失败。
- [ ] **Step 3:** 在指定文件实现上述接口：状态转换时持久化时间点；用户主动启用声音。休息时间不计训练时长，不承诺锁屏响铃。
- [ ] **Step 4:** 依次运行 `npm run test -- tests/domain/timer.test.ts`、`npm run test:e2e -- tests/e2e/timer.spec.ts`，预期退出码0、测试通过；失败先修复本任务。
- [ ] **Step 5:** 审查本任务差异，暂存上列文件并提交独立变更；提交不包含 secrets、用户备份或无关改动。记录命令和结果。

### Task 7: 历史、阶段完成率与趋势

**Files:** src/application/progress.ts、src/ui/pages/TodayPage.tsx、src/ui/pages/ProgressPage.tsx、src/ui/components/HistoryDetail.tsx、tests/domain/progress.test.ts、tests/e2e/progress.spec.ts。

**Interfaces:**
- Consumes: completed session、originalDate 日程、体重观测、计划时区。
- Produces: queryProgress(input: ProgressQuery, nowMs: number): Promise<ProgressReport>；calculateProgress(input: ProgressFacts, cutoff: LocalDate): ProgressReport。

- [ ] **Step 1:** 编写行为测试：progress.test.ts：零分母显示暂无到期任务；跳过/漏练计分母；今日未到期不算漏练；补练更新原阶段；临时训练只计实际日期历史/趋势；重量/距离/时长各自汇总；体重缺测不补造；改变浏览器时区不重写历史归属。progress.spec.ts：只读历史详情与继续训练入口可用。
- [ ] **Step 2:** 运行对应测试，确认因未实现行为失败；任务1先建立可执行的最小工具配置，避免将安装失败当作行为失败。
- [ ] **Step 3:** 在指定文件实现上述接口：从事实计算统计，界面区分计划归属与实际日期，不持久化异步统计投影；未来 AI 总结入口尚未可用时显示阶段说明。
- [ ] **Step 4:** 依次运行 `npm run test -- tests/domain/progress.test.ts`、`npm run test:e2e -- tests/e2e/progress.spec.ts`，预期退出码0、测试通过；失败先修复本任务。
- [ ] **Step 5:** 审查本任务差异，暂存上列文件并提交独立变更；提交不包含 secrets、用户备份或无关改动。记录命令和结果。

### Task 8: JSON 整库备份、恢复与容量失败

**Files:** src/application/backup.ts、src/ui/components/BackupPanel.tsx、tests/e2e/backup.spec.ts。

**Interfaces:**
- Consumes: 全部领域 schema、真实事务、rebuildTrainingMemo。
- Produces: exportBackup(): Promise<Blob>；validateBackup(file: File): Promise<ValidatedBackup>；importBackup(input: ValidatedBackup, confirmation: ReplaceConfirmation): Promise<ImportReport>。

- [ ] **Step 1:** 编写行为测试：backup.spec.ts：导入前生成旧库备份并确认；损坏 JSON/未知目录 ID/超过建议 10MB 拒绝；写入中断原库保持；备忘不一致从事实重建；完整事实与独立 AI 建议可恢复；旧版本迁移与引用校验；跨 origin 手动导入恢复。
- [ ] **Step 2:** 运行对应测试，确认因未实现行为失败；任务1先建立可执行的最小工具配置，避免将安装失败当作行为失败。
- [ ] **Step 3:** 在指定文件实现上述接口：不做数据合并；确认旧库备份已生成并说明须下载保管后再整库事务替换；导出排除邀请码令牌、API 凭据和媒体二进制。导入锁阻止并发训练写入，使用 expectedRevision 防止旧预检覆盖新记录。
- [ ] **Step 4:** 依次运行 `npm run test:e2e -- tests/e2e/backup.spec.ts`，预期退出码0、测试通过；失败先修复本任务。
- [ ] **Step 5:** 审查本任务差异，暂存上列文件并提交独立变更；提交不包含 secrets、用户备份或无关改动。记录命令和结果。

### Task 9: 本地版本综合验收与 GitHub 检查

**Files:** tests/e2e/local-flow.spec.ts、.github/workflows/ci.yml、docs/verification/local-mvp.md、README.md。

**Interfaces:**
- Consumes: 任务 1–8 的稳定接口与锁文件。
- Produces: npm run check 统一 typecheck/test/build；CI 无部署和供应商凭据；可本地运行的使用说明与验收记录。

- [ ] **Step 1:** 编写行为测试：local-flow.spec.ts：双语手动计划→逐组训练→完成确认→历史/趋势→备忘→导出恢复闭环；应用已打开后断网同流程成功；Chromium/WebKit 执行核心用例。
- [ ] **Step 2:** 运行对应测试，确认因未实现行为失败；任务1先建立可执行的最小工具配置，避免将安装失败当作行为失败。
- [ ] **Step 3:** 在指定文件实现上述接口：Actions 对 push/PR 只检查构建和测试，fork PR 无 secrets；记录真实 iPhone Safari、Android Chrome、桌面 Chrome/Edge/Safari 的版本和手测结果，未测项明确标未验证。复测只针对新改动或失败。
- [ ] **Step 4:** 依次运行 `npm ci`、`npm run check`、`npm run test:e2e`，预期退出码0、测试通过；失败先修复本任务。
- [ ] **Step 5:** 审查本任务差异，暂存上列文件并提交独立变更；提交不包含 secrets、用户备份或无关改动。记录命令和结果。

## 后续阶段与依赖

### 第二阶段：AI 计划与小范围验证（详细计划在本地闭环通过后编写）

依赖任务1–9。拟创建 server/index.ts、server/ai/provider.ts、server/ai/contracts.ts、server/trial/service.ts、server/budget/service.ts、server/db/migrations/0001.sql、src/ai/context.ts、src/ai/history-summary.ts、src/ai/client.ts、src/ui/components/GenerationWizard.tsx、wrangler.jsonc、tests/server/ai.test.ts、tests/server/trial.test.ts、tests/domain/ai-context.test.ts、tests/e2e/ai-flow.spec.ts。

- [ ] 实现 buildAiContext(memo: TrainingMemo, input: ContextSelection): AiHistoryContext：默认近期28天原始内容、此前逐月事实摘要，包含来源ID/revision/覆盖范围/缺失值；不把放弃或进行中训练当已完成；输入超限明确拒绝或要求用户缩小外发范围。备注视为不可信数据，不能覆盖系统规则。测试长期多计划、空历史、旧摘要失效、切换阶段、数据新增后的一致性。
- [ ] 接入目标理解→用户确认→计划生成→校验→预览编辑→保存，沿用既有保存接口；每次请求含 requestId、输入hash、上下文版本及发送确认。后端不存原始训练/备忘正文，响应建议独立本地留存并引用 memoRevision。
- [ ] 使用D1约束与条件写实现一次邀请码兑换、7天邀请码、30天会话、撤销重发；Secure/HttpOnly/SameSite cookie、同源/CSRF与请求大小校验。实现原子预算预留、usage结算、不确定调用保守计费；相同requestId内容冲突/在途/结果遗失不自动重复计费。
- [ ] 官方资料复核后选定模型：建议 GPT-6 Luna，store:false、reasoning.effort:none、schema输出；支持refusal/incomplete/超时/坏输出、未知动作/额外日程/截短周期拒绝；无凭据时以替身跑契约和故障测试，不冒充真实评估。
- [ ] 用至少30个固定案例覆盖zh/en、1/12周、7天、条件冲突、注入及完整历史上下文；硬约束全部满足。测量实际token/成本/延迟并更新预算，免费Worker CPU最坏低于10ms且p95目标低于5ms；超限先优化或提出已设计的Paid备选，不自动订阅。
- [ ] 编写受信任分支发布流程与隔离预览；发布前完成构建、检查与凭据配置，以具体构建产物作为发布审阅对象。发布后验证主页、深层路由、JSON404、无AI资格403及本地数据恢复；冒烟不默认调用计费模型。

阶段门槛：真实模型质量和预算证据、端到端数据发送审计、预算并发测试、地区可达性全部通过，才能邀请初始少量试用者。可用本地闭环始终保留。

### 第三阶段：总结、媒体与扩大至10–50人（另行细化计划）

- [ ] 实现阶段周/整计划/自定义范围总结；阶段统计与跨阶段备忘背景分开，事实数字由本地计算。总结与后续计划均可追溯memoRevision，用户预览编辑确认后保存新计划，不改历史。
- [ ] 从YouTube搜索与目录匹配的视频，逐项完成频道、内容、公开状态、嵌入、字幕及地区验证；点击加载官方播放器、第三方提示、失败文字和原链接；不下载或再托管。
- [ ] 图片授权审阅后上传R2，公开 /media/{assetId} 只允许目录ID；图片缓存/操作额度/故障反馈测试，禁止任意URL代理；不从未经授权的视频截帧。
- [ ] 两种语言及真实设备验证声音、计时、存储、媒体与AI全流程，记录账单和故障恢复。迁移兼容、同构建回滚和固定origin备份方案通过后扩大试用。

阶段门槛：所有已确认首版需求验收通过，完整素材清单可追溯、实际预算可控、没有将未验证项目写作通过。

## 需求覆盖与执行交接

| 需求 | 实施位置 |
|---|---|
| R1–R5、R21–R30、R33–R34、R43–R46、R50–R54 | 第一阶段任务1–9；R54 AI上下文部分在第二阶段 |
| R6、R8–R16、R31–R32、R37–R41、R47–R48 | 第二阶段；R13–R16手动日程基础在任务4 |
| R17–R20 | 第一阶段任务7基础统计；第三阶段AI总结与据建议生成 |
| R35–R36、R42 | 双语第一阶段；完整图片视频第三阶段 |
| R7、R49 | 设计/本实施计划及分阶段验收 |

已自查：任务接口依赖、日期与单位口径、备忘事务与恢复、需求覆盖和五项Review Focus均有归属。当前仅文档检查，不代表产品测试已运行。

执行方式已由用户选择：子代理逐项实现、独立子代理审查，主代理协调与最终把关；第一阶段完成后先验收，再细化第二阶段计划。预计工期在实际脚手架、首个闭环与设备验证后评估，此处不编造日期承诺。
