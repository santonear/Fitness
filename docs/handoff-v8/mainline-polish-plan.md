# 主线修复与动作体验 · 2026-10-11

唯一集成分支 `feature/mainline-polish`，基线 main `0bd268b`。四条线独立工作树，统筹同时承担④；仅在全部验收后提交一个 PR。用户确认前不合并 main、不发布生产。无新增付费模型试验。

## 负责人和文件边界

| 线 | 工作树 | 所有权 |
|---|---|---|
| ① 芽芽/基础计划/回顾 | fitness-polish-coach | application/v8-workflow.ts、基础计划/本地规则、coach 本地适配、CoachPanel、review 页面、FinishPage、对应独立文案与测试 |
| ② 动作数据 | fitness-polish-catalog | catalog、tools/catalog、对应测试、翻译覆盖与20条抽查报告 |
| ③ 手动训练 | fitness-polish-manual | ManualPage 及 manual 子组件、独立样式/文案/测试 |
| ④ UI 与集成 | fitness-polish-ui | context/路由导航、WorkoutPage、草案/计划动作面板、通用组件、主题/数字字体、CoachVisual、外观、共享类型新增可选字段、对应测试 |
| 统筹 | fitness-mainline-polish | 唯一规范、待审清单、集成验收、预览、单一 PR |

## 共用契约

- ②提供 `catalog/exercise-guide.ts`：同步 `getExerciseGuide(id, locale)`，返回 name/keyPoints(2–3)/steps/mistakes/cautions/media可选；未知 ID 不编造内容。
- ②保留 catalog-service 旧搜索 API，新增 `searchExercises(query, filters)`；place/equipment/bodyParts/goal/cautionAreas；可选 places/goals 支持多选，同组 OR、跨组 AND。近似建议与标签由同一数据层提供。
- ①保留 workflow.start 旧签名，新增可选多动作参数；④提供 context.startManual(ids)。默认组目标和分钟估算共用，③不另造时长算法。
- 本地来源可用新增可选字段区分，不改变 origin 含义，不反向改写历史。

## 顺序与验收

1. 已启动四线；②先交类型/桩，然后真实实现，③④替换桩。所有权外需求发给所属线。
2. ①安全本地回应优先，接着时长/来源/回顾/结束统计；②具体中文≥150与授权；③多动作选择；④直接指导、统一面板与四主题。
3. 各线定向测试及提交后由统筹集成；检查数据不变量、未知重量、无资格及模型失败本地退路、禁用词、搜索翻译完整度。
4. 集成预览以全新浏览器资料完成两条用户路线；375/1280截图含用户列出的全部状态，四主题数字检查。无真机则明确标注。
5. 一个 PR 列出四线覆盖、差异、待审项、授权与翻译抽查；CI全绿后等待用户确认。确认后才一次合并/生产发布。

当前：四线实现及8项公网预览验收通过，唯一PR准备中。用户已批准新增四步话术及等义英文、保留原形象的本地头像去背景处理。未创建本次 PR、未合并 main、未发布生产。

## 集成验收证据

- 隔离预览：https://fitness-mainline-polish-preview.initdevl.workers.dev 。Worker版本99ef8e4f-08c4-430d-9e49-313c72e79362；无生产DB/KV/密钥绑定，CONTROL_MODE=disabled，验证本地退路，不产生模型费用。
- 类型、构建、V8样式/话术及客户端后端提示词隔离检查通过。完整单元：110文件、871项通过，29跳过、5既存todo（不声称全项执行）。
- 旧备份：15份真实旧版UI导出的合成资料，包括上一V8版本导出；16项定向浏览器迁移/失败回滚/来源往返通过。
- 资格：none/unknown/offline仅空内容access-status查询，零生成请求；原模型成功/取消/多轮用HTTP mock回归，不作真实模型质量结论。
- 独立审查修复：小数负重输入、详情双姿势、手动默认秒数同源、今日短版与计划捷径一致。
- 截图位于outputs/mainline-polish，375/1280；均为合成输入的桌面Chromium，不代替真实手机。
- 150/637中文指导及20例全文见docs/verification/mainline-translation-review.md，487项不是完整翻译。
- 与原型差异：图片沿用合法静态图；全部数字用Archivo；无可靠安全替代时只保留保守说明；长时长受安全动作/5组上限限制时显示实际较短草案；无生产权限的预览只测本地教练。
- 数据回滚边界：DB10一旦打开，旧DB9客户端不能直接降级打开。生产批准后需先准备支持DB10/envelope8的兼容回退版本；不能通过删库降级。

公网预览最终8项通过（35.7秒），无生成请求；证据索引outputs/mainline-polish/README.md。
