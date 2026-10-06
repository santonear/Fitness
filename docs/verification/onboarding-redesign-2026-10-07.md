# 首次问答重设计与验证

工作区：`D:/Project/xxgospel/Fitness/.worktrees/fitness-guided`。基线：`9a8ca5335d5977d0ed8500975d0870def89144f3`，分支 `codex/guided-experience`。本文描述本地未提交改动；不代表公网已经更新。

## 现状、状态和数据语义

入口为 `/` 的 `GuidedHome`，没有进行中训练或当前阶段时显示引导；可主动先查看记录面板。完成后进入 `/ai`。原问答包含 12 个字段，保存到 `guidedStates.onboarding`；更新经 `guidedService`、revision 和完整备份边界校验，不绕过既有事务。

原版数值题显示可直接确认的示例，目标、时间、偏好显示大文本框，只有固定题号进度。新版数值默认为空、按钮点击优先、自定义才打开输入框，并在完成前显示回答核对。

| 状态 | 实际存储 | 含义 |
|---|---|---|
| 已回答 | `answered` + number/string/string[] | 明确提交的数值、选项或文本 |
| 明确无 | `answered` + 既有或明确选项值 | `徒手`、`没有特别偏好`、`没有已知限制` 等；不是缺失 |
| 跳过整个字段 | `{status:'skipped'}` | 不再保留该字段的旧值；安全信息仍未知 |
| 未回答 | 不存在该 key | 尚未提供，不能推断为无或健康 |
| 时间／偏好的一部分跳过 | 只保留另一部分已提供的内容；两部分均空则 `skipped` | 不伪造单次时长、频率或运动偏好 |
| 已声明限制、跳过细节 | `answered: 有，需要说明` | 存在限制、细节未提供；不能转换成无已知限制 |

所有题目可跳过。数值输入时需通过格式和范围校验；自定义内容非空才可确认。后续 AI 入口仍要求用户提供目标并明确确认发送，不因问答完成而自动调用 AI。

## 完整屏幕映射

原 0–11 题目标识不变，已有进度不用迁移。附加界面状态使用现有非负整数 step；不新增 domain 字段。

| 界面 | step | 存储字段 / 行为 |
|---|---:|---|
| 年龄 | 0 | `age`，18–110 整数；可跳过 |
| 身高 | 1 | `heightCm`，100–230 cm |
| 体重 | 2 | `weightKg`，30–300 kg；仅画像 |
| 腰围 | 3 | `waistCm`，40–200 cm；可选参考 |
| 体脂率 | 4 | `bodyFatPercent`，3–65%；可选参考 |
| 目标 | 5 | `goal`，多选与自定义；不自动解释 |
| 经验 | 6 | `experience`，沿用三个既有取值 |
| 场地 | 7 | `location`，家里／健身房／户外／多种场地 |
| 器械 | 8 | `equipment`，多选；无器械与其他选项互斥 |
| 每周频率 | 9 | `time` 的已提供频率；可自定义 |
| 单次时长 | 13 | `time` 的时长；不要求指定日期 |
| 喜欢的运动 | 10 | `preferences` 的偏好；明确无偏好与其他喜欢项互斥 |
| 希望避免的运动 | 14 | `preferences` 的避免项；可跳过而保留喜欢项 |
| 安全限制 | 11 | 无已知限制／有需说明／跳过 |
| 最少必要限制说明 | 15 | 仅选择“有需说明”后出现；文字／语音转写，也可跳过细节 |
| 回答核对 | 12 | 只列已提供信息，支持返回修改；确认进入既有 AI 页面 |

目标、设备和偏好复用已有 string[] 能力；时间、偏好的子题合并到原字段。旧自由文本原样回显为可编辑补充，不猜测拆分其中的条件。选项显示中英文，保存既有稳定中文语义值；自定义文字保持用户原文。

选择仅更新当前题草稿，点击“确认并继续”才落库。Skip 可替换该题旧回答；返回恢复已提交答案。每个已确认子题与当前 step 使用已有本地服务保存，刷新后继续当前已保存题目。尚未确认的弹窗内容不宣称可刷新恢复。已完成后重新访问复用原回答，不重建画像。

## 视觉、交互和可访问性

- 与 Dashboard / Calendar 共用 `src/ui/analytics-theme.css` 的 `--fitness-*` 颜色，延续现有语言、导航和字体；没有引入组件库、表单引擎或外部字体。
- 主卡最大 580px；米白页面、单层暖玻璃、炭灰文字、橙色功能强调、淡黄分类贴纸。选项采用原生 button 与 `aria-pressed`，选中后不自动跳题。
- 原 `NumericWheel` 用于弹窗，复用键盘、拖拽和滚动；准确数值输入另有明确单位。滚轮仍显示未确认示例，确认按钮在输入为空时禁用。步长用于滚轮，身体指标键盘输入保留准确小数，不量化到步长；年龄为整数。
- 13 个本地 SVG 场景集中在 `QuestionIllustration.tsx`；统一二维线稿、橙／黄平面色块。概念题图较大，数值与安全题缩小；不使用运行时生成、外链图片、理想化身材或历史对比。装饰图 `aria-hidden`。
- 大致分类进度 + 类内进度；分类不变，条件题不伪装成固定总体题数。
- 进入动画 220ms、8px，交互延迟 70ms；选中比例 1.015。减少动态偏好下禁用动画和缩放。
- 手机安全区、sticky 操作区、44px 最小点击目标；弹窗独立滚动，不用固定底栏遮盖软键盘。打开聚焦输入，Esc 关闭并恢复原控件焦点。真实软键盘仍需真机验证。
- 保存失败保留输入、不进入下一题；避免父页和问答重复显示错误。当前题用中英文反馈；不把失败写成成功。

## 自定义文字、语音和 AI

`OnboardingInputDialog` 在自定义时才显示文字框。语音入口先展示说明，点击同意后才创建识别会话；仅接收最终转写到可编辑文本框，用户确认后返回当前题，再点击继续保存。取消弹窗不提交文字，关闭、卸载或离线会终止当前识别。文字输入始终保留，权限拒绝、服务错误或不支持时提供文字兜底。

浏览器可能把语音发送到其识别服务，Fitness 不保存音频；这不是本地离线语音保证。平台可用性依据 [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)。本轮语音测试使用浏览器接口替身验证同意、转写和中止行为，没有验证真实麦克风或识别服务。

目标理解仍由原 `GuidedDialoguePage` 的发送范围预览、明确发送、理解确认流程处理。问答只保存输入，核对页进入原协商；不静默发送资料或把 UI 选择当作 AI 理解。当前 5230 的 AI 路径是显式本地合成演示，不能代表新真实模型协议上线。

## 文件范围

| 文件 | 作用 |
|---|---|
| `src/ui/components/guided/GuidedOnboarding.tsx` | 分题导航、选择、条件追问、核对页与原服务回调 |
| `src/ui/components/guided/onboarding-content.ts` | 双语问题、选项、类别、准确数值校验和展示映射 |
| `src/ui/components/guided/OnboardingInputDialog.tsx` | 数值／文字弹窗、语音同意与生命周期、焦点恢复 |
| `src/ui/components/guided/QuestionIllustration.tsx` | 接入已有本地线稿并统一色块 |
| `src/ui/onboarding-theme.css` | 复用公共 token 的问答局部布局与交互样式 |
| `src/main.tsx` | 加载局部样式 |
| `src/ui/pages/GuidedHome.tsx` | 引导错误只显示一处 |
| `tests/e2e/onboarding-redesign.spec.ts` | 双语完整问答、状态、写入失败、语音替身与响应式检查 |
| `tests/e2e/guided-ui.spec.ts` | 既有欢迎用例适配数值弹窗，保留后续业务回归 |
| `tests/unit/guided-ui.test.ts` | 空数值、准确小数和跳过语义检查 |
| `playwright.guided.config.ts` | 纳入新用例 |
| `DESIGN.md`、本文 | 视觉适用范围、实现与验证记录 |

没有修改 domain、schema、后端、AI 预算、邀请码、CAL 或训练服务。未新增依赖；既有 dirty 工作保留。

## 验证命令与证据

在上述工作区执行，Vite 使用独立 5230 端口、runner loader。浏览器运行期间冻结产品源码；所有数据均为隔离合成数据。

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run tests/unit/guided-ui.test.ts tests/unit/guided-ai-contracts.test.ts --configLoader runner
node node_modules/vite/bin/vite.js build --configLoader runner
$env:GUIDED_EXTERNAL_SERVER='1'
node node_modules/@playwright/test/cli.js test --config playwright.guided.config.ts onboarding-redesign.spec.ts guided-ui.spec.ts --workers 1 --max-failures 1 --output test-results-onboarding-release
git diff --check
```

最终结果：类型检查通过；21/21 相关单元测试通过；生产构建通过（228 模块）；16/16 Chromium / WebKit 浏览器用例通过，进程 exit 0，用时约 2.3 分钟；`git diff --check` 通过（既有 SDD 文件仅提示换行符转换）。项目没有配置独立 lint 命令，不把 TypeScript 检查或 diff 检查称为 lint。

| 验证项 | 证据 |
|---|---|
| 样例不落库、准确值、刷新、重置不清历史 | `guided-ui.spec.ts` welcome 用例，中英文切换 |
| 双语选择、明确无和未知、子题 Skip、核对与进入 AI | `onboarding-redesign.spec.ts` zh / en 完整流程 |
| 安全限制细节保留、配额失败、离线文字兜底 | restriction detail 用例；注入原生 IndexedDB 写失败 |
| 语音同意前不启动、只填文字、取消中止 | speech 用例；使用识别接口替身 |
| 320 / 375 / 390 / 430 / 1280px、无溢出、控件不被遮挡、输入焦点、Esc 后返回 | layout 用例；Chromium 与 WebKit 均通过 |
| reduced-motion | restriction detail 和 layout 用例 |
| 既有候选确认、暂停、断网恢复、计划日历与训练事实 | `guided-ui.spec.ts` zh / en 合成流程 |

最终截图在工作区 `outputs/onboarding-age-mobile.png`、`outputs/onboarding-goal-mobile.png`、`outputs/onboarding-desktop.png`、`outputs/onboarding-numeric-dialog.png`。原始截图和失败时 trace 分批保存在各 `test-results-onboarding-*` 目录；最终通过记录目录为 `test-results-onboarding-release`。

此前调试中修正了测试夹具在保存结束前改写进度的竞态、刷新前未等待保存完成，以及通过 Vite 动态导入替换服务对象不能稳定注入失败的问题；最终失败夹具在原生 IndexedDB put 上注入一次配额错误，验证事务失败和页面输入保留。额外键盘用例复现并修复了弹窗首次焦点与 StrictMode 清理问题；WebKit 点击按钮不一定改变 activeElement，因此从打开事件传入实际触发控件，关闭时准确返回该控件，而非猜测前一个焦点。最后使用冻结源码的单 worker 回归完成验证。

## 边界与待验证项

不推断腰围、体脂、健康状态或缺失偏好。画像体重不创建测量历史。安全跳过仍为未知，声明有但未给细节也不视为无。AI 理解需要确认。未变更训练、CAL 或后端契约。

未执行 Linux CI、全套浏览器回归、真实麦克风、实际 iPhone／一加、完整屏幕阅读器审计或真实 AI 请求。桌面 WebKit 和手机 viewport 不能证明真机完成。已有进度可继续，尚未提交的弹窗文字不提供刷新恢复。未发布公网。
