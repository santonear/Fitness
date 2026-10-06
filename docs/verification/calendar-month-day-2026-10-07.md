# 训练日历月／日视图改版

## 实现与范围

本地工作区 `D:/Project/xxgospel/Fitness/.worktrees/fitness-guided`，未提交与发布。改版前记录面板使用 `TrainingCalendar` 显示月历和当天只读列表，没有日视图。数据来自现有本地任务和计划版本，选中日期是临时界面状态。

修改文件：`src/ui/components/guided/TrainingCalendar.tsx`（视图与导航）、`src/ui/training-calendar.css`（局部主题扩展）、`tests/e2e/guided-ui.spec.ts`（针对性回归）、本验证记录。复用已有日期工具、计划目标格式化、动作目录、训练及历史入口、原有 React/CSS 技术栈；没有新增依赖或全局主题系统。

- 月视图默认显示七列、前后月导航、今天定位、年份贴纸、选中日期、计划指示和当日详情。
- 日视图有前后日导航、24小时时间轴及每30秒更新的当前时间标记，使用计划时区。仅选中当天显示当前时间标记。
- 任务没有精确训练时刻字段，全部放在“灵活安排”区，不虚构开始时刻或持续时间。
- 多选必须主动开启；桌面鼠标支持拖选，触屏点击多选、不拦截页面滚动。Escape和pointercancel恢复拖动前选择。已安排日期仍有标记与数量提示，选择不创建、覆盖或保存任何计划。
- 原有 DateCalendar 和旧周计划操作未改；记录面板依旧仅显示当前计划任务。全部旧计划仍在原计划页查看，不宣称本次统一汇总所有历史计划。
- 已完成任务导向现有训练历史页，其他任务进入原训练入口；没有增设修改历史动作。
- 320px采用近满宽面板，保持七列和44px目标；桌面双栏，1024px及以下改为上下布局。
- 真按钮、日期标签、选中状态、可见焦点、方向键、Enter/Space与 reduced-motion 保留。磨砂不支持时使用近不透明暖白底。

## 视觉取舍

借鉴：月份层级、年份贴纸、月／日切换、日期导航、当天内容列表、纵向时间轴、局部炭灰轮廓及轻微偏移阴影。

未复制：大面积纯黑、高饱和黄、全局3–4px边框、全卡片倾斜、办公事件、通知／同步设置及办公式重网格。日历局部采用暖色玻璃拟态和手帐强调，未改变其他模块风格。

## 验证与限制

Windows，本地合成数据5230预览。类型检查、Vite构建、`git diff --check`通过；构建保留现有大包体积警告。项目没有独立lint脚本，不宣称lint通过。

浏览器命令：`GUIDED_EXTERNAL_SERVER=1` 下运行 `node node_modules/@playwright/test/cli.js test --config playwright.guided.config.ts guided-ui.spec.ts --workers 1 --output test-results-calendar`。用例增加320/375/390/430/768/1024/1440px无溢出和44px尺寸、日视图、当前时间、跨日导航、键盘、多选及浏览不改变本地数据断言。桌面与手机视口截图已查看；模拟浏览器不代表真实Chrome/Edge或两台手机验收。

No backend contract changed. No workout domain rule changed. No historical workout was rewritten. No unrelated module was modified by this calendar revision.
