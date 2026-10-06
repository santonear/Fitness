# Fitness UI/UX 设计原则与限制 — 新视觉总规范

版本：2026-10-07 Visual System Revision

适用范围：

- Onboarding
- Dashboard
- Calendar
- Training
- Exercise Library
- Progress / History
- Settings
- AI Conversation
- Shared Navigation
- Shared UI Components

本规范用于替换此前容易将产品视觉收敛为“普通浅色 Web App”的相关描述。

本规范不修改业务规则、数据模型、安全边界、训练规则、AI 写入规则或备份规则。

---

# 1. 总体设计方向

Fitness 的正式视觉语言定义为：

# Warm Nordic Editorial UI

其组成是：

```text
Warm Nordic foundation
+
Editorial / Journal composition
+
Paper content surfaces
+
Structured Brutalist outlines
+
Glass shells
+
Orange functional accents
+
Yellow journal accents
```

中文定义：

> 暖色北欧编辑风：玻璃外壳 + 纸张内容层 + 结构性粗野主义描边 + 手帐强调。

---

# 2. 最终设计目标

整个产品必须同时具备：

```text
年轻
轻快
有动感
有个性
清晰
易读
有实体感
有纸张与编辑设计感
```

避免：

```text
Generic SaaS
Generic Glassmorphism
Enterprise Dashboard
Corporate Calendar
Admin Panel
纯 Material Design
纯 Apple Fitness 模仿
重度 Neo-Brutalism 展示作品
```

设计应让用户明显感觉：

> 这是一个拥有自身视觉身份的 Fitness 产品，而不是套用常见 UI Template。

---

# 3. 风格组成

不再给全站固定百分比。

不同页面允许调整。

建议：

## Calendar

```text
Editorial / Journal: 强
Structured Brutalism: 强
Nordic Minimalism: 中
Glass: 辅助
```

## Dashboard

```text
Nordic Minimalism: 强
Editorial: 中
Glass: 中
Structured Brutalism: 中
```

## Onboarding

```text
Nordic Minimalism: 中
Editorial / Illustration: 强
Glass: 中
Structured Brutalism: 中
```

原则：

> 页面职责决定视觉比例，而不是所有页面机械执行同一种比例。

---

# 4. Reference Image 规则

当产品负责人为某个页面指定 Reference Image 时，该 Reference Image 不仅用于理解功能、构图或交互。

它同时是该页面以下方面的视觉基准：

```text
composition
geometry
density
spacing rhythm
border language
card treatment
typographic hierarchy
editorial personality
visual balance
```

允许高度适配 Reference 的：

```text
布局比例
组件密度
纸卡结构
描边语言
阴影关系
标签形态
排版层级
导航紧凑度
```

不直接复制：

```text
第三方品牌
商标
具体文本
不存在的业务功能
未经实现的云能力
未实现的数据
第三方独有资产
```

核心规则：

> Reference Image 决定页面的视觉骨架。

> Fitness Design System 决定最终品牌色、材质和产品身份。

---

# 5. Reference Fidelity

当任务明确要求“参考示例图实现”时：

Reference Fidelity 的优先级高于：

```text
generic cleanliness
默认组件样式
历史 CSS 惯性
模板化响应式拉伸
```

只要不破坏：

```text
可访问性
可读性
真实数据
业务规则
响应式可用性
```

应优先保持 Reference 的：

```text
视觉密度
结构
信息层级
描边节奏
组件比例
```

---

# 6. Visual QA 要求

Reference-based 页面完成后必须执行：

```text
Current Screenshot
vs
Reference Screenshot
```

并检查至少：

```text
1. Composition
2. Geometry
3. Density
4. Border language
5. Typography hierarchy
6. Card hierarchy
7. Accent usage
8. Empty space
9. Navigation scale
10. Responsive adaptation
```

如果其中 3 项以上仍明显偏离：

> 不视为视觉完成。

必须至少进行一次额外 Visual Refinement。

---

# 7. 设计原则与业务原则分离

必须明确区分：

## Visual Rules

可以持续演进：

```text
colors
radius
borders
shadows
spacing
layout
illustration
typography
animation
```

## Product Boundaries

视觉改动不得破坏：

```text
真实数据
训练事实
AI 用户确认
历史记录
备份安全
本地功能
权限
domain contract
```

---

# 8. Color System

当前统一色板：

```css
--bg-primary: #F5F0E7;
--bg-secondary: #ECE5D9;

--surface-paper: #FCFAF5;
--surface-paper-muted: #F7F2E9;

--surface-glass: rgba(255,255,255,.68);
--surface-glass-strong: rgba(255,255,255,.80);

--text-primary: #292623;
--text-secondary: #696158;
--text-muted: #9A9289;

--outline: #38332F;
--outline-medium: rgba(56,51,47,.55);
--outline-soft: rgba(56,51,47,.22);

--accent-orange: #F48543;
--accent-orange-soft: #FFE0C8;

--accent-yellow: #F5ED8A;
--accent-yellow-strong: #E9D95F;

--danger-text: #943E33;
--danger-bg: #FAE9E3;
```

优先复用现有 token。

---

# 9. Color Responsibility

## Orange

Orange 是功能色：

```text
selected
active
primary CTA
progress
current workout
current time
important interactive state
```

## Yellow

Yellow 是 Editorial / Journal accent：

```text
sticker
date label
year
Today
PR
AI Insight
optional note
small highlight
```

规则：

```text
Orange = Function
Yellow = Personality
```

---

# 10. 不使用纯黑作为默认轮廓

默认：

```css
#38332F
```

而不是：

```css
#000000
```

纯黑仅在确有设计需要时使用。

---

# 11. Material Hierarchy

正式区分三种材质。

---

## 11.1 Glass Shell

Glass 用于：

```text
navigation shell
large outer container
toolbar
modal
floating controls
desktop panel shell
```

示例：

```css
background: rgba(255,255,255,.68);
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,.70);
```

Glass 是：

> Shell

不是：

> default content material。

---

## 11.2 Paper Surface

Paper 用于：

```text
calendar cells
event cards
onboarding choices
metric cards
editorial labels
content blocks
```

示例：

```css
background: #FCFAF5;
```

或轻微半透明纸色。

Paper 是主要内容实体。

---

## 11.3 Editorial Accent

Editorial Accent：

```text
yellow sticker
orange selected card
black/charcoal label
small offset paper block
```

用于建立产品识别。

---

# 12. Glass 使用限制

不要：

```text
every card = glass
every cell = blur
multiple nested backdrop-filter
```

原因：

- 会降低视觉结构
- 降低性能
- 容易变成 Generic Glassmorphism

原则：

> Glass 包围内容，Paper 承载内容。

---

# 13. Structured Brutalist Outline

正式取消：

> “粗描边只能用于少量元素”

的限制。

新的原则：

> 不给所有组件使用同一种粗度，但允许 Border 成为 Layout System。

即：

```text
border 可以广泛使用
border weight 必须分层
```

---

# 14. Border Hierarchy

推荐：

```text
Soft structure
1px / rgba charcoal

Normal paper component
1–1.5px charcoal

Important card
1.5px charcoal

Selected
2px charcoal

Primary CTA
1.5–2px charcoal

Sticker
1–1.5px charcoal
```

重要：

> “不给全部元素加粗框”不等于“只有 selected 才有明显边框”。

Calendar 等页面允许：

> 大部分 Date Cells 都具有明确结构性 outline。

---

# 15. Border 是结构，而不只是装饰

尤其：

```text
Calendar
Onboarding cards
Event cards
Dashboard highlights
```

Border 可以负责：

```text
layout rhythm
grouping
state separation
paper feeling
editorial hierarchy
```

---

# 16. Shadow System

区分：

## Soft Environmental Shadow

用于：

```text
large glass shell
modal
outer panel
```

例如：

```css
0 12px 30px rgba(56,51,47,.05)
```

---

## Offset Editorial Shadow

用于：

```text
selected
CTA
sticker
event card
important content
```

例如：

```css
3px 4px 0 rgba(56,51,47,.12)
```

可叠加：

```css
0 8px 18px rgba(56,51,47,.04)
```

---

# 17. Offset Shadow 必须是设计语言

不要因为认为它“不够现代”而自动删除。

Offset Shadow 是：

> 有意识的 tactile / editorial design element。

但不要所有组件统一使用强 offset。

---

# 18. Radius System

不强制全站统一圆角。

按组件角色使用：

```text
Sticker:
3–6px

Calendar cell:
4–8px

Small control:
8–10px

Event / selection card:
8–14px

Standard card:
12–18px

Glass shell:
16–24px

Onboarding hero container:
可到 24–26px
```

重要：

> Paper 内容通常比 Glass Shell 更方。

---

# 19. 避免“大圆角 = 现代”的默认思维

不要机械使用：

```text
18–24px
```

覆盖所有组件。

Calendar、Editorial Card、Sticker 应明显更硬朗。

---

# 20. Density

正式加入：

# Density Preservation

响应式不等于：

> 所有内容跟着容器无限拉伸。

例如 Calendar：

```text
Date cell
Chart
Control group
Metric group
```

允许：

```text
fixed density
max-width
min/max geometry
```

---

# 21. Desktop Adaptation

移动 Reference 转换到 Desktop 时：

错误：

```text
把手机布局横向拉宽
```

正确：

```text
保留移动端视觉密度
+
利用额外空间增加相关信息
```

例如：

```text
Calendar Grid 保持紧凑
Detail Panel 使用额外空间
```

而不是 Date Cell 变成 100px 宽。

---

# 22. White Space

Nordic Minimalism 不等于：

> 大面积空白。

White Space 必须服务于：

```text
grouping
focus
breathing
hierarchy
```

不允许：

```text
因为容器很宽而自然留下大量无意义空白
```

---

# 23. 年轻、轻快的重新定义

“年轻、轻快、有动感”不等于：

```text
更浅的边框
更多空白
更大的圆角
更弱的层级
```

允许通过：

```text
bold editorial typography
compact cards
strong outlines
yellow stickers
orange accents
offset shadows
short motion
```

表达年轻感。

---

# 24. Typography

继续使用系统无衬线字体。

不要依赖外部字体。

允许：

```text
400
500
600
700
```

关键数字和标题可更大胆。

---

# 25. Typography Hierarchy

页面必须明显区分：

```text
Page title
Section label
Card title
Primary metric
Metadata
Caption
Sticker
```

不要所有文本都落在：

```text
14–16px
400–500
```

导致层级弱化。

---

# 26. Editorial Typography

允许：

```text
uppercase sticker
large date numbers
tight heading tracking
small metadata
section block labels
```

但不要求全站 uppercase。

中文可以通过：

```text
字重
框
底色
标签
尺寸
```

表达 Editorial hierarchy。

---

# 27. Sticker System

Sticker 是正式 Design Component。

用于：

```text
YEAR
TODAY
OPTIONAL
PR
AI INSIGHT
CATEGORY
STATUS
```

推荐：

```text
yellow surface
charcoal border
3–6px radius
small offset shadow
0–1° rotation
```

---

# 28. Sticker 限制

不要：

```text
每个组件都有 Sticker
```

Sticker 用于：

```text
context
editorial emphasis
brand signature
```

---

# 29. Illustrations

Onboarding / Empty State 使用统一自生成或本地插图。

统一：

```text
2D editorial
charcoal outline
warm ivory
orange
yellow
minimal muted secondary colors
flat shapes
minimal shading
handcrafted irregularity
```

禁止：

```text
photorealistic
3D
anime
emoji
stock illustration
neon
generic AI gradient
```

---

# 30. Onboarding Illustration Density

概念问题：

```text
大图
```

数值问题：

```text
小图
```

Safety：

```text
更克制
```

插图不得挤压主要交互。

---

# 31. Interaction

主要操作必须明确。

不要多个同等级 Primary CTA。

---

# 32. Selection Feedback

Selected State 不应只靠颜色。

建议至少使用：

```text
background
border
shadow
```

必要时增加：

```text
small scale
```

---

# 33. Motion

默认：

```text
feedback:
约 120–180ms

entry:
约 180–240ms

slide:
约 6–12px
```

不要：

```text
large motion
bounce
持续循环动画
```

---

# 34. Hover

允许：

```text
translateY(-1px)
small shadow increase
border emphasis
```

避免：

```text
scale 1.05
```

---

# 35. Reduced Motion

必须尊重：

```css
prefers-reduced-motion
```

关闭：

```text
slide
scale
continuous motion
rotation animation
```

---

# 36. Accessibility

必须保留：

```text
320px 可用
44px touch target 基准
keyboard
focus visible
semantic controls
ARIA
4.5:1 text contrast target
3:1 meaningful non-text contrast target
```

但：

> Accessibility 不要求 Calendar Date Cell 在 Desktop 无限拉宽。

可以通过：

```text
minimum hit area
pseudo hit area
compact grid
```

同时满足 density。

---

# 37. Calendar 特殊视觉规范

Calendar 是当前最强调 Editorial / Journal Brutalism 的页面之一。

---

# 38. Calendar Geometry

Month Grid 必须：

```text
compact
boxed
density-preserving
```

所有 Date Cell：

```text
有可见结构
```

而不是只靠间距。

---

# 39. Calendar Date Cell

建议：

```text
Desktop visual cell:
约 48–62px 宽
约 44–56px 高

Mobile:
按容器等比压缩，但保持 7 列
```

实际可根据 viewport 调整。

---

# 40. Calendar Border Language

普通：

```text
1px visible outline
```

Selected：

```text
2px charcoal
```

Today：

```text
sticker / marker
```

Workout：

```text
orange dash / tab
```

---

# 41. Calendar Material

```text
Outer Shell:
glass

Date Cells:
paper

Event Cards:
paper

Sticker:
solid paper color
```

不要所有 Date Cell 做玻璃。

---

# 42. Calendar Section Label

必须至少有一处强 Editorial Label。

例如：

```text
TODAY'S TRAINING
今日训练
SELECTED DAY
```

可以：

```text
charcoal background
ivory text
```

或：

```text
yellow paper
charcoal outline
```

---

# 43. Calendar Desktop

不要默认：

```text
50 / 50 giant master-detail
```

建议：

```text
Calendar / Main
60–65%

Detail
35–40%
```

Calendar 主栏内部仍然可以包含：

```text
Month Grid
+
Training summary
```

---

# 44. Dashboard 特殊规范

Dashboard 比 Calendar 更理性。

允许：

```text
larger glass cards
lighter border density
more chart whitespace
```

但必须共享：

```text
charcoal
orange
yellow
paper
editorial labels
```

---

# 45. Dashboard Chart

不要使用高饱和彩虹配色。

主系列：

```text
orange
```

辅助：

```text
muted blue-gray
muted olive
warm gray
```

---

# 46. Onboarding 特殊规范

Onboarding 是点击优先。

原则：

```text
One screen
One decision
One primary interaction
One CTA
```

---

# 47. Onboarding Selection

普通：

```text
glass / paper
thin outline
```

Selected：

```text
orange soft
charcoal outline
offset shadow
```

---

# 48. Onboarding 数据语义

必须明确区分：

```text
answered
explicit none
skipped
unknown
```

例如：

```text
No equipment
≠
Skipped

No preference
≠
Skipped

No known limitation
≠
Skipped
```

---

# 49. Measurement 与 Profile

Onboarding 中的当前体重：

```text
Profile snapshot
```

不自动产生：

```text
Measurement History Record
```

---

# 50. Safety

Skip：

```text
Unknown
```

绝不自动转换成：

```text
Healthy
No injury
No restriction
```

---

# 51. Data Truth

禁止：

```text
fake workout
fake calories
fake measurement
fake progress
fake AI success
fake backup success
fake analytics
```

---

# 52. AI Confirmation

AI 候选和解析结果：

> 未经用户确认，不得写成正式计划或事实。

---

# 53. 本地功能

AI / Network 不可用：

> 不得阻止已经支持的本地训练操作。

---

# 54. Reference 不代表业务能力

如果 Reference 有：

```text
cloud sync
Google Calendar
notifications
```

而当前产品没有：

> 不得因为截图而伪造。

---

# 55. Component Reuse

共享视觉语言必须通过真实 shared tokens / shared components 实现。

避免：

```text
CalendarOrange
DashboardOrange
OnboardingOrange
```

这种重复体系。

---

# 56. Shared Visual Components

优先复用 / 建立：

```text
GlassShell
PaperCard
JournalSticker
EditorialLabel
OutlinedButton
PrimaryButton
SelectionCard
EmptyState
```

只有实际复用时才抽象。

---

# 57. Existing CSS 不具有永久优先级

现有：

```text
ui-ux-max-theme.css
training-calendar.css
analytics-theme.css
onboarding-theme.css
```

是当前实现，不是不可修改的视觉真源。

如果现有 CSS 与新版 Design System 冲突：

> 应更新现有 CSS，而不是为了兼容旧样式牺牲新视觉目标。

---

# 58. Existing Components 不应限制视觉重构

允许：

```text
调整 DOM wrappers
修改 class hierarchy
调整 grid geometry
调整 CSS token
```

只要不破坏：

```text
业务逻辑
数据状态
test contract
accessibility
```

---

# 59. Visual Refactor ≠ Domain Refactor

视觉任务中：

禁止无必要修改：

```text
Workout domain
Calendar state
AI contract
CAL contract
Storage model
Historical data
Backend API
```

---

# 60. Responsive Validation

至少：

```text
320
375
390
430
768
1024
1280
1440
```

---

# 61. Desktop Rule

Desktop：

> 利用空间，而不是拉伸内部组件。

---

# 62. Mobile Rule

Mobile：

> Reference fidelity 通常优先级最高。

尤其当 Reference 本身为移动端时。

---

# 63. Empty State

不能只是：

```text
icon
+
一句话
+
巨大空白
```

应设计为：

```text
compact composition
+
editorial label
+
clear CTA
+
small illustration if useful
```

---

# 64. Loading

使用：

```text
stable skeleton
```

不要 full-screen spinner。

---

# 65. Error

错误靠近对应操作。

保留未提交数据。

失败不能残留假成功状态。

---

# 66. 页面职责

## Global Navigation

```text
明确主目的地
Desktop grouped navigation
Mobile compact navigation
```

---

## Dashboard

```text
summary
facts
trends
```

不展示假指标。

---

## Calendar

```text
month
day
date state
workout state
```

不伪造未指定时间。

---

## Training

```text
active workout
timing
set entry
saved facts
```

---

## Exercise Library

```text
search
filter
instructions
safety
```

---

## History

```text
filter
statistics
source truth
```

---

## Settings

```text
backup
training conditions
measurements
```

---

## AI

```text
input
confirmation
candidate
saved result
error
```

---

# 67. Visual Completion Definition

不能仅因为：

```text
功能正确
lint pass
build pass
```

就宣布视觉任务完成。

Visual Task 必须同时满足：

```text
Reference comparison
Screenshot verification
Responsive check
Visual hierarchy check
```

---

# 68. Screenshot-based Iteration

当任务提供 Reference 时：

至少：

```text
1. Render
2. Screenshot
3. Compare
4. Identify top differences
5. Refine
```

如果环境支持。

---

# 69. 优先解决顺序

视觉差距较大时：

```text
1. Geometry
2. Density
3. Composition
4. Typography
5. Borders
6. Shadows
7. Color
8. Micro animation
```

不要一开始就只调颜色。

---

# 70. 最终视觉原则

一句话：

> Fitness 不是“暖色 Glass App”，而是“暖色 Nordic Editorial Product”。

Glass 是外壳。

Paper 是内容。

Outline 是结构。

Orange 是功能。

Yellow 是个性。

Reference 是页面视觉骨架。

真实数据和业务规则是不可破坏的底线。