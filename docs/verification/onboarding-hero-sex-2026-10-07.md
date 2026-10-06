# Onboarding 插画卡片与生理性别选项

## 设计与交互

遵循 `ui-ux-max-design.md`，本轮参考采用橙色插画头图、弧形浅色内容区、居中标题、纵向圆角选项和橙色主按钮。每个问题保留对应 SVG 插画。选中态同时使用勾号、描边和底色；键盘焦点保留可见指示。底部按钮随内容正常滚动，避免窄屏遮住选择区域。

性别问题安排在年龄之后，文案为“你的生理性别是？”，四项单选：女性、男性、其他或不确定、不愿透露。必须明确选一项才能完成新版引导，无默认答案、不支持跳过或自定义。不愿透露是有效回答，不推断健康、孕期或训练能力。

数值仍使用准确数值弹窗，允许跳过；其他适用问题保留自定义文字与经同意的浏览器语音输入。直接进入记录面板的已有入口保留，不以未完成引导阻断本地训练。

## 数据与隐私

- 字段为 `onboarding.answers.biologicalSex`，保存明确回答；不写入体重或训练事实。
- 新步骤使用 ID 16，保留旧步骤 ID 和已保存进度。旧数据缺失此字段仍可读取，不自动补值或改写已完成状态。
- 服务层阻止缺失或无效回答完成新引导；非法写入回滚。
- 完整 JSON 备份保留四种回答；不更改格式版本。未验证旧版本应用对新增问题的展示，不能承诺降级界面支持。
- 理解目标的预览不附加此字段。计划生成预览默认不包含；选择本次身体信息后才纳入，并重新确认。界面明确列出生理性别回答属于身体信息范围。
- 本轮发送范围验证使用已有本地合成演示，没有调用真实供应商。对真实模型推理行为不作验证通过声明。

## 文件范围

产品文件：

- `src/domain/guided-contracts.ts`
- `src/application/guided.ts`
- `src/ui/components/guided/onboarding-content.ts`
- `src/ui/components/guided/QuestionIllustration.tsx`
- `src/ui/components/guided/GuidedOnboarding.tsx`
- `src/ui/pages/GuidedDialoguePage.tsx`
- `src/ui/onboarding-theme.css`

测试文件：`tests/unit/onboarding-sex.test.ts`、`tests/unit/guided-backup.test.ts`、`tests/e2e/onboarding-redesign.spec.ts`、`tests/e2e/guided-ui.spec.ts`。

## 验证记录

环境：Windows，本地独立浏览器上下文，`http://127.0.0.1:5230/`；Chromium 与 WebKit。工作区为 `D:/Project/xxgospel/Fitness/.worktrees/fitness-guided`，未提交工作树，证据日期 2026-10-07。

- `node node_modules/vitest/vitest.mjs run --configLoader runner`：45 个文件、323 项通过。
- `node node_modules/typescript/bin/tsc --noEmit`：通过。
- `node node_modules/vite/bin/vite.js build --config vite.guided.config.ts --configLoader runner`：通过，仍有主 bundle 超过 500 kB 的体积提示。
- `GUIDED_EXTERNAL_SERVER=1`，运行 `playwright.guided.config.ts` 下 onboarding-redesign 与 guided-ui：16/16 通过。覆盖中英文、必答选项、失败写入、刷新、历史保留、语音同意与离线文字兜底、键盘弹窗和 320/375/390/430/1280 宽度。
- 同一配置新增 `--grep "biological sex privacy"`：Chromium/WebKit 2/2 通过。覆盖缺失回答完成失败且原状态不变、理解不包含字段、计划默认不包含、明确勾选后重新确认才包含。
- 隔离 Chromium 服务验证：四种回答均能完成，缺失和 skipped 被拒绝并保持原状态。证据 `outputs/onboarding-sex-service-validation.json`。
- 四种回答的完整备份序列化→校验→再次序列化校验均保留原 aggregate 和关联任务，计入上述单元测试。

初轮小屏验证发现粘性底部遮挡数值区域，已改为正常文档流；同一断言在两浏览器及五种宽度通过。发送范围探针首次遗漏变更后的重新确认步骤，补齐后双浏览器通过，未取消确认规则。

截图：`outputs/onboarding-hero-sex-selected-zh.png`、`outputs/onboarding-hero-sex-zh.png`。浏览器结果：`test-results-onboarding-hero-final`、`test-results-onboarding-sex-privacy`。

未进行真机、真实语音服务、真实 AI 调用或公网验证；未提交、推送或发布。
