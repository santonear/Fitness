# 欢迎引导视觉修订

首次引导使用独立单题布局，收起侧栏及面包屑。保留既有暖色、字体字重和键盘焦点规范；正文使用 Arial / Microsoft YaHei 提高可读性。数值选择器展示五行相邻值，中心行标明当前值；备用数值输入折叠，重复示例说明合并。记录面板布局与数据保存契约未改。

验证环境：Windows，本地 Vite 5230，合成测试库。

- TypeScript 检查通过，Vite 构建通过；现有大包体积警告仍存在。
- `GUIDED_EXTERNAL_SERVER=1` 下运行 `node node_modules/@playwright/test/cli.js test --config playwright.guided.config.ts guided-ui.spec.ts --workers 1`：Chromium / WebKit 6 项通过。覆盖确认前不保存、键盘确认、跳过、刷新进度、重置保留历史及中英文训练流程。
- Chromium 单独检查鼠标滚轮与拖动均改变当前选择。
- 人工检查桌面 1440×900 与手机视口 390×844 截图；浏览器回归另覆盖 320px 无横向溢出。模拟视口不代表真机验证。
- 截图：`outputs/welcome-redesign-desktop.png`、`outputs/welcome-redesign-mobile.png`。

本次仅本地修订，未提交、部署或调用真实模型。
