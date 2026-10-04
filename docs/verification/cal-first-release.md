# CAL 首期本地实施与验收

日期：2026-10-04；负责人：统筹；状态：本地实现及自动化验收完成，未提交或发布。

## 基线、范围与隔离

工作区：`D:/Project/xxgospel/Fitness/.worktrees/fitness-cal`；分支 `codex/fitness-cal`；HEAD/父基线仍为 `7ac773c7904275918b9ff6400b030fde36cbc321`。成果为未提交修改，不能把父 SHA 当作实现 SHA。按用户“按此计划执行”完成首期：资料 IANA 时区、具体日期、各日独立内容、每次明确保存一日，多选不自动批量保存。必要 G1 纯契约复用；无新增依赖。

原发布工作区和 5173 进程未改动。预览 `http://127.0.0.1:5190/plans` 为独立 origin，浏览器存储不与 5173/公网共享；截图使用新的隔离浏览器上下文和合成样例。没有访问用户真实训练库、云资源、模型调用、付费或 Git 写操作。

## 实现

- 新 `date-day` Plan/PlanVersion 分支使用日期与时区，不伪造周字段；旧周计划原字段保留。各日独立 active，旧周激活只归档旧周。
- 内容版本不可变，逻辑 task/day 身份稳定；改名不产生新版本。原版本及训练快照、逐组主动保存、完整备忘、完成只读继续有效。
- 未完成 hidden/skipped 释放槽；completed+hidden 仍占槽。新建/改期拒绝占用；改期保留 originalDate 统计归属。legacy 真实碰撞预览并确认，事务重检相关依赖，保留双方身份；不按日期合并事实。
- 日历资料时区不随设备时区切换；跨区采用 `civil-day-max-overlap-v1`，唯一最大重叠自动映射，平局/跳日/缺来源需核对，不重写旧任务。歧义只阻断可能受影响日期，不阻断无关日期。已有日计划时首期阻止资料时区更改，避免暗中移日。
- 明确保存及日程操作携带恢复代次；恢复后的旧操作拒绝。普通无关写入不以全局 revision 直接丢弃日编辑；最终事务复核相关实体及槽。
- 月历点击/拖选、固定增加或移除模式、Escape/指针取消、键盘方向键/Space/Enter、触摸短点及滚动保护；已访问日期草稿同页保留。双语状态和失败反馈不生成假成功。
- JSON3/metadata4，Dexie4 升级仅规范化运行元数据；旧合法 JSON2/metadata3 可恢复。新旧完整训练/备忘/任务/版本往返，未知版本和坏引用拒绝。容量保持 10,485,760 字节；不是 P0 修复。

## 真实验证与命令

在以上工作区执行：

```powershell
npm.cmd run check
node node_modules/@playwright/test/cli.js test --config playwright.cal.config.ts
git diff --check
node .superpowers/cal-preview-evidence.mjs
```

最终类型检查、75/75 单元测试、生产构建通过。完整 Chromium/WebKit **134/134** 通过，约4.8分钟；源码冻结运行，端口5184。结构化结果：`D:/Project/xxgospel/Fitness/.worktrees/fitness-cal/test-results/cal-report.json`。格式检查通过（仅 Git LF/CRLF 提示）。

首次完整回归115/122；修复资料未初始化时备份可操作、列表模糊匹配冲突、迁移故障注入未实际升级，针对性38/38后才执行最终完整回归。新增安全测试先复现恢复后旧改期可写和无关日期被歧义阻断，两浏览器4/4修复验证；存储失败比对所有表/元数据，完整回滚。WebKit鼠标不聚焦导致Escape取消失效先失败后修复。

## 验收映射与限制

|编号|证据文件（本工作区）|结果/边界|
|---|---|---|
|CAL-B01～03|tests/e2e/cal-calendar.spec.ts、cal-plans.spec.ts；domain/day-plan-schema.test.ts|双语具体日期、各日内容/独立任务/并存，无周前置；单日明确保存|
|CAL-B04 / OCC-A04|cal-plans.spec.ts、cal-safety.spec.ts；domain/day-slot-policy.test.ts|并发仅成功一条；legacy skipped释放→新建→旧改期显式确认与旧确认拒绝；相关槽最终事务重检。并发 fixture 同页同时提交，不声称新增测试是真实双标签手势|
|CAL-B05～06|cal-interactions.spec.ts；domain/day-date-projection.test.ts|拖选取消、键盘、闰日、日期草稿/触摸滚动；DST23/25小时、跨日/平局/跳日固定夹具。跨月/跨年选择实现，未单列穷尽手势组合|
|CAL-B07|cal-safety.spec.ts、cal-interactions.spec.ts；既有feedback/fidelity/workouts|选择/编辑无完成事实；存储失败全表回滚、旧恢复操作拒绝；进行中/完成保护、跨动作草稿及错误反馈回归|
|CAL-B08～09|cal-backup.spec.ts、cal-migration.spec.ts；既有backup/persistence/workout-backup|实际UI下载→文件校验→隔离恢复；旧JSON2与新JSON3全部实体往返；新内容版本及原快照关联保留，坏双日占用拒绝；旧本地数据库升级事实逐字段不变|
|CAL-B10 / OCC-A01～03|cal-workouts.spec.ts、cal-plans.spec.ts；day-slot-policy与既有progress/schedule-delete|task/session独立；skipped释放与completed+hidden占用、临时训练/完整备忘；原统计字段往返。未新增所有状态组合的穷尽端到端案例|
|CAL-B11|cal-calendar.spec.ts、cal-interactions.spec.ts及既有dashboard/shell/local-flow|中英文；320/390/768/1440 CSS px不溢出；HTTP阻断下已加载保存/导出/校验，既有离线训练/恢复回归通过。触摸事件模拟与桌面WebKit不是两台真机|
|OCC-A05～06|day-date-projection.test.ts、day-slot-policy.test.ts；cal-safety.spec.ts|确定性投影/歧义边界；无cancelled；取消不创建事实。歧义人工解决的新交互未新增，保留原数据及相关日期失败反馈|
|CAP关联|cal-backup.spec.ts、既有backup/workout-backup|仅新旧格式保真及恢复安全规则；不表示CAP扩容或旧5/6MiB失败样本已解救|

`canonicalFacts`逐字段比较事实与关联，仅移除契约允许变化的运行元数据及备忘重建时间/revision；不是仅比较数量。文件下载已开始不代表用户保管，恢复仍须现库下载且两项明确确认。

已有一万组桌面回归通过：Chromium保存p95约46.3ms、WebKit约236ms；这不是手机指标或新容量证据，不把它扩大成Dashboard两轮正式专项。

## 回退与未验证

旧 Dexie3 构建实测可能打开 Dexie4 库，但这不等于支持新模型。旧应用不支持新版 JSON，不能对同库直接回退；需兼容构建或升级前备份/隔离环境。界面已明确说明，未降级数据库或删除数据。

WebKit的自动化 `setOffline(true)`同时导致本地Blob.text/FileReader失败；CAL新离线测试改为阻断HTTP，保留本地文件I/O。不能把该测试当实际手机飞行模式证据。

既定 iPhone16 Pro Max/Safari、一加Ace5至尊版/Chrome的实际系统/浏览器和文件恢复、长按拖选未连接验证。真实库升级、手机支持范围和容量风险须在发布评审确认。多日原子保存、P0扩容、AI/HCTX/BE1/P1、资源及发布不在本次交付。

## 独立审查

一次只读审查 `/root/review_cal_final` 核对核心模型/占用/事务/恢复/备份/历史和UI，未发现本轮新增阻断问题；未重复全套测试或改文件。审查提醒：旧版本/day直接启动skipped任务可能创建无法完成的训练，已对比发布基线存在相同路径，非CAL新增回归；列为既有问题，未以本轮授权自动改写补练规则。该项不是新测试通过结论。

## 截图及交接

截图：`D:/Project/xxgospel/Fitness/.worktrees/fitness-cal/.superpowers/cal-desktop.png`、`cal-mobile.png`。截图样例仅隔离浏览器合成资料，不是用户库。

可转发：CAL首期本地实现已完成，75单元/类型/构建、134 Chromium/WebKit回归通过，一次只读审查未发现新增阻断。预览5190，源码在独立codex/fitness-cal worktree且未提交；原5173及公网不变。每次保存一日，备份新旧完整闭环；P0扩容、多日原子保存、两台真机、Git整合与发布另行处理。不同聊天通过用户转发，不声称产品或UI/UX已收到。

## 后续授权：PR 与公网发布

用户随后明确暂缓真机验证，并批准PR及公网发布。本条更新上述本地验收时点的授权边界；真实设备仍记录为未验证，不补写通过。75项单元/类型/构建和Wrangler4.147.0 dry-run于发布准备重新通过。新增 `tests/e2e/cal-public.spec.ts` 中英文纯UI闭环，在Chromium/WebKit追加4/4通过；`playwright.release.config.ts`专用于静态预览及真实HTTPS，不依赖开发源码辅助入口。

完整回归现在包含138项，最终结果以本次完整运行和PR CI核验为准。生产发布只针对现有fitness静态Worker；不新增后端、D1、模型或付费。应用回退不得以旧版本对同一新库操作。实际PR、合并SHA、部署版本和公网验收另存主仓库发布记录，不能把本条当作已部署。
