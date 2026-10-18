# Fitness V9 定版设计稿（2026-10-19）

来源：Claude 设计画布 https://claude.ai/artifact/SwR4dUfYLTWgTkB1GdXhWk （Bo 已定版）。
本目录是该画布的源文件快照，作为 V9 改版的唯一视觉参照。

- `Main.dc.html`：可交互原型入口，按主题切到下面五套组件。
- 五套风格（同时上线，用户在"我的"里切换）：
  - `Pop.dc.html` 柔光拟物（默认，pop）
  - `Vivid.dc.html` 山野暖阳（vivid，配 `Scene.dc.html` 山野插画）
  - `Gentle.dc.html` 温和陪伴（gentle）
  - `Data.dc.html` 专业数据（data，深色）
  - `Fire.dc.html` 燃动挑战（fire，深色）
- 每套 10 个关键页面：welcome 欢迎、onboard 一题一屏引导、plan 第一周计划、home 今天、player 训练中、rest 组间休息、finish 练完了、review 回顾、chat 芽芽、settings 我的。
- `Orb.dc.html`：芽芽悬浮助手（可上下拖动、靠边、点开快捷面板）。
- `Yaya.dc.html` / `YayaPoses.dc.html`：芽芽形象与 10 个动作；图片在 `public/yaya/<pose>-<theme>.webp`。
- `Admin.dc.html`：后台总览（宽屏优先）。

体验问题清单见 `docs/verification/production-health-check-2026-10-19.md`。
