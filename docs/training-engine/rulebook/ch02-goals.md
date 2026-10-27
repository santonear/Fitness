# 第 2 章　目标与训练变量映射

机器规则：`rules-ch02.yaml`（本章 16 条规则，id 一一对应）

本章把用户选择的训练目标翻译成引擎可直接使用的训练变量：每周力量训练次数、力量与有氧的时间比例、每肌群每周组数、次数区间、离力竭次数（Repetitions in Reserve，RIR）、每周有氧分钟数和柔韧训练安排。目标只决定"往哪个方向偏"；所有目标都先满足同一套最低标准（[goal.floor.all]）。

**术语**
- **分数组（fractional sets）**：直接练到的肌群记 1 组，协同参与的肌群记 0.5 组。换算规则见第 5 章 `dose.volume.fractional`。
- **中等强度当量分钟**：中等强度 1 分钟记 1 分钟，剧烈强度 1 分钟记 2 分钟。
- **时间份额**：该类训练分钟数占本周计划训练总分钟数的比例。
- **1RM（one-repetition maximum）**：只能完成 1 次的最大重量。

## 2.0　目标参数总表（速查）

| 目标（枚举） | 力量课/周 | 力量 : 有氧（时间份额） | 组数/肌群/周 | 次数 | RIR | 有氧（中等当量分钟/周） | 柔韧 |
|---|---|---|---|---|---|---|---|
| 先动起来 `start_moving` | 2（最少 1） | 约 50 : 50（各 40–60%，以步行为主） | 2–4 | 10–15 | 3–4 | 第 1 周 60–90 → 8 周内到 150 | 每次可选 5 分钟 |
| 健康 `health` | 2–3 | 约 50 : 50 | 6–10 | 8–15 | 2–3 | 150（进阶目标 300） | 每周 2–3 次 |
| 减脂 `fat_loss` | 2–4 | 40–50 : 50–60 | 8–12 | 8–15 | 1–3 | 150 起，8–12 周到 200–300 | 可选 |
| 增肌 `muscle` | 3–5（中级可选 6） | 80–90 : 10–20 | 10–20 | 6–15（可 5–30） | 0–3 | 计划内 10–20%；日常活动补足 150 | 可选 |
| 力量 `strength` | 3–4 | 80–90 : 10–20 | 6–12 | 主项 3–6（≥80% 1RM）；辅助 8–12 | 1–3 | 同增肌 | 可选 |
| 灵活性 `mobility` | 2（全幅度） | 力量 40–50 : 有氧 20–30 : 柔韧 30–40 | 4–8 | 8–15，慢离心 | 2–3 | 计划内 20–30% | 每周 5–7 天，每次 5–10 分钟 |

表中数字是本产品对证据的整合；具体出处见下面各条规则。表中 RIR 还要再经过水平修正（[goal.rir.level_override]）。

---

## 2.1　所有目标共用的底线

**[goal.floor.all]**
- **规则**：用户每周可训练 ≥2 天时，每周至少安排 2 次力量训练，每个主要肌群每周至少练 2 次，每个动作至少 2 组。以下三种情况豁免"每动作 ≥2 组"：10 分钟课、新手第 1 周、"先动起来"目标。
- **理由**：权威指南一致要求所有主要肌群每周练 ≥2 天；ACSM 2026 还把每动作 ≥2 组作为健康成人的底线。
- **证据等级**：A
- **来源**：E03:ACSM-2026；E01:WHO20；E01:PAG18
- **例外/注意**：用户每周只有 1 天时，不判为违规；按第 3 章单日模板执行，并提示补充日常活动。

**[goal.aerobic.baseline]**
- **规则**：每周有氧目标为 150 中等强度当量分钟，进阶目标 300 分钟；剧烈强度 1 分钟按 2 分钟计。任何时长的活动（≥1 分钟）都计入，不设"每次至少 10 分钟"。计入范围：计划内的体能槽位、单独有氧课、用户记录的快走。步数本身不自动算作中高强度分钟，只有"能说话、不能唱歌"的快走才计入。
- **理由**：WHO 2020 与美国 2018 指南给出相同的有氧目标；两份指南都已取消"每次至少 10 分钟"。
- **证据等级**：A
- **来源**：E01:WHO20；E01:PAG18；E03:WHO-2020
- **例外/注意**：超过 300 分钟不设上限，按第 7 章恢复规则管理。

## 2.2　各目标的参数

**[goal.params.start_moving]**　先动起来
- **规则**：每周 2 次力量训练（只有 1 天时为 1 次）；力量和有氧各占 40–60% 的时间，有氧以步行为主；第 1 周有氧 60–90 分钟，8 周内逐步加到 150 分钟。力量部分每肌群每周 2–4 组，每动作 1–2 组，10–15 次，轻到中等负荷，RIR 3–4。每次课可选 5 分钟柔韧练习。强度上限为中等（自觉强度 ≤6/10）。
- **理由**：从不训练到开始训练，相对收益最大，很小的剂量就能带来力量和功能的提高；起点低可以提高坚持率。
- **证据等级**：C（工程选择，待教练审核；方向有 A 级支持）
- **来源**：E03:ACSM-2026；E03:Garber-2011（待核实）；E01:WHO20；E03:Momma-2022（待核实）
- **例外/注意**：每肌群 2–4 组低于第 5 章新手下限 4 组，这是有意设计；用户连续 4 周完成计划后，提示升级为"健康"目标。

**[goal.params.health]**　健康
- **规则**：每周 2–3 次力量训练；力量和有氧时间约各占一半（各 45–55%），有氧朝每周 150 分钟推进，进阶目标 300 分钟。每肌群每周 6–10 组，8–15 次，RIR 2–3；每周 2–3 次柔韧练习。
- **理由**：同时满足指南的力量底线和有氧目标；8–15 次的中等次数便于新手学习技术。
- **证据等级**：C（工程选择；底线部分为 A）
- **来源**：E03:ACSM-2026；E01:WHO20；E03:Garber-2011（待核实）

**[goal.params.fat_loss]**　减脂
- **规则**：每周 2–4 次力量训练（默认 3 次），不得生成纯有氧计划；有氧占 50–60% 的时间，从每周 150 分钟起，8–12 周内加到 200–300 分钟。每肌群每周 8–12 组，8–15 次，RIR 1–3。计划生成时必须附带饮食提示。
- **理由**：单靠运动减重有限；有氧量决定能量消耗，力量训练保护瘦体重并减少内脏脂肪；每周超过 250 分钟才有临床意义的减重。
- **证据等级**：C（工程选择；组成部分有 A/B 级证据）
- **来源**：E03:Bellicha-2021；E03:Wewege-2022（待核实）；E03:Lopez-2022；E03:Donnelly-2009；E01:DONN09；E01:JAYEDI24
- **例外/注意**：高强度间歇（HIIT）只能作为可选替代，需先通过安全筛查与高强度解锁门槛（见安全与有氧相关章节）。

**[goal.params.muscle]**　增肌
- **规则**：每周 3–5 次力量训练（默认 4 次；中级用户可主动选择 6 次）；有氧占 10–20% 的时间。每肌群每周 10–20 组；6–15 次（5–30 次也可）；RIR 0–3，其中 RIR 0 只用于孤立动作或器械动作的最后一组。
- **理由**：增肌主要取决于每周组数，≥10 组/肌群/周是 ACSM 2026 的锚点，18–20 组附近收益递减；接近力竭时负荷高低影响不大。
- **证据等级**：C（工程选择；≥10 组为 A，剂量—反应为 B）
- **来源**：E03:ACSM-2026；E02:Currier2026；E02:Pelland2024（待核实）；E02:Baz-Valle2022
- **例外/注意**：新手的实际组数还受第 5 章新手上限（12 组）和第 7 章前 4 周上限约束。

**[goal.params.strength]**　力量
- **规则**：每周 3–4 次力量训练；有氧占 10–20%。每次课 1–2 个主项：每个主项 2–3 个正式组，3–6 次，约 80–90% 1RM，RIR 1–3；辅助动作 8–12 次，RIR 1–3。每肌群每周 6–12 组。同一主项每周正式组超过 5 组后，多出的组数改给辅助或其他肌群。
- **理由**：力量提升依赖较大负荷（≥80% 1RM），每动作 2–3 组后收益趋平；力量的周组数收益比增肌更早进入平台。
- **证据等级**：A
- **来源**：E03:ACSM-2026；E02:Currier2026；E02:Lopez2021；E02:Pelland2024（待核实）
- **例外/注意**：新手先走 [goal.strength.beginner_rep_gate]。

**[goal.strength.beginner_rep_gate]**
- **规则**：力量目标的新手在训练满 12 周前，主项次数为 8–12 次；满 12 周后才开放 3–6 次的大重量组；任何时候次数不低于 3 次。
- **理由**：新手应先用 8–15 次学习技术；证据给出 8–12 周后再引入 ≤6 次的组，取保守端 12 周。
- **证据等级**：C
- **来源**：E02:Currier2026；E02:Ratamess2009

**[goal.params.mobility]**　灵活性
- **规则**：每周 5–7 天各做一次 5–10 分钟的柔韧练习，每个目标部位每次 ≥60 秒、每周 ≥5 分钟；另外每周 2 次全幅度力量训练（每肌群每周 4–8 组，8–15 次，离心约 3 秒，RIR 2–3）。时间份额约为力量 40–50%、有氧 20–30%、柔韧 30–40%。
- **已确认的节奏实现**：仅本目标 main/accessory 中按次数的力量动作采用离心约 3 秒、向心约 1 秒、无额外停顿；估时每次取 `max(4, time.s_per_rep)`，保留目录更慢的原值。不适用于有氧、等长或拉伸，不因时间缺口调速；并非 `slow_eccentric: 5` 缺省。
- **理由**：关节活动度的提高主要取决于每周累计拉伸时间和频率；全幅度力量训练改善活动度的效果与拉伸相近。
- **证据等级**：B
- **来源**：E03:Garber-2011（待核实）；E03:Thomas-2018（待核实）；E03:Afonso-2021（待核实）
- **例外/注意**：柔韧练习可以单独成课（10–20 分钟），放在休息日，不计入力量训练组数。

**[goal.params.yoga]**　瑜伽（Bo 2026-10-26 定为独立目标）
- **规则**：每周 1–2 天全是瑜伽课；3–4 天其中 1 天是全身力量课；5–6 天其中 2 天是力量课；其余都是瑜伽课。力量课每肌群每周 2–6 组，8–15 次，RIR 2–3。这些参数只用于排课，不单独计分；瑜伽计划不提示“有几个部位本周练得偏少”。
- **理由**：瑜伽本身以柔韧、平衡和体重支撑力量为主；每周 3 天以上时保留少量全身力量训练，满足成人每周 2 次力量训练建议的方向。
- **证据等级**：C
- **来源**：E03:Garber-2011（待核实）；E03:Thomas-2018（待核实）；E03:ACSM-2026
- **例外/注意**：瑜伽课的体式按 `week.day.yoga` 的固定顺序编排，不参与力量课的补位、裁剪和换动作。

## 2.3　跨目标修正

**[goal.rir.level_override]**
- **规则**：目标给出的 RIR 再按水平和动作修正，取更保守者：新手 RIR ≥2；中级 RIR ≥0；带 `heavy_axial_load` 标记的动作 RIR ≥1（永不做到力竭）；老年人 RIR ≥2。
- **理由**：力竭不是必需的，力竭训练疲劳更大；ACSM 2026 指出力竭对老年人等人群可能不合适。
- **证据等级**：C
- **来源**：E02:Currier2026；E02:Grgic2022；E02:Refalo2024
- **例外/注意**：例：增肌目标的新手，目标 RIR 0–3 修正为 2–3。

**[goal.interference.guard]**
- **规则**：力量或增肌目标下，高强度有氧每周 ≤3 次、≤90 分钟；优先骑车、划船、步行，而不是大量跑步；高强度间歇不安排在重下肢课前 24 小时内。中等强度有氧不削减。
- **理由**：最新荟萃分析显示同期有氧不降低最大力量和肌肉增长，只削弱爆发力；较早的分析显示跑步和高频长时有氧的干扰更大，因此只设温和上限。
- **证据等级**：C
- **来源**：E03:Schumann-2022（待核实）；E03:Wilson-2012

**[goal.aerobic.daily_life_credit]**
- **规则**：力量、增肌、灵活性目标的计划内有氧仍按本目标份额安排；同时显示每周 150 分钟追踪条，用日常快走等活动补足。
- **理由**：健康指南的有氧目标适用于所有成人；不用为了凑分钟数挤占力量训练时间。
- **证据等级**：C（工程选择）
- **来源**：E01:WHO20；E01:PAG18

**[goal.select.single_primary]**
- **规则**：用户只能选 1 个主目标，最多 1 个次目标。主目标决定本章全部参数；次目标只做两种微调：有氧份额最多移动 10 个百分点，或放松环节最多加 5 分钟柔韧。用户无法决定时，按"先动起来 → 健康 → 减脂 → 增肌 → 力量 → 灵活性"的顺序取第一个符合的。
- **理由**：普通人群的首要因素是坚持；参数来源单一，引擎行为才可预测、可审核。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E03:ACSM-2026；E04:S8

## 2.4　目标相关文案

**[goal.fat_loss.copy_spot_reduction]**
- **规则**：减脂计划生成时显示下列文案；全应用不得出现"练腹减肚子""瘦大腿"之类的局部减脂说法。
  - 中文：脂肪从哪里减掉没法自己挑。核心训练让你更有力量；整体活动量和饮食才决定减脂。
  - 英文：You can't choose where fat comes off. Core work builds strength; overall activity and nutrition reduce fat.
- **理由**：局部减脂没有可靠证据。
- **证据等级**：B
- **来源**：E01:RC21；E01:JAYEDI24

**[goal.fat_loss.copy_expectation]**
- **规则**：减脂计划生成时显示预期文案，用平均值表述，不承诺个人结果。
  - 中文：平均来看，每周多 30 分钟有氧，体重约多降 0.5 公斤；配合饮食调整效果更明显。
  - 英文：On average, each extra 30 min/week of aerobic exercise adds about 0.5 kg of weight loss, more alongside your nutrition.
- **理由**：剂量—反应荟萃分析显示，每周多 30 分钟有氧约多减 0.5 kg。
- **证据等级**：B
- **来源**：E01:JAYEDI24；E03:Bellicha-2021

**[goal.start_moving.copy_intro]**
- **规则**："先动起来"计划生成时显示：
  - 中文：每一分钟都算数。从你现在能做到的开始，我们一点点往上加。
  - 英文：Every minute counts. Start where you are, and we'll build up a little at a time.
- **理由**：三份权威指南都明确"有一点好过没有"，不活跃的人应从小量开始逐步增加。
- **证据等级**：A
- **来源**：E01:WHO20；E01:PAG18

---

## 本章来源

- E01:WHO20 — Bull FC, et al. 2020. WHO 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462.
- E01:PAG18 — Piercy KL, et al. 2018. The Physical Activity Guidelines for Americans. *JAMA* 320(19):2020–2028；US DHHS 2018, 2nd ed.
- E01:DONN09 — Donnelly JE, et al. 2009. ACSM Position Stand: weight loss and prevention of weight regain. *Med Sci Sports Exerc* 41(2):459–471.
- E01:JAYEDI24 — Jayedi A, et al. 2024. Aerobic exercise and weight loss in adults: dose-response meta-analysis. *JAMA Netw Open* 7(12):e2452185.
- E01:RC21 — Ramirez-Campillo R, et al. 2021/2022. Exercise-induced localized fat reduction (spot reduction). *Human Movement* 23(3):1–14.
- E02:Currier2026 / E03:ACSM-2026 — Currier BS, et al. 2026. ACSM Position Stand: Resistance Training Prescription… *Med Sci Sports Exerc* 58(4):851–872.（卷期页码在不同来源间不一致，待核实）
- E02:Pelland2024 — Pelland JC, et al. 2024 预印本；*Sports Med* 2026;56(2):481–505。（正式版 DOI 待核实）
- E02:Baz-Valle2022 — Baz-Valle E, et al. 2022. *J Hum Kinet* 81:199–210.
- E02:Lopez2021 — Lopez P, et al. 2021. Resistance training load effects… network meta-analysis. *Med Sci Sports Exerc* 53(6):1206–1216.
- E02:Grgic2022 — Grgic J, et al. 2022. Failure vs non-failure training. *J Sport Health Sci*.
- E02:Refalo2024 — Refalo MC, et al. 2024. Failure vs RIR in trained individuals. *J Sports Sci* 42(1):85–101.
- E02:Ratamess2009 — Ratamess NA, et al. 2009. ACSM Position Stand: Progression models in resistance training. *Med Sci Sports Exerc* 41(3):687–708.
- E03:WHO-2020 — 同 E01:WHO20。
- E03:Garber-2011 — Garber CE, et al. 2011. ACSM Position Stand: quantity and quality of exercise. *Med Sci Sports Exerc* 43(7):1334–1359.（E03 经二手摘要打开，DOI 待核实）
- E03:Momma-2022 — Momma H, et al. 2022. Muscle-strengthening activities and mortality. *Br J Sports Med* 56(13):755–763.（DOI 待核实）
- E03:Bellicha-2021 — Bellicha A, et al. 2021. *Obes Rev* 22(S4):e13256.
- E03:Wewege-2022 — Wewege MA, et al. 2022. *Sports Med* 52(2):287–300.（DOI 待核实）
- E03:Lopez-2022 — Lopez P, et al. 2022. *Obes Rev* 23(5):e13428.
- E03:Donnelly-2009 — 同 E01:DONN09。
- E03:Thomas-2018 — Thomas E, et al. 2018. Stretching typology and duration. *Int J Sports Med* 39(4):243–254.（作者待核实）
- E03:Afonso-2021 — Afonso J, et al. 2021. Strength training versus stretching for ROM. *Healthcare* 9(4):427.（作者与 DOI 待核实）
- E03:Schumann-2022 — Schumann M, et al. 2022. Concurrent training updated meta-analysis. *Sports Med* 52:601–612.（合著者待核实）
- E03:Wilson-2012 — Wilson JM, et al. 2012. Concurrent training meta-analysis. *J Strength Cond Res* 26(8):2293–2307.
- E04:S8 — Helms E, Morgan A, Valdez A. 2019/2025. *The Muscle and Strength Pyramid: Training*（节选）.


## v2 调整：规则分级与目标

以下调整取代本章对应项目的旧硬门槛表述，其余准入和动作安全排除保持原样。

- `goal.params.start_moving`：每个已定义时间类别的目标区间为30%–70%，按权重计分，不作为失败或空计划原因。
- `goal.params.health`：每个已定义时间类别的目标区间为30%–70%，按权重计分，不作为失败或空计划原因。
- `goal.params.fat_loss`：每个已定义时间类别的目标区间为30%–70%，按权重计分，不作为失败或空计划原因。
- `goal.params.muscle`：每个已定义时间类别的目标区间为30%–70%，按权重计分，不作为失败或空计划原因。
- `goal.params.strength`：每个已定义时间类别的目标区间为30%–70%，按权重计分，不作为失败或空计划原因。
- `goal.params.mobility`：每个已定义时间类别的目标区间为30%–70%，按权重计分，不作为失败或空计划原因。
- `goal.floor.all`：每周1天或单次≤20分钟时，每肌群每周≥2次按目标计分，不判失败；此项分级为target。
