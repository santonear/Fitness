# Calendar 视觉结构更新与验证

日期：2026-10-07。工作区：`D:/Project/xxgospel/Fitness/.worktrees/fitness-guided`。
方向：Warm Nordic Editorial UI。此次范围为日历视觉结构与共享材质变量，不包含业务重写或公网发布。

## 实施前比较与文件范围

比较 `outputs/calendar-fidelity-before-desktop.png`、`outputs/calendar-fidelity-before-mobile.png` 与指定参考图。

前十项差距：月份弱；桌面日期格拉伸；无间隙浅轮廓像表格；年份贴纸小；视图按钮缺少实体感；训练卡全部位于右栏；详情日期层级弱；空状态空白大；软圆卡弱化纸张感；手机密度与参考不一致。

| 文件 | 原因与规则 | 风险及保护 |
|---|---|---|
| src/ui/components/guided/TrainingCalendar.tsx | 将事件放在月份下方，补充日期详情与编辑性标签 | 保留原 state、事件处理、查询和链接 |
| src/ui/training-calendar.css | 紧凑纸格、材质、层级、响应式 | 检查 44px 触控基准、溢出、键盘焦点 |
| src/ui/ui-ux-max-theme.css | 对齐共享色板、清除冲突日历覆盖 | 回归 Dashboard 与问答 |
| 本记录及 DESIGN.md 索引 | 记录页面变体、证据与限制 | 不将截图检查等同真机验收 |

## 交付条目

| 编号 | 项目 | 结果 |
|---|---|---|
| 1 | 旧视觉限制 | 旧约 50/50 栏、无界七列、轻框和泛化圆卡导致拉伸；旧全局字重/阴影覆盖还影响新元素 |
| 2 | 替换的设计规则 | 参考图决定视觉骨架；描边成为结构；纸承载内容、玻璃包围内容；不固定风格比例 |
| 3 | 文档 | 完整新规范已在前一轮替换；本轮补充页面实施记录和索引，不重写已确认 70 节 |
| 4 | 共享变量 | 玻璃 .72→.68、轻轮廓 .18→.22；补充 muted paper、strong glass、medium outline、muted text、strong yellow、danger；继续复用 fitness 橙/黄/炭灰 |
| 5 | 复用组件 | 保留 TrainingCalendar、现有按钮语义、日期网格、格式化目标与导航；复用共享 token，不为单页引入组件框架 |
| 6 | 几何 | 桌面外壳最大 1160px，1.65:1 分栏，主要内容内部限宽 |
| 7 | 网格 | 七列最大 62px，52px 桌面高度，5px 间距；手机 48px 高，极窄屏减间距保留 44px 目标 |
| 8 | 描边 | 普通日期可见轮廓，选中 2px 炭灰，事件 1.5px 炭灰 |
| 9 | 阴影 | 年份贴纸、选中日期、事件与详情采用可见小偏移；外壳柔和环境阴影 |
| 10 | 材质 | 玻璃外壳；日期、事件与详情纸色，无每格模糊 |
| 11 | 月份 | 大字 28–36px/700，英文月份大写，黄色年份纸贴与实线分区 |
| 12 | 事件卡 | 在月格下方，以深色训练标签开区；真实动作、组目标、备注和状态保持原来源 |
| 13 | 详情 | 桌面大日期、月份、星期、可见安排数和已完成数；数量只来自当前可见任务，不替代原完成率 |
| 14 | 日视图 | 共用标题、实体视图按钮与纸卡；24 小时轴仍 48px/小时，当前时间橙线；无指定时间的任务保持独立灵活安排区 |
| 15 | 手机 | 月份→紧凑月格→训练标签→事件；极窄屏保留全宽补偿；共享导航未改成截图的底部导航 |
| 16 | 桌面 | 使用额外空间展示日期语境，不扩大日期格；1100px 以下收成单栏 |
| 17 | 截图比较 | 完成 before→pass1→final；精修修正白色选中字、弱月份字重、被旧 CSS 清掉的阴影 |
| 18 | 剩余五项差异 | 见下节，分别说明产品原因与视觉取舍 |
| 19 | Dashboard | 原统计、筛选与事实不变检查通过；共享变量未破坏布局 |
| 20 | Onboarding | 原点击优先、数值窗、语音模拟、输入保留及焦点测试通过 |
| 21 | Tests | 44 个单元测试文件、313 项通过；18/18 Chromium/WebKit 浏览器测试通过，约 2.9 分钟 |
| 22 | Lint | package.json 未配置 lint 脚本，不虚报通过，不为本任务添加工具链 |
| 23 | Typecheck | tsc --noEmit 通过 |
| 24 | Build | Vite 230 modules 构建通过，CSS index-DMVMoqcn.css |
| 25 | 限制 | Windows Chromium/WebKit，不代表真机、屏幕阅读器或生产供应商验证；无 Git 提交与部署 |

## 剩余五项视觉差异

1. 使用系统无衬线字体，未复制参考的窄体展示字形；仍保留大月份与粗字层级。
2. 保留 Fitness 全局导航，没有复制参考底栏或新增不对应现有功能的图标入口。
3. 日期格保持 44px 可点击基准，手机纵向长度大于参考缩略图；320px 减少格间距而不缩小点击目标。
4. 保留多选与时区说明，占用参考图没有的控制空间；不删除既有能力来获得更短截图。
5. 当前任务没有小时安排，因此事件不放入虚构的时间轴位置；24 小时时间轴仍有空白。这是数据边界，不能用演示事件填入真实界面。

这些差异不作为逐像素还原的承诺。日期格、月份/贴纸、训练标签和纸卡结构已有明确参考适配；整体视觉满意度仍需产品查看，不以测试通过替代主观视觉判断。

## 验证命令与产物

```powershell
node node_modules/vitest/vitest.mjs run --configLoader runner
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build --configLoader runner
$env:GUIDED_EXTERNAL_SERVER='1'
node node_modules/@playwright/test/cli.js test --config playwright.guided.config.ts guided-ui.spec.ts analytics-dashboard.spec.ts onboarding-redesign.spec.ts --workers 1 --max-failures 1 --output test-results-calendar-fidelity
```

默认 Vitest 配置打包曾因 node_modules/.vite-temp 写入 EPERM 启动失败，改用现有 runner 加载器后 313/313 通过，未改测试或类型约束。

独立几何检查：Chromium/WebKit × 320/375/390/430/768/1024/1280/1440，共 16 项通过；全部日期格宽 44–62px、高至少 44px，页面无横向溢出。结果：`outputs/calendar-fidelity-geometry.json`。

最终截图：`outputs/calendar-fidelity-final-chromium-desktop.png`、`outputs/calendar-fidelity-final-chromium-mobile.png`；WebKit 同名变体。含真实服务创建的隔离合成计划的日视图截图见 `test-results-calendar-fidelity` 下 `calendar-day-en.png` / `calendar-day-zh.png`。合成数据只在测试浏览器上下文中，不写入用户库。

## 验收映射与边界

- VAC-03～14：几何、可见框、选中态、贴纸、训练标签、事件纸卡、阴影、材质、空态和视图按钮已实现并截图检查。
- VAC-01/02/15：已进行参考比较与一次精修，呈现明确适配；不声明像素级相同，剩余差异如上。
- SAC-01～03：新规范为准，共享变量复用，无新增平行色板；共享材质先通过 token 实现，尚未抽象不存在复用需求的全套 React 组件。
- SAC-04/05：复用现有 Dashboard/Onboarding 浏览器检查、焦点与交互断言；真机与完整可访问性专项未验证。
- DAC-01～07：此次仅修改上述呈现文件；未修改训练域、历史数据、测量、AI 保存确认、后端或 CAL 契约，未添加假功能。原工作区其他未提交业务改动不是本轮新增。

规则方向仍为 Warm Nordic Editorial UI。参考图用于视觉几何和设计语言；玻璃主要是外壳，纸张主要承载内容，结构性描边允许用于布局，桌面保持日历密度。
