# 第 3 章　每周结构

机器规则：`rules-ch03.yaml`（本章 27 条规则，id 一一对应）

本章决定"一周里哪几天练什么"。步骤：
1. 按目标和可用天数算出力量训练天数（[week.days.allocation]）；
2. 选每周模板（[week.template.rt1] 至 [week.template.rt6]）；
3. 每个训练日套用日模板（[week.day.*]），日模板给出有序的"位置 → 动作模式"清单；
4. 第 4 章按单次训练时长，从日模板里按位置取用槽位；
5. 用覆盖、频率、恢复规则检查整周。

**核心结论**：分化方式只是排课工具，不决定效果。总组数相同时，全身训练和分化训练的力量、肌肉增长没有差别（E03:Ramos-Campo-2024）。因此模板以"每肌群每周 ≥2 次、每次每肌群组数不过多"为准则来挑。

## 3.1　天数分配

**[week.days.allocation]**
- **规则**：力量训练天数 = min（用户可用天数，目标力量课上限，新手阶段上限）。可用天数少于目标下限时，力量训练天数等于可用天数。多出的天按目标安排：先动起来、减脂 → 有氧日；灵活性 → 柔韧日；健康、增肌、力量 → 有氧日与柔韧日交替（先有氧）。每周至少 1 天完全休息。
- **理由**：能长期坚持的日程比任何优化都重要；先按可用时间定频率，再分配组数。
- **证据等级**：C
- **来源**：E03:ACSM-2026；E03:NSCA-Hoffman；E04:S8
- **例外/注意**：新手阶段上限见第 7 章 `progression.new.week_caps`（第 1 周 2 次）。

## 3.2　每周模板

| 力量天数 | 模板 id | 分化 | 轮换 | 默认星期 |
|---|---|---|---|---|
| 1 | week.template.rt1 | 全身 | C | 周三 |
| 2 | week.template.rt2 | 全身 A/B | A、B | 周一、周四 |
| 3 | week.template.rt3 | 全身 A/B | 单周 A-B-A，双周 B-A-B | 周一、三、五 |
| 4 | week.template.rt4 | 上下肢 ×2（单次 ≥45 分钟）；否则全身 A/B ×2 | U1-L1-U2-L2 或 A-B-A-B | 周一、二、四、五 |
| 5 | week.template.rt5 | 上下肢 ×2 + 全身（仅增肌） | U1-L1-U2-L2-C | 周一、二、四、五、六 |
| 6 | week.template.rt6 | 推/拉/腿 ×2 或上下肢 ×3（仅中级增肌，需主动选择） | P-L-Lg ×2 | 周一至周六 |

**[week.template.rt1]**
- **规则**：每周 1 次力量训练时，用全身日模板 C（fb_c），默认周三，并显示 [week.one_day.copy] 提示。
- **理由**：低于指南"每周 ≥2 天"的底线，但总组数相同时，每周练 1 次也能增肌；补充运动小零食可以改善心肺适能。
- **证据等级**：B
- **来源**：E03:ACSM-2026；E02:Schoenfeld2019；E03:Rodriguez-2026

**[week.template.rt2]**
- **规则**：每周 2 次，全身 A（fb_a）+ 全身 B（fb_b），两次间隔 ≥48 小时，默认周一、周四。
- **理由**：这是让每个肌群每周练到 2 次的最小方案；A、B 两天合起来覆盖蹲、髋铰链、水平推拉、垂直推拉和单腿模式。
- **证据等级**：B
- **来源**：E03:Ramos-Campo-2024；E03:ACSM-2026；E03:Garber-2011（待核实）

**[week.template.rt3]**
- **规则**：每周 3 次，全身 A/B 交替：单周 A-B-A，双周 B-A-B；间隔 ≥48 小时，默认周一、三、五。
- **理由**：每周 2–3 次、不连续的全身训练是 ACSM 推荐的新手方案。
- **证据等级**：B
- **来源**：E03:Ramos-Campo-2024；E03:Garber-2011（待核实）；E02:Ratamess2009

**[week.template.rt4]**
- **规则**：每周 4 次。单次时长 ≥45 分钟时用上下肢分化 U1-L1-U2-L2；单次时长 <45 分钟时用全身 A-B-A-B，连续两天的第二天按"轻日"执行（[week.recovery.light_day]）。默认周一、二、四、五。
- **理由**：总组数相同时两种方式效果相同；短课时上下肢分化难以完成足量的同侧超级组配对，而全身课更容易配成上下肢交替的超级组。
- **证据等级**：B
- **来源**：E03:Ramos-Campo-2024；E02:Schoenfeld2019；E03:NSCA-Hoffman

**[week.template.rt5]**
- **规则**：只有增肌目标会排到每周 5 个力量日：U1-L1-U2-L2 + 全身 C，默认周一、二、四、五、六；单次 <45 分钟时改用 A-B-C-A-B 全身轮换。
- **理由**：其他目标的力量课上限 ≤4 次（第 2 章）；第 5 天用全身课补足各肌群的频率。
- **证据等级**：C（工程选择）
- **来源**：E03:Ramos-Campo-2024；E02:Schoenfeld2019；E03:NSCA-Hoffman

**[week.template.rt6]**
- **规则**：每周 6 个力量日只开放给主动选择的中级增肌用户，单次 ≥45 分钟：默认推/拉/腿 ×2，可选上下肢 ×3。不满足条件时改为 4 个力量日 + 2 个有氧/柔韧日。
- **理由**：每肌群每周 5–6 次的高频训练研究不足；对一般用户收益很小。
- **证据等级**：C
- **来源**：E03:NSCA-Hoffman；E02:Pelland2024（待核实）；E03:ACSM-2026

## 3.3　日模板（逐日动作模式槽位）

日模板是一份**有序**清单。位置名是固定词表：`main_1–3`（主项）、`acc_1–4`（辅助）、`core_1–2`（核心）、`carry_1`（负重行走/地面动作）。时长短的课只取前几个位置（第 4 章）。动作模式枚举与《动作标注标准》一致。

| 位置 | 全身 A fb_a | 全身 B fb_b | 全身 C fb_c | 上肢 1 u1 | 上肢 2 u2 | 下肢 1 l1 | 下肢 2 l2 |
|---|---|---|---|---|---|---|---|
| main_1 | squat | hinge | squat | push_horizontal | push_vertical | squat | hinge |
| main_2 | push_horizontal | push_vertical | pull_horizontal | pull_horizontal | pull_vertical | hinge | lunge |
| main_3 | pull_horizontal | pull_vertical | push_horizontal | push_vertical | push_horizontal | lunge | squat |
| acc_1 | hinge（腰负荷 ≤1 优先） | lunge | hinge | pull_vertical | pull_horizontal | isolation_lower | isolation_lower |
| acc_2 | pull_vertical | pull_horizontal | pull_vertical | pull_horizontal（腰负荷 0 优先） | pull_horizontal（腰负荷 0 优先） | isolation_lower | isolation_lower |
| acc_3 | isolation_lower | isolation_upper | push_vertical | isolation_upper | isolation_upper | — | — |
| acc_4 | isolation_upper | isolation_lower | lunge | isolation_upper | isolation_upper | — | — |
| core_1 | anti_extension | anti_rotation | anti_extension | anti_rotation | anti_extension | anti_extension | anti_rotation |
| core_2 | anti_lateral_flexion | trunk_flexion / rotation | anti_rotation / anti_lateral_flexion | anti_lateral_flexion | rotation / trunk_flexion | anti_lateral_flexion | trunk_flexion / rotation |
| carry_1 | carry / locomotion_ground | carry / locomotion_ground | carry / locomotion_ground | carry | carry | carry / locomotion_ground | carry / locomotion_ground |

| 位置 | 推 push | 拉 pull | 腿 legs |
|---|---|---|---|
| main_1 | push_horizontal | pull_vertical | squat |
| main_2 | push_vertical | pull_horizontal | hinge |
| main_3 | push_horizontal | pull_vertical / pull_horizontal | lunge |
| acc_1 | isolation_upper | pull_horizontal | isolation_lower |
| acc_2 | isolation_upper | isolation_upper | isolation_lower |
| acc_3 | pull_horizontal（轻） | isolation_upper | — |
| core_1 | anti_extension | anti_rotation | anti_lateral_flexion |
| core_2 | anti_lateral_flexion | — | trunk_flexion / rotation |
| carry_1 | — | carry | — |

**[week.day.fb_a]**
- **规则**：全身 A 的位置顺序为：蹲（主）→ 水平推（主）→ 水平拉（主）→ 髋铰链辅助（优先腰部负荷 ≤1，如臀桥、臀推）→ 垂直拉 → 下肢孤立 → 上肢孤立 → 抗伸展 → 抗侧屈 → 负重行走或地面动作。
- **理由**：每天都包含下肢、上肢推、上肢拉，满足全身课的定义；把重的髋铰链放在 B 日，A 日用轻量髋铰链，避免两天都给腰部高负荷。
- **证据等级**：C
- **来源**：E03:Garber-2011（待核实）；E04:S21；E04:S25

**[week.day.fb_b]**
- **规则**：全身 B 的位置顺序为：髋铰链（主）→ 垂直推（主）→ 垂直拉（主）→ 单腿（lunge）→ 水平拉 → 上肢孤立 → 下肢孤立 → 抗旋转 → 屈体或旋转 → 负重行走或地面动作。
- **理由**：与 A 日互补；A、B 两日合起来，膝主导、髋主导、推、拉各 ≥2 次。
- **证据等级**：C
- **来源**：E03:Garber-2011（待核实）；E04:S21；E04:S25

**[week.day.fb_c]**
- **规则**：全身 C（单日方案和 5 日方案的第 5 天）：蹲 → 水平拉 → 水平推 → 髋铰链 → 垂直拉 → 垂直推 → 单腿 → 抗伸展 → 抗旋转或抗侧屈 → 负重行走或地面动作。
- **理由**：只做前 4 个位置也能覆盖蹲、髋铰链、推、拉；时间多时再补垂直推拉和单腿。
- **证据等级**：C
- **来源**：E03:Iversen-2021；E04:S21

**[week.day.u1]**　**[week.day.u2]**
- **规则**：上肢 1 以水平推拉为主，上肢 2 以垂直推拉为主；每个上肢日排 2 个推、3 个拉（第 3 个拉优先腰部负荷 0 的动作，如面拉、俯身支撑划船），再接 2 个上肢孤立、2 个核心和 1 个负重行走。
- **理由**：拉类位置多于推类，直接满足"每周拉 ≥ 推"（第 6 章）。
- **证据等级**：C
- **来源**：E03:NSCA-Hoffman；E04:S25

**[week.day.l1]**　**[week.day.l2]**
- **规则**：下肢 1：蹲 → 髋铰链 → 单腿 → 2 个下肢孤立 → 抗伸展 → 抗侧屈 → 负重行走或地面动作。下肢 2：髋铰链 → 单腿 → 蹲（优先腰部负荷 ≤1，如高脚杯蹲、腿举）→ 2 个下肢孤立 → 抗旋转 → 屈体或旋转 → 负重行走或地面动作。
- **理由**：每个下肢日都包含膝主导和髋主导动作，两天的重点轮换。
- **证据等级**：C
- **来源**：E03:NSCA-Hoffman；E04:S25

**[week.day.push]**　**[week.day.pull]**　**[week.day.legs]**
- **规则**：推日：水平推 → 垂直推 → 水平推 → 2 个上肢孤立 → 1 个轻量水平拉 → 2 个核心。拉日：垂直拉 → 水平拉 → 垂直或水平拉 → 水平拉 → 2 个上肢孤立 → 抗旋转 → 负重行走。腿日：蹲 → 髋铰链 → 单腿 → 2 个下肢孤立 → 抗侧屈 → 屈体或旋转。
- **理由**：推/拉/腿 ×2 让每个肌群每周练 2 次；拉日比推日多一个拉类位置，推日末尾加轻量水平拉，保持推拉平衡。
- **证据等级**：C
- **来源**：E03:NSCA-Hoffman

**[week.day.aerobic]**
- **规则**：有氧日 = 3–5 分钟低强度热身 + 主有氧（中等强度，分钟数 = 本周剩余有氧目标 ÷ 剩余有氧日数，限制在 10–60 分钟）+ 2–5 分钟放松。动作取 `cardio_cyclic`，use 分别为 `warmup` / `conditioning` / `cooldown`。
- **理由**：把每周有氧目标平均分到有氧日；中等强度适合所有通过筛查的用户。
- **证据等级**：C
- **来源**：E01:WHO20；E01:PAG18

**[week.day.mobility]**
- **规则**：柔韧日 10–20 分钟，依次覆盖下肢、上肢、躯干，每个部位 ≥60 秒；老年用户加入 `balance` 模式的平衡练习。柔韧日不计入力量训练组数。
- **理由**：每周累计拉伸时间决定活动度收益，频率越高越好。
- **证据等级**：B
- **来源**：E03:Thomas-2018（待核实）；E03:Garber-2011（待核实）

**[week.day.yoga]**
- **规则**：瑜伽课按固定顺序：静心坐/站 → 热身 → 拜日式 → 站立体式 → 平衡 → 核心 → 手臂支撑（仅中级、≥60 分钟）→ 后弯 → 扭转 → 开髋 → 前屈 → 倒置（仅中级、≥45 分钟，孕期排除）→ 仰卧 → 摊尸式收尾。每个位置选一个通过安全筛选的体式，新手优先难度 ≤2；课时短时只保留前面和必选的位置，时间不够再依次加入后面的位置，然后在体式自身剂量范围内加长保持时间和组数，最后摊尸式不超过课时的 20%。每式之间休息 15 秒，每式由用户点一下开始。
- **安全**：老年用户每次课都含平衡位，开头不安排落地体式，所有落地体式集中在一段连续完成；孕期不加长保持时间，只加组数；19 个仅瑜伽体式只出现在瑜伽课里，不改变其他目标的动作池。
- **证据等级**：C（工程选择，体式顺序参照常见哈他/流瑜伽课序）
- **来源**：E03:Garber-2011（待核实）；E03:Thomas-2018（待核实）

## 3.4　整周检查

**[week.coverage.patterns]**
- **规则**：力量训练 ≥2 天/周时，按"实际排进课里的槽位"统计：膝主导（squat + lunge）≥2 次，髋主导（hinge）≥2 次，推（水平 + 垂直）≥2 次，拉（水平 + 垂直）≥2 次；squat、hinge、lunge、水平推、垂直推、水平拉、垂直拉各 ≥1 次；核心或负重行走 ≥1 次。不满足时，把缺少的模式放到下一个空闲的辅助位置。
- **理由**：每周覆盖全部基本动作模式，是本产品的结构性保证；从业者框架普遍以这些模式组织训练。
- **证据等级**：C
- **来源**：E03:Garber-2011（待核实）；E04:S25；E04:S21
- **例外/注意**：按日模板，只用前 4 个位置的 10 分钟课在 2 天方案下也能通过此检查。

**[week.frequency.per_muscle]**
- **规则**：每个肌群默认每周练 2 次，范围 1–4 次；只有每周 1 个力量日时允许 1 次。所需次数 = max（2，向上取整（每周目标组数 ÷ 单次每肌群上限））。所需次数超过力量天数时，把每周组数压到"力量天数 × 单次上限"。
- **理由**：总组数相同时，频率对增肌影响很小；频率的主要作用是分摊组数，避免单次过量。
- **证据等级**：B
- **来源**：E02:Schoenfeld2019；E02:Pelland2024（待核实）；E03:ACSM-2026；E02:Remmert2025（预印本）
- **例外/注意**：单次上限见第 5 章 `dose.sets_session.cap`。

**[week.recovery.spacing]**
- **规则**：同一肌群的重训练间隔 ≥48 小时；主项位置（main_1–3）的同一主要动作模式不在相邻两天出现。冲突时，后一天按 [week.recovery.light_day] 执行。
- **理由**：ACSM 建议同一肌群训练间隔至少 48 小时。
- **证据等级**：A
- **来源**：E03:Garber-2011（待核实）；E01:GARBER11

**[week.recovery.light_day]**
- **规则**：触发条件：某个主项动作模式与前一天重复。处理：该日每个动作少 1 组（至少 1 组），目标 RIR +1，不做递增到大重量的热身组。
- **理由**：用户只能连续几天训练时，用"一重一轻"安排降低恢复压力。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E03:Garber-2011（待核实）；E04:S8

**[week.schedule.user_days]**
- **规则**：在用户选定的星期中，先排力量日，使相邻力量日的最小间隔尽量大；间隔相同时取较早的星期；剩余选定日排有氧或柔韧日。高强度间歇每周 ≤2 次，不在相邻两天，不放在重下肢课前 24 小时内。同一天既有力量又有高强度有氧时，先力量后有氧；力量目标的用户在日程允许时，建议两者间隔 ≥3 小时。
- **理由**：先做力量训练，下肢动态力量提高约 7%；同一天间隔 ≥3 小时时，有氧对爆发力的削弱不再显著。
- **证据等级**：B
- **来源**：E03:Schumann-2022（待核实）；E03:Eddens-2018；E01:WHO20

**[week.missed_session]**
- **规则**：错过一次训练时，它的组数可以挪到本周剩余的训练里，但每次每肌群不超过单次上限，也要满足恢复间隔；不在同一天补两节课；放不下的组直接放弃。距上次训练 ≤7 天时按原计划继续；>7 天时进入第 7 章停训回退规则。
- **理由**：训练效果主要取决于每周总量，而不是具体哪一天练；单次超过约 10–11 组后收益很小。
- **证据等级**：B
- **来源**：E03:ACSM-2026；E02:Schoenfeld2019；E02:Remmert2025（预印本）

**[week.one_day.copy]**
- **规则**：力量训练只有 1 天/周时显示：
  - 中文：每周 1 次力量训练也有用。如果可以，再加一天，或者每天做 2 次 5 分钟的小练习、多走走路，效果会更好。
  - 英文：One strength session a week still helps. If you can, add a second day, or do two 5-minute exercise snacks a day and walk more.
- **理由**：每天 ≥2 次、每次 ≤5 分钟的运动小零食能改善不活跃人群的心肺适能，完成率超过 90%。
- **证据等级**：B
- **来源**：E03:Rodriguez-2026；E03:ACSM-2026

---

## 本章来源

- E01:WHO20 — Bull FC, et al. 2020. WHO 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462.
- E01:PAG18 — Piercy KL, et al. 2018. The Physical Activity Guidelines for Americans. *JAMA* 320(19):2020–2028.
- E01:GARBER11 — Garber CE, et al. 2011. ACSM Position Stand. *Med Sci Sports Exerc* 43(7):1334–1359.
- E02:Schoenfeld2019 — Schoenfeld BJ, Grgic J, Krieger J. 2019. How many times per week should a muscle be trained? *J Sports Sci* 37(11):1286–1295.
- E02:Pelland2024 — Pelland JC, et al. 2024 预印本；*Sports Med* 2026。（正式版 DOI 待核实）
- E02:Remmert2025 — Remmert JF, et al. 2025. Per-session volume meta-regressions. SportRxiv 预印本，未经同行评审。
- E02:Ratamess2009 — Ratamess NA, et al. 2009. ACSM progression models. *Med Sci Sports Exerc* 41(3):687–708.
- E03:ACSM-2026 — Currier BS, et al. 2026. ACSM Position Stand. *Med Sci Sports Exerc* 58(4):851–872.（卷期页码待核实）
- E03:Ramos-Campo-2024 — Ramos-Campo DJ, et al. 2024. Split versus full-body resistance training. *J Strength Cond Res*.
- E03:Garber-2011 — Garber CE, et al. 2011. ACSM Position Stand.（E03 经二手摘要打开，DOI 待核实）
- E03:NSCA-Hoffman — Hoffman J (ed.). *NSCA's Guide to Program Design*（节选）.
- E03:Iversen-2021 — Iversen VM, et al. 2021. No time to lift? *Sports Med* 51(10):2079–2095.
- E03:Rodriguez-2026 — Rodríguez MÁ, et al. 2026. Exercise snacks meta-analysis. *Br J Sports Med* 60(2):133–141.
- E03:Thomas-2018 — Thomas E, et al. 2018. *Int J Sports Med* 39(4):243–254.（作者待核实）
- E03:Schumann-2022 — Schumann M, et al. 2022. *Sports Med* 52:601–612.（合著者待核实）
- E03:Eddens-2018 — Eddens L, et al. 2018. Intra-session exercise sequence. *Sports Med* 48(1):177–188.
- E04:S8 — Helms E, et al. 2019/2025. *The Muscle and Strength Pyramid: Training*（节选）.
- E04:S21 — Saville W. 2016/2025. Basic movement patterns. Science for Sport.
- E04:S25 — Boyle M. Insights on functional athletic performance training（访谈）. SimpliFaster.


## v2 调整：规则分级与目标

以下调整取代本章对应项目的旧硬门槛表述，其余准入和动作安全排除保持原样。

- `week.recovery.spacing`：原48小时间隔为target；用户只选连续日期时允许，按实际间隔偏差扣分。
