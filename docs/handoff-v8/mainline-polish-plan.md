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

当前：实现进行中。新增芽芽话术已提请用户确认，其他独立任务继续。
