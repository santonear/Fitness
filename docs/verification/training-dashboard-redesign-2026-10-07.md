# 训练总览与侧边栏改版

## 当前实现与数据

首页路径 `/` 保留，首次进入仍显示引导；记录面板增加训练数据总览。`/progress` 继续承接历史详情、阶段完成率、分类与同动作比较，不建立重复分析数据库或后端。

六项指标：按实际训练日期去重的训练天数、已完成训练次数、完成组负重×次数、计时类完成组时长、选定区间的平均每周完成次数、有完成组的不同动作数。未计时不当作全程时长，缺失计时/负重类型记录显示“—”。完成事实来自既有 progressService；计划目标、进行中或放弃的训练不当作完成。平均周频率分母为所选含首尾日期的天数/7；全部记录从最早完成记录起算。

侧边栏保留原五个入口，增加“数据分析”分组及趋势、负荷锚点；肌群分布和个人纪录为禁用的“待开放”位置。桌面232px暖色侧栏，800px以下改为可展开导航。已有账号、邀请码、API及存储权限没有变化。

## 修改与复用

- `src/ui/App.tsx`：分组导航和手机展开控制。
- `src/ui/pages/GuidedHome.tsx`：在已有首页接入总览，计划页不重复挂载分析。
- `src/ui/components/guided/TrainingAnalytics.tsx`：只读聚合、六项指标、周期切换、SVG图表和数据表。
- `src/ui/analytics-theme.css`、`src/main.tsx`：共享暖色token、侧栏与图表响应布局。
- `src/ui/training-calendar.css`：日历颜色引用同一token，保留原fallback。
- `playwright.guided.config.ts`、`tests/e2e/analytics-dashboard.spec.ts`、`tests/e2e/guided-ui.spec.ts`：分析证据与手机导航适配。

复用现有 progressService、实际组指标、日期与时区、路由、动作快照、liveQuery、React及CSS；无新增依赖。SVG展示频率、训练量和时长，数据表及月份选择器同时可键盘操作；点选、键盘或悬停数据点可查看数值。

## 布局与视觉

参考附件采用侧栏＋主区域、标题与时间范围、六项KPI、双列趋势及全宽时长图、下方动作与预留分析区。Calendar与Dashboard共享暖白、玻璃表面、炭灰、橙色功能强调和淡黄色贴纸。没有复制深黑面板、高饱和橙色或密集BI网格。

时间范围30/90/180/365天和全部；只列真实支持的统计。图表仅展示有完成训练的月份，标题旁注明单位；不声称估计力量、相对负荷、PR、肌群平衡或健康结论。全宽图采用真实时长柱状图，不混合未定义力量指标。空库展示空状态和真实训练入口。

320/375/390/430/768/1024/1280/1440px覆盖；手机两列KPI、单列图表，桌面六列KPI。图表使用memoized派生结果，交互不重新查询历史；底层原有统计方法未重构，万组性能专项仍未进行。

## 验证边界

隔离合成数据建立三次已完成和一次进行中训练。验收期望：完成3次、训练2天、实际训练量35 kg·次、记录时长2 min；30天筛选为完成2次且时长未知。测试逐值断言，并比较切换筛选前后的sessions/sets完整内容相等；合成值仅存在浏览器测试库，不写入应用默认数据。

类型检查、15项既有指标/UI单元测试、构建和diff检查通过。项目无独立lint命令。浏览器命令为 `GUIDED_EXTERNAL_SERVER=1` 下 `node node_modules/@playwright/test/cli.js test --config playwright.guided.config.ts guided-ui.spec.ts analytics-dashboard.spec.ts --workers 1 --output test-results-dashboard`；结果以最终终端记录为准。

最终版本浏览器检查：8/8通过（Chromium/WebKit），输出目录 `test-results-dashboard-final`。此前一次WebKit英文暂停返回流程超时；原样定向复查通过，最终整套再运行通过，未据此修改生命周期业务。最终TypeScript及正常生产配置构建通过，输出拆分沿用既有配置。

桌面截图：`test-results-dashboard-final/analytics-dashboard-analyt-82851-riods-and-preserves-history-chromium/analytics-desktop.png`；同目录含手机总览和展开导航截图。截图为明确隔离合成记录，非用户事实。

真实Edge、两台手机及完整屏幕阅读器尚未验证。原欢迎问答的插图和语音重做仍是独立未完成工作，不包含在本次Dashboard交付声明中。

未提交、推送或发布。无假训练数据进入产品，无历史训练改写，无训练、CAL、后端契约变更；本次仅改Dashboard及共享导航/视觉接入。
