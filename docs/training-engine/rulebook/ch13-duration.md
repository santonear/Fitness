# 第 13 章　时长估算公式

版本：v0.1（2026-10-14）　｜　机器可读镜像：`rules-ch13.yaml`

用户选的是“我今天有 30 分钟”，引擎要据此决定做几个动作、每个几组。第 4 章给出了各时长档位的**槽位结构**（`session.template.min10` … `min90`）和简版时间模型（`session.time.model`）；本章是时间模型的**完整实现规格**：每个参数怎么取、整节课怎么加总、各档位按默认参数实际能容纳多少组，以及把计划拟合到目标时长 ±10% 的确定性算法。两章数值一致；本章只在第 4 章没写到的地方补充（自重动作切换时间、超级组 / 循环块的切换、拉伸块、校准细节）。

**先说清楚证据情况：** 动作节奏对训练效果影响很小（E02:Schoenfeld2015；E02:Currier2026），组间休息有较好的研究基础（E02:Singer2024；E02:Grgic2018-rest），但**换动作、调器械所需时间没有任何系统数据**（E02:Paz2017，待核实）。因此本章几乎所有具体秒数都是 C 级工程选择：它们只是起点，用户练过 3 次后就用实测值替换（`duration.calibrate.personal`）。时长拟合永远不能突破安全、人群和剂量规则设定的上下限（见 `meta.conflict.precedence`）。

所需的动作字段全部来自《动作标注标准 v0.1》：`time.s_per_rep`、`time.setup_s`、`time.per_side`、`nsca_class`、`modality`。

---

## 13.1 单组时间

**[duration.rep.seconds]**

- **规则：** 每次重复的秒数取动作标注的 `time.s_per_rep`；缺失时按类别取默认值：一般 3.5 秒；自重与器械 3.0 秒；大重量杠铃 4.0 秒；慢离心 5.0 秒；弹震 / 爆发类（如壶铃摆）2.0 秒。
- **理由：** 研究方案常用 2 秒向心 + 2 秒离心，每次约 4 秒，10 次一组约 40 秒；单次时长 0.5–8 秒、做到接近力竭时增肌效果相近，所以按实际执行速度取值即可，不需要为效果刻意放慢。
- **证据等级：** C（工程选择，待教练审核；“节奏不影响效果”有 A/B 级支持）
- **来源：** E02:Schoenfeld2015；E02:Currier2026；E02:Paz2017（待核实）；E02:DeSouzaBezerra2025；E02:Ratamess2009
- **例外/注意：** 超慢重复（单次 ≥10 秒）效果较差，引擎不以“放慢”作为填充时间的手段。

**[duration.set.overhead]**

- **规则：** 每组另加固定开销 10 秒（拿起 / 放下器械、调整姿势、呼吸准备）；拉伸类每组 5 秒。
- **理由：** 证据库的时长模型把每组的准备与收尾记为约 10 秒，8–12 次的一组因此约 40–55 秒；拉伸不涉及器械，取一半。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Paz2017（待核实）；E02:Iversen2021

**[duration.unilateral.multiplier]**

- **规则：** 动作标注 `time.per_side = true`（左右分开做）时，工作时间 × 2，每组开销仍只加 1 次；处方写“每侧 N 次 / N 秒”的交替动作同样 × 2。两侧做完计为 1 组。
- **理由：** 左右各做一遍，做功时间翻倍，但拿放器械只发生一次。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Paz2017（待核实）

**[duration.set.work_time]**

- **规则：** 单组时间（秒），`side = 2`（单侧）否则 `1`：
  - 动态动作：`set_s = reps × s_per_rep × side + 10`
  - 静力动作（`modality = isometric`）及计时的负重行走：`set_s = seconds × side + 10`
  - 活动度 / 拉伸（`modality = mobility`）：`set_s = seconds × side + 5`
  - 处方给区间时，`reps` / `seconds` 取区间中值并向上取整。
- **理由：** 把上面三条参数组合成一个可执行公式，与第 4 章 `session.time.model` 一致。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Paz2017（待核实）；E02:Schoenfeld2015；E02:Iversen2021
- **例外/注意：** 示例：哑铃深蹲 10 次 = 10 × 3.5 + 10 = 45 秒；保加利亚分腿蹲每侧 8 次 = 8 × 3.5 × 2 + 10 = 66 秒；侧平板每侧 20 秒 = 50 秒；平板支撑 30 秒 = 40 秒。

---

## 13.2 组间休息与动作切换

**[duration.rest.straight]**

- **规则：** 估算时，组间休息取处方值（第 5 章 `dose.rest.table`）；处方缺失时用默认值：大重量复合动作（每组 ≤6 次，或 `nsca_class = power`）150 秒；其他复合动作 90 秒；孤立动作与静力动作 60 秒。休息只计在组与组之间，最后一组之后不计休息，改计切换时间。
- **理由：** 增肌方面，休息超过 60 秒可能略有好处，超过 90 秒后差别不明显；力量方面，未训练者 60–120 秒已足够，有训练者大重量主项 >2 分钟更好；ACSM 2026 认为长短休息对力量影响不大。默认值取证据库默认区间（120–180 / 90–120 / 60–90 秒）的中点或下端，兼顾时间效率。
- **证据等级：** C（工程选择，待教练审核；休息范围有 A/B 级支持）
- **来源：** E02:Singer2024；E02:Grgic2018-rest；E02:Currier2026；E02:Ratamess2009

**[duration.rest.block]**

- **规则：** 超级组（两个不竞争的动作交替，如推 + 拉、下肢 + 上肢）：组内两个动作之间 15 秒，每轮结束后 75 秒。循环（3–4 个不竞争的动作）：站与站之间 15 秒，每轮结束后 60 秒。不安排同一肌群的超级组（收尾组除外）。
- **理由：** 主动肌—拮抗肌超级组能显著缩短时长，训练量不减甚至更多，长期力量与增肌效果与直组相当；同肌群超级组会降低训练量。每轮后休息 60–90 秒可让每块肌肉获得约 2–3 分钟恢复，取 75 秒；循环每轮后 60 秒与第 4 章一致。
- **证据等级：** C（工程选择，待教练审核；超级组效果有 B 级支持）
- **来源：** E02:Zhang2025（待核实）；E02:Paz2017（待核实）；E02:Iversen2021；E02:Currier2026

**[duration.transition.setup]**

- **规则：** 换到一个新动作时加切换时间，按动作标注的 `setup_s` 归档：`setup_s ≤ 5`（自重）45 秒；`setup_s` 为 15–30（哑铃、壶铃、弹力带、器械、绳索）60 秒；`setup_s = 60`（杠铃）120 秒。换到一个超级组 / 循环块时：块内各动作切换时间的最大值 + 15 秒 ×（块内动作数 − 1）；块内动作之间的移动已包含在 15 秒的组内间隔中。
- **理由：** 证据库的经验值为哑铃 / 器械约 60 秒、杠铃约 120 秒、超级组内约 15 秒（与第 4 章一致）；自重动作没有器械准备，取 45 秒为工程选择。没有系统数据。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Paz2017（待核实）；E02:Iversen2021
- **例外/注意：** 这是最不确定的参数，校准时优先替换。

**[duration.ramp.sets]**

- **规则：** 第一个复合主项前的爬坡组（约 50% 工作重量 × 8 次、约 75% × 3 次）**计入热身时间**（`duration.block.warmup_cooldown`），不另计。之后每个杠铃复合动作（`setup_s = 60`）前另加 1 组爬坡，计 60 秒。爬坡组不计入正式组数。
- **理由：** 针对抗阻训练的综述显示，专项热身组（包括较重的爬坡组）对最大力量和次数表现帮助最大；证据库建议首个复合动作前约 2 组，后续复合动作 0–1 组。第 4 章把首个主项的热身组放在热身环节（WU3），本章与之保持一致。
- **证据等级：** B（秒数为 C 级工程选择）
- **来源：** E03:Ribeiro-2021；E03:Iversen-2021；E02:Iversen2021

---

## 13.3 热身、放松与其他块

**[duration.block.warmup_cooldown]**

- **规则：** 按档位取热身（含首个主项的爬坡组）/ 放松分钟数：

  | 档位 | 热身 | 放松 | 对应第 4 章槽位时间 |
  |---|---|---|---|
  | 10 分钟 | 1 | 1 | 热身 45–75 秒；放松 0–60 秒（可选） |
  | 20 分钟 | 3 | 1 | 热身 2–3 分钟；放松 45–60 秒 |
  | 30 分钟 | 5 | 2 | 热身 3.5–5.5 分钟；放松 2 分钟 |
  | 45 分钟 | 6 | 3 | 热身 4–6.5 分钟；放松 3 分钟 |
  | 60 分钟 | 7 | 4 | 热身 5.5–7.5 分钟；放松 4 分钟 |
  | 90 分钟 | 10 | 6 | 热身 7.5–10 分钟；放松 5–8 分钟 |

  估算取上表整数值（第 4 章区间的上端附近）。中等及以上强度的有氧、HIIT 课，热身与放松各取 max(上表, 5 分钟)（`safety.session.warmup_cooldown`）。热身中不做单块肌肉 ≥60 秒的静态拉伸。
- **理由：** 热身总体上能提升表现；证据库给出各时长的热身 / 放松区间（10 分钟 1–2 / 0–1、20 分钟 3 / 1、30 分钟 4–5 / 2、45 分钟 5–6 / 2–3、60 分钟 6–8 / 3–5、90 分钟 8–10 / 5–10），上表在区间内取值；运动前长时间静态拉伸会降低表现，动态拉伸则略有提升。
- **证据等级：** C（工程选择，待教练审核；热身方式有 B 级支持）
- **来源：** E03:Fradkin-2010（待核实）；E03:Behm-2016；E03:Boullosa-2026；E03:Iversen-2021；E02:Iversen2021；E01:FRANK20
- **例外/注意：** 10 分钟档无法同时满足 5 + 5 分钟的热身 / 放松，因此 10 分钟档不安排高强度有氧或 HIIT；HIIT 课最短 20 分钟。

**[duration.block.cardio]**

- **规则：** 持续有氧块按处方分钟计；间歇块 `block_s = rounds × (work_s + recovery_s) + 30`（30 秒为开始前的准备）；运动小零食按处方分钟计，不加热身。
- **理由：** 有氧块的时长由处方直接决定，只需加少量准备时间。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E01:FRANK20；E03:Rodriguez-2026

**[duration.block.mobility]**

- **规则：** 放松或活动度块中的拉伸，每个动作耗时 `sets × (seconds × side + 5)`，动作之间不计休息；放松块总时长以 `duration.block.warmup_cooldown` 为上限，装不下时减少拉伸动作数。目标为“柔韧”而延长的放松块（第 4 章 variants）按其设定分钟数计。
- **理由：** 拉伸几乎没有准备时间；放松时长由上表统一控制，避免超时。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E03:Behm-2016；E03:Iversen-2021

---

## 13.4 整节课时长

**[duration.session.total]**

- **规则：**

  ```
  直组动作耗时    = transition_s + sets × set_s + (sets − 1) × rest_s
  超级组/循环耗时 = block_transition_s + rounds × (Σ set_s + (k − 1) × 15) + (rounds − 1) × block_rest_s
                    （k = 块内动作数；block_rest_s：超级组 75，循环 60）
  整节课（秒）    = warmup_s + Σ 额外爬坡_s + Σ 动作/块耗时 + Σ 有氧块_s + cooldown_s
  ```

  显示给用户时四舍五入到整分钟。
- **理由：** 把单组、休息、切换、爬坡和热身放松加总；结构简单，便于用实测值逐项校准。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Iversen2021；E02:Paz2017（待核实）；E03:Iversen-2021

**按默认参数，每个正式组平均“占用”的时间（含休息与切换，3 组 / 3 轮为例）：**

| 组织方式 | 每组约占用 | 证据库参考 |
|---|---|---|
| 大重量杠铃直组（5 次 × 4 秒） | 170 秒 | — |
| 复合动作直组（10 次 × 3.5 秒） | 125 秒 | 直组约 2.0–2.5 分钟 |
| 孤立动作直组（12 次 × 3 秒） | 105 秒 | — |
| 超级组（每动作 10 次） | 90 秒 | 约 1.3–1.6 分钟 |
| 循环（3 站自重） | 70–75 秒 | 约 1.0–1.2 分钟 |

快速估算：`可容纳正式组数 ≈ (目标秒数 − 热身 − 放松) ÷ 上表“每组占用”`。例如 30 分钟全部用复合直组：(1800 − 300 − 120) ÷ 125 ≈ 11 组；全部用超级组：1380 ÷ 90 ≈ 15 组。

---

## 13.5 各档位能容纳的组数

**[duration.capacity.table]**

- **规则：** 引擎以第 4 章对应档位的槽位结构为初始方案，按本章公式估算，再用 `duration.fit.algorithm` 拟合到 ±10%。下表是用本章默认参数、按第 4 章结构逐项计算的参考结果（动作参数：自重 10 次 × 3 秒；哑铃复合 10 次 × 3.5 秒；孤立 12 次 × 3 秒；平板 30 秒；侧平板每侧 20 秒；负重行走 40 秒；杠铃主项 5 次 × 4 秒）。

  | 档位 | 热身 / 放松 | 默认结构（第 4 章槽位） | 动作数 | 默认正式组数 | ±10% 内约可容纳 | 模型估算 |
  |---|---|---|---|---|---|---|
  | 10 分钟 | 1 / 1 | C1 循环 3 站（下肢 + 推 + 拉）× 2 轮 | 3 | 6 | 5–7 | 9.2 分钟（−8%） |
  | 20 分钟 | 3 / 1 | SS1 × 3 轮 → SS2 × 2 轮 → K1 × 1 组 | 5 | 11 | 10–12 | 20.4 分钟（+2%） |
  | 30 分钟 | 5 / 2 | M1 × 3 → SS1 × 3 轮 → SS2 × 3 轮 | 5 | 15 | 13–16 | 31.0 分钟（+3%） |
  | 45 分钟（中级） | 6 / 3 | M1 杠铃 × 3 → M2 × 3 → SS1 × 3 轮 → SS2 × 2 轮 → X1 × 2 轮 | 8 | 18 | 17–20 | 44.6 分钟（−1%） |
  | 45 分钟（新手） | 6 / 3 | 同上，M1 为哑铃 / 自重 | 8 | 18 | 18–20 | 42.4 分钟（−6%） |
  | 60 分钟（中级） | 7 / 4 | M1 杠铃 × 4 → M2 × 3 → SS1 × 3 轮 → SS2 × 3 轮 → SS3 × 2 轮 → X1 × 2 轮 | 10 | 23 | 22–26 | 60.0 分钟（0%） |
  | 90 分钟（仅中级） | 10 / 6 | M1、M2 杠铃 4 + 3 组 → M3 × 3 → SS1、SS2 × 3 轮 → SS3 × 2 轮 → K1 × 2 → CN1 15 分钟 | 11 | 28 | 28–32 | 85.8 分钟（−5%） |

  其他约束：10 分钟档只安排低到中等强度内容；单次课每块肌肉超过约 10–11 个折算组后收益很小，多出的时间改为有氧或活动度，而不是继续加组；90 分钟档正式组超过 30 组时提示收益递减（与第 4 章一致）。
- **理由：** 结构取自第 4 章槽位清单，组数范围与证据库的时长模板基本一致（10 分钟 5–7、20 分钟 9–12、30 分钟 12–16、45 分钟 16–20、60 分钟 20–26、90 分钟 28–34）。按本章参数计算，第 4 章部分档位的组数上限（20 分钟 14 组、45 分钟 22 组）会超出目标时长 10% 以上，这些上限由拟合算法自动削减。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Iversen2021；E03:Iversen-2021；E02:Remmert2025（预印本）；E02:Currier2026
- **例外/注意：** 减脂、健康等目标把最后一个辅助块换成 6–10 分钟有氧时（第 4 章 variants），仍按本章公式计时。

---

## 13.6 拟合到目标时长（±10%）

**[duration.fit.tolerance]**

- **规则：** 估算时长 `est` 必须落在 `[0.9 × T, 1.1 × T]`（T 为档位时长，见 `session.durations.allowed`）。多个候选方案都在范围内时，取 |est − T| 最小者；相同时取较短者。
- **理由：** ±10% 对用户来说足够准，也给离散的“整组、整个动作”调整留出空间。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Iversen2021

**[duration.fit.bounds]**

- **规则：** 拟合过程中不得突破：主项复合动作每个 ≥2 组，其他动作 ≥1 组；每个动作组数上限新手 3 组、中级 4 组；全身课至少保留 1 个下肢（`squat` / `lunge` / `hinge`）、1 个推（`push_horizontal` / `push_vertical`）、1 个拉（`pull_horizontal` / `pull_vertical`）动作；M1 永不删除；休息下限为大重量复合 90 秒、其他复合 60 秒、孤立 45 秒；单次课每块肌肉 ≤11 个折算组；所有安全、人群、关节注意、剂量规则的上下限优先。
- **理由：** ACSM 2026 建议力量训练每个动作每次至少 2 组；单次课每肌群约 11 个折算组后增肌收益不再可见；休息下限取证据库可调范围的下端。
- **证据等级：** C（工程选择，待教练审核；每动作 ≥2 组有 A 级支持）
- **来源：** E02:Currier2026；E02:Remmert2025（预印本）；E02:Grgic2018-rest

**[duration.fit.algorithm]**

- **规则：** 从第 4 章对应档位的结构（按用户水平取组数 / 轮数区间的上端）出发，按以下固定顺序调整，每一步后重新估算：
  1. **增减动作数（粗调）：**
     - 超时（est > 1.1T）：按优先级从低到高删除动作——体能块（减脂目标除外）→ 孤立辅助 → 核心 / 负重行走 → 第二个及以后的辅助超级组 → M2；第 4 章写了 `overflow_rule` 的档位先按该规则删。删除后 est ≥ 0.9T，或删除后仍超时，才执行这次删除；否则进入第 2 步。
     - 不足（est < 0.9T）：按第 4 章槽位的动作池顺序加入下一个动作（优先以超级组形式加入），加入后 est ≤ 1.1T 才保留；否则进入第 2 步。
  2. **调组数（细调）：**
     - 超时：从优先级最低的动作开始，每次减 1 组（超级组 / 循环减 1 轮），不低于 `duration.fit.bounds` 的下限，直到 est ≤ 1.1T。
     - 不足：从优先级最高的动作开始，每次加 1 组（或 1 轮），不超过上限；加后 est ≤ 1.1T 才保留，直到 est ≥ 0.9T。
  3. **仍超时（最后手段）：** 把剩余的非主项直组改为不竞争的超级组 → 孤立动作休息降到 45 秒 → 其他复合动作休息降到 60 秒。
  4. **仍不足：** 用放松 / 活动度（任何目标）或低到中等强度有氧（减脂、健康、开始动起来目标）按 1 分钟为单位补足到 ≥0.9T。
  5. **仍无法进入范围：** 超时则保留满足下限的最小方案，并显示 `duration.copy.over_time`；不足则直接使用当前方案。
- **理由：** 规范要求“先增减动作数，再调组数”：动作数决定结构是否完整，是粗调；组数是细调。证据库给出的装不下时的处理顺序是：改为超级组 → 缩短孤立动作休息 → 接受较低容量（每肌群每周不低于 4 组）；这些手段会改变训练体验，所以只在前两步都不够时使用。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Iversen2021；E02:Zhang2025（待核实）；E02:Currier2026
- **例外/注意：** 若因时长不足导致某肌群一周低于剂量章节的最低值，提示用户“每周多加 1 节课”，而不是在单次课里突破上限。
  - **示例 1（超时）：** 中级用户 20 分钟档，按第 4 章上端取 SS1 3 轮 + SS2 3 轮 + K1 2 组（14 组）→ est = 25.1 分钟（+25%）。第 1 步删去优先级最低的 K1（核心）→ est = 22.0 分钟，恰在上限 22.0 内，结束：4 个动作、12 组。
  - **示例 2（不足）：** 新手 60 分钟档（M1、M2 均为哑铃，没有额外爬坡）→ est = 53.8 分钟（−10.4%）。第 1 步加入一个孤立动作超级组 × 2 轮（约 +6.1 分钟）→ est ≈ 59.9 分钟，结束：12 个动作、26 组；再检查每肌群单次 ≤11 个折算组。

**[duration.copy.over_time]**

- **规则：** 拟合后仍超出目标 10% 以上时显示：
  - 中文：「按你选择的时间，我们已经精简到最少的内容，预计需要 {est} 分钟。可以选择更长的时长，或者每周多练一次。」
  - 英文："We've trimmed this session to the essentials for the time you chose. It should take about {est} minutes. You can pick a longer session or add another session this week."
- **理由：** 不悄悄超时，也不为了凑时间去掉必要内容。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Iversen2021

---

## 13.7 个人校准

**[duration.calibrate.personal]**

- **规则：** 用户完成 3 节带逐组计时记录的训练后，用其实测值的中位数替换默认参数：每次重复秒数（按动作类别）、实际组间休息、切换时间；此后用最近 5 节课的中位数滚动更新。若只有整节课的总时长（无逐组计时），则计算 `k = 中位数(实际时长 ÷ 估算时长)`（最近 3 节），把 k 限制在 0.8–1.3 之间后乘到所有估算上。
- **理由：** 换动作和准备时间没有任何系统数据，默认值只能作为起点；证据库建议练过 2–3 次后用记录数据重新估算，取 3 次（与第 4 章一致）。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E02:Iversen2021；E02:Paz2017（待核实）
- **例外/注意：** 校准只改变“估算时长”，不改变处方中的休息时间与组数；k 的上下限防止一两次异常记录造成大幅偏差。

---

## 本章证据与取舍说明

| 主题 | 处理 |
|---|---|
| 切换时间 | 采用证据库经验值（哑铃 / 器械 60 秒、杠铃 120 秒、超级组内 15 秒，与第 4 章一致）；自重 45 秒、块切换规则为本章补充的工程选择，靠校准修正。 |
| 组间休息 | 以第 5 章处方为准；缺省值取证据库默认区间中点或下端（150 / 90 / 60 秒），超级组每轮 75 秒（范围 60–90）。 |
| 热身 / 放松 | 在证据库和第 4 章区间内取整数；首个主项爬坡组并入热身；中等以上有氧另受 5 分钟下限约束。 |
| 第 4 章组数上限 | 20 分钟 14 组、45 分钟 22 组按本模型会超时 10% 以上，由拟合算法削减；建议第 4 章复核这两个上限。 |
| 校准时机 | 证据库给出 2–3 次，取 3 次。 |
| 拟合顺序 | 规范要求先动作数后组数；证据库的省时手段（超级组、缩短休息）放在最后。 |

## 本章来源

- **E02:Schoenfeld2015** — Schoenfeld BJ, Ogborn DI, Krieger JW. 2015. Effect of repetition duration during resistance training on muscle hypertrophy: a systematic review and meta-analysis. *Sports Med* 45(4):577–585. DOI 10.1007/s40279-015-0304-0.
- **E02:Currier2026** — Currier BS, D'Souza AC, Fiatarone Singh MA, et al. 2026. ACSM Position Stand: Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews. *Med Sci Sports Exerc* 58(4):851–872. DOI 10.1249/MSS.0000000000003897.
- **E02:Ratamess2009** — Ratamess NA, Alvar BA, Evetoch TK, et al. 2009. ACSM Position Stand: Progression models in resistance training for healthy adults. *Med Sci Sports Exerc* 41(3):687–708. DOI 10.1249/MSS.0b013e3181915670.（历史版本，已被 2026 版取代）
- **E02:Paz2017**（待核实，年份与卷期未确认）— Paz GA, Robbins DW, de Oliveira CG, Bottaro M, Miranda H. 2017. Volume load and neuromuscular fatigue during an acute bout of agonist-antagonist paired-set vs. traditional-set training. *J Strength Cond Res*. DOI 10.1519/JSC.0000000000001059.
- **E02:DeSouzaBezerra2025** — De Souza Bezerra E. 2025. When duration matters: rethinking resistance training load through time under tension. *Rev Bras Cineantropom Desempenho Hum* 27:e107589.
- **E02:Iversen2021** / **E03:Iversen-2021** — Iversen VM, Norum M, Schoenfeld BJ, Fimland MS. 2021. No time to lift? Designing time-efficient training programs for strength and hypertrophy: a narrative review. *Sports Med* 51(10):2079–2095. DOI 10.1007/s40279-021-01490-1.
- **E02:Singer2024** — Singer A, Wolf M, Generoso L, et al. 2024. Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. *Front Sports Act Living* 6:1429789.
- **E02:Grgic2018-rest** — Grgic J, Schoenfeld BJ, Skrepnik M, Davies TB, Mikulic P. 2018. Effects of rest interval duration in resistance training on measures of muscular strength: a systematic review. *Sports Med* 48(1):137–151. DOI 10.1007/s40279-017-0788-x.
- **E02:Zhang2025**（待核实，作者列表未确认）— Zhang X, Weakley J, Li H, Li Z, García-Ramos A. 2025. Superset versus traditional resistance training prescriptions: a systematic review and meta-analysis. *Sports Med*. DOI 10.1007/s40279-025-02176-8.
- **E02:Remmert2025**（预印本，未经同行评审）— Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC. 2025. Is there too much of a good thing? Meta-regressions of the effect of per-session volume on hypertrophy and strength. SportRxiv.
- **E03:Ribeiro-2021** — Ribeiro B, Pereira A, Neves P, Marinho D, Marques M, Neiva HP. 2021. The effect of warm-up in resistance training and strength performance: a systematic review. *Motricidade* 17(1):87–94.
- **E03:Fradkin-2010**（待核实，作者姓名未确认）— Fradkin AJ, Zazryn TR, Smoliga JM. 2010. Effects of warming-up on physical performance: a systematic review with meta-analysis. *J Strength Cond Res* 24(1):140–148.
- **E03:Behm-2016** — Behm DG, Blazevich AJ, Kay AD, McHugh M. 2016. Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals. *Appl Physiol Nutr Metab* 41(1):1–11.
- **E03:Boullosa-2026** — Boullosa D, Gil-Calvo M, et al. 2026. International expert consensus on warm-up protocols for athletes: a Delphi study. *Int J Sports Physiol Perform*（在线优先）. DOI 10.1123/ijspp.2025-0647.
- **E03:Rodriguez-2026** — Rodríguez MÁ, Quintana-Cepedal M, Cheval B, et al. 2026. Effect of exercise snacks on fitness and cardiometabolic health in physically inactive individuals. *Br J Sports Med* 60(2):133–141.
- **E01:FRANK20** — Franklin BA, Thompson PD, Al-Zaiti SS, et al. 2020. AHA Scientific Statement. *Circulation* 141:e705–e736.
- 参数字段定义见《动作标注标准 v0.1》（`annotation-rubric.md`，`time` 字段）；槽位结构见第 4 章。


## v2 调整：规则分级与目标

以下调整取代本章对应项目的旧硬门槛表述，其余准入和动作安全排除保持原样。

- `duration.fit.bounds`：时长±20%为hard；10分钟课允许8–14分钟，保留其他原硬性剂量边界。
- `duration.fit.tolerance`：±10%以内目标满分，偏差10%–20%线性扣分；超出hard边界仍失败。


### v2 预览裁定（2026-10-18）：单条有氧上限

mechanic规则duration.cardio.cap：明确低强度移动四类及其他low_intensity且impact0每条600秒，其他300秒；专项更低上限优先。整条按sets×durationSeconds×单侧倍数计算，同一动作每课只出现一次。先用不同合法动作/合法组数补时；真实安全容量耗尽才保留短课，原目标不变，低于20%下界记intentional_short与实际时长。生产与独立校验各自核实，不以trace或前端标记豁免。

## v2 调整：补时容量与有意缩短（2026-10-18）

按用户裁定，四步补时顺序保存在 mechanic `duration.cardio.cap.refill`，各步骤均须通过完整硬规则及动作自身剂量。新手力量周组数不限制合法的低强度活动。只有穷尽所有合法补时路径，才允许有意缩短；trace记录缺少的秒数与阻碍规则，计划显示已批准提示。

单列口径保留原始时长达标率；真实分布中的单列画像不得超过5%，任何目标课程不得低于目标50%。超过任一上限须停止，不自行降门槛。专项无目标时长的产后阶段1保留原来源安排，不伪造一个目标用于补时。
