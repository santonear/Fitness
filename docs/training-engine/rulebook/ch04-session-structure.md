# 第 4 章　单次训练结构与时间分配

机器规则：`rules-ch04.yaml`（本章 20 条规则，id 一一对应）

本章把"今天练什么"（第 3 章日模板）变成"今天按什么顺序、各花几分钟、每个槽位放什么动作"。每个时长档位都有一份**槽位清单**：每个槽位写明所属环节、要求的动作 use 标签、动作模式来源和时间预算。动作模式写 `from_pos` 的，表示从当日日模板的对应位置取；下表以"全身 A"（fb_a）为例写出实际模式。

**环节顺序**：热身（一般 → 动态 → 热身组）→ 爆发（如有）→ 主项 → 辅助 → 核心/负重行走 → 体能 → 放松。

## 4.1　时长与时间模型

**[session.durations.allowed]**
- **规则**：单次时长档位为 10、20、30、45、60、90 分钟；用户给出的可用时间向下取最近档位。90 分钟档只对中级用户开放，新手自动改为 60 分钟。
- **理由**：每次约 15 分钟的高频短课也是有效选择；90 分钟以上每肌群的额外组数收益很小，只适合有经验的用户。
- **证据等级**：C
- **来源**：E02:Iversen2021；E03:Iversen-2021

**[session.time.model]**
- **规则**：每组用时（秒）= 次数 × 每次秒数 + 10。每次秒数默认 3.5（自重和器械 3.0，大重量杠铃 4.0，慢离心 5.0）；单侧动作（`per_side: true`）时间 ×2；计时动作用时 = 秒数（单侧 ×2）+ 10。换动作用时：哑铃/器械 60 秒，杠铃 120 秒，超级组内 15 秒。组间休息取第 5 章 `dose.rest.table`。用户记录满 3 次训练后，用其实际组时、休息和换动作时间的中位数替换默认值。
- **理由**：动作节奏对效果影响很小，研究常用约 4 秒/次；换动作时间没有系统数据，只能先给默认值再按个人校准。
- **证据等级**：C（工程选择）
- **来源**：E02:Paz2017（待核实）；E02:Schoenfeld2015；E02:Currier2026

**[session.order.blocks]**
- **规则**：环节固定顺序：warmup → power → main → accessory → core → conditioning → cooldown。爆发环节只对中级用户、且不在新手前 4 周开放。同一次课里有氧体能放在力量训练之后。
- **理由**：先做的动作力量提高更多；先力量后有氧，下肢动态力量约高 7%，对增肌和心肺没有影响。
- **证据等级**：B
- **来源**：E03:Eddens-2018；E03:Nunes-2021（待核实）；E03:NSCA-Hoffman

## 4.2　各时长的槽位清单

### 10 分钟　[session.template.min10]

| 槽位 | 环节 | use | 动作模式（全身 A 示例） | 结构与剂量 | 时间 |
|---|---|---|---|---|---|
| WU1 | 热身 | warmup | mobility | 动态活动 | 30–45 秒 |
| WU2 | 热身 | warmup | 同 C1 第一个动作 | 自重或轻重量 1 组 | 15–30 秒 |
| C1 | 主项 | main / accessory | squat → push_horizontal → hinge → pull_horizontal（main_1、main_2、acc_1、main_3） | 循环；新手 2 轮，中级 2–3 轮；每轮后休 60 秒 | 8 分钟 |
| CD1 | 放松 | cooldown | mobility | 可选 | 0–60 秒 |

- **规则**：如上表；正式组 6–8 组，3–4 个动作；不做一般热身。时间超出时，从循环中删去 acc_1。
- **理由**：极短课的重点是覆盖下肢、推、拉三类多关节动作；配合每周多次，也能接近最低有效剂量。
- **证据等级**：C（工程选择；E02 给出 5–7 组、E03 给出 2 组超级组 2–3 轮，取二者之间的 6–8 组，待教练审核）
- **来源**：E03:Iversen-2021；E02:Iversen2021；E03:Rodriguez-2026

### 20 分钟　[session.template.min20]

| 槽位 | 环节 | use | 动作模式（全身 A 示例） | 结构与剂量 | 时间 |
|---|---|---|---|---|---|
| WU1 | 热身 | warmup | mobility | 动态活动 | 60–90 秒 |
| WU2 | 热身 | warmup | 同 SS1 第一个动作 | 热身组 1 组 | 60–90 秒 |
| SS1 | 主项 | main | squat + push_horizontal（main_1 + main_2） | 超级组；新手 2–3 轮，中级 3 轮 | 7 分钟 |
| SS2 | 主项 | main / accessory | hinge + pull_horizontal（acc_1 + main_3） | 超级组；同上 | 7 分钟 |
| K1 | 核心 | accessory | anti_extension（core_1） | 1–2 组 | 2 分钟 |
| CD1 | 放松 | cooldown | mobility | 静态拉伸 | 45–60 秒 |

- **规则**：如上表；正式组 9–14 组，5 个动作。
- **理由**：两组上下肢交替的超级组在同样时间内能完成更多组；全身 A/B 每周 2–3 次可达到新手的每周组数下限。
- **证据等级**：C
- **来源**：E03:Iversen-2021；E02:Zhang2025（待核实）；E02:Paz2017（待核实）

### 30 分钟　[session.template.min30]（新手默认）

| 槽位 | 环节 | use | 动作模式（全身 A 示例） | 结构与剂量 | 时间 |
|---|---|---|---|---|---|
| WU1 | 热身 | warmup | cardio_cyclic（RPE 3–4） | 一般热身 | 1–2 分钟 |
| WU2 | 热身 | warmup | mobility | 动态活动 | 1–1.5 分钟 |
| WU3 | 热身 | warmup | 同 M1 | 热身组 2 组 | 1.5–2 分钟 |
| M1 | 主项 | main | squat（main_1） | 常规组；新手 2–3 组，中级 3 组 | 7 分钟 |
| SS1 | 主项 | main | push_horizontal + pull_horizontal（main_2 + main_3） | 超级组 2–3 轮 | 9 分钟 |
| SS2 | 辅助 | accessory / main | hinge + anti_extension（acc_1 + core_1） | 超级组 2–3 轮 | 7 分钟 |
| CD1 | 放松 | cooldown | mobility | 静态拉伸 | 2 分钟 |

- **规则**：如上表；正式组 12–16 组，5–6 个动作。**减脂目标**：SS2 换成 6–8 分钟体能间歇（`cardio_cyclic` / `carry` / `locomotion_ground`，use = conditioning）；被换掉的位置由第 3 章 [week.coverage.patterns] 重新检查，缺的模式放到下一次课。
- **理由**：一个主项用常规组保证技术和负荷，推拉配对省时；30 分钟是新手最容易坚持的时长。
- **证据等级**：C
- **来源**：E03:Iversen-2021；E02:Iversen2021；E03:Ribeiro-2021

### 45 分钟　[session.template.min45]（中级默认）

| 槽位 | 环节 | use | 动作模式（全身 A 示例） | 结构与剂量 | 时间 |
|---|---|---|---|---|---|
| WU1 | 热身 | warmup | cardio_cyclic（RPE 3–4） | 一般热身 | 1.5–3 分钟 |
| WU2 | 热身 | warmup | mobility | 动态活动 | 1–1.5 分钟 |
| WU3 | 热身 | warmup | 同 M1 | 热身组 2 组 | 1.5–2 分钟 |
| M1 | 主项 | main | squat（main_1） | 常规组；新手 2–3 组，中级 3–4 组 | 7 分钟 |
| M2 | 主项 | main | push_horizontal（main_2） | 常规组 + 0–1 个热身组 | 7 分钟 |
| SS1 | 主项 | main / accessory | pull_horizontal + hinge（main_3 + acc_1） | 超级组 2–3 轮 | 9 分钟 |
| SS2 | 辅助 | accessory | pull_vertical + anti_extension（acc_2 + core_1） | 超级组 2–3 轮 | 6 分钟 |
| X1 | 辅助 | accessory | isolation_lower + isolation_upper（acc_3 + acc_4） | 超级组 2–3 轮 | 8 分钟 |
| CD1 | 放松 | cooldown | mobility | 静态拉伸 | 3 分钟 |

- **规则**：如上表；正式组 16–22 组，6–8 个动作。X1 按目标替换：减脂 → 8 分钟间歇体能；健康、先动起来 → 8 分钟中等强度持续有氧（`cardio_cyclic`）；灵活性 → 8 分钟额外放松拉伸；增肌、力量 → 保留辅助对。
- **理由**：两个主项用常规组，其余配对；最后 8 分钟按目标分配，让同一模板满足不同目标的时间份额（第 2 章）。
- **证据等级**：C
- **来源**：E03:Iversen-2021；E02:Iversen2021；E03:Ribeiro-2021

### 60 分钟　[session.template.min60]

| 槽位 | 环节 | use | 动作模式（全身 A 示例） | 结构与剂量 | 时间 |
|---|---|---|---|---|---|
| WU1 | 热身 | warmup | cardio_cyclic（RPE 3–4） | 一般热身 | 2–3 分钟 |
| WU2 | 热身 | warmup | mobility | 动态活动 | 1.5–2 分钟 |
| WU3 | 热身 | warmup | 同 M1 | 热身组 2 组 | 2–2.5 分钟 |
| M1 | 主项 | main | squat（main_1） | 常规组 3–4 组 | 10 分钟 |
| M2 | 主项 | main | push_horizontal（main_2） | 常规组 3–4 组 + 0–1 个热身组 | 10 分钟 |
| SS1 | 主项 | main / accessory | pull_horizontal + hinge（main_3 + acc_1） | 超级组 3 轮 | 10 分钟 |
| SS2 | 辅助 | accessory | pull_vertical + isolation_lower（acc_2 + acc_3） | 超级组 2–3 轮 | 6 分钟 |
| SS3 | 核心 | accessory | isolation_upper + anti_extension（acc_4 + core_1） | 超级组 2–3 轮 | 6 分钟 |
| X1 | 核心 | accessory / conditioning | anti_lateral_flexion + carry（core_2 + carry_1） | 超级组 2–3 轮 | 8 分钟 |
| CD1 | 放松 | cooldown | mobility | 静态拉伸 | 4 分钟 |

- **规则**：如上表；正式组 20–26 组，7–9 个动作。目标变体：减脂/健康/先动起来 → X1 换成 8 分钟体能；灵活性 → 删 X1，放松延长到 10 分钟，M1 缩到 8 分钟；力量 → 主项组间休息 120–180 秒，M1、M2 各延长到 12 分钟，删去 SS3，X1 改为 core_1 + carry_1。
- **理由**：力量目标需要更长的主项休息；灵活性目标的静态拉伸放在力量训练之后。
- **证据等级**：C
- **来源**：E03:Iversen-2021；E02:Iversen2021；E02:Grgic2018-rest

### 90 分钟　[session.template.min90]（仅中级）

| 槽位 | 环节 | use | 动作模式（全身 A 示例） | 结构与剂量 | 时间 |
|---|---|---|---|---|---|
| WU1–WU3 | 热身 | warmup | cardio_cyclic → mobility → 同 M1 | 一般 3–4 分钟、动态 2–2.5 分钟、热身组 2 组 | 7.5–9.5 分钟 |
| M1 | 主项 | main | squat（main_1） | 常规组 3–4 组 | 10 分钟 |
| M2 | 主项 | main | push_horizontal（main_2） | 常规组 3–4 组 | 10 分钟 |
| M3 | 主项 | main | pull_horizontal（main_3） | 常规组 3–4 组 | 10 分钟 |
| SS1 | 辅助 | accessory / main | hinge + pull_vertical（acc_1 + acc_2） | 超级组 3 轮 | 8 分钟 |
| SS2 | 辅助 | accessory | isolation_lower + isolation_upper（acc_3 + acc_4） | 超级组 3 轮 | 8 分钟 |
| SS3 | 核心 | accessory | anti_extension + anti_lateral_flexion（core_1 + core_2） | 超级组 2–3 轮 | 5 分钟 |
| K1 | 核心 | conditioning / accessory | carry（carry_1） | 2–3 组 | 4 分钟 |
| CN1 | 体能 | conditioning | cardio_cyclic | 持续或间歇 | 15–20 分钟 |
| CD1 | 放松 | cooldown | mobility | 静态拉伸 | 5–8 分钟 |

- **规则**：如上表；正式组 28–34 组，9–11 个动作。任何肌群超过单次上限（第 5 章 `dose.sets_session.cap`）时，把多出的组数时间改给 CN1 或 CD1；正式组 >30 时提示收益递减。
- **理由**：单次每肌群约 11 个分数组以上，增肌收益不再可测；多出的时间用于有氧或柔韧更有价值。
- **证据等级**：C
- **来源**：E03:Iversen-2021；E02:Remmert2025（预印本）；E02:Iversen2021

## 4.3　热身

**[session.warmup.general]**
- **规则**：只在单次 ≥30 分钟或用户报告环境寒冷时做一般热身：`cardio_cyclic`、use = warmup、RPE 3–4、不含跳跃动作；时长 30 分钟课 1–2 分钟，45 分钟 1.5–3 分钟，60 分钟 2–3 分钟，90 分钟 3–4 分钟；10、20 分钟课不做。
- **理由**：热身总体上改善表现，但力量训练前额外加一般热身的证据不一致；共识认为短热身 ≤5 分钟即可。
- **证据等级**：C
- **来源**：E03:Fradkin-2010（待核实）；E03:McGowan-2015；E03:Boullosa-2026；E02:Iversen2021

**[session.warmup.dynamic]**
- **规则**：选 1–3 个 `mobility` 模式、use 含 `warmup` 的动态动作，共 30–90 秒；优先选与当天主项、辅助动作的身体部位或主要肌肉重合的动作。
- **理由**：动态拉伸平均使随后的表现提高约 1.3%，静态拉伸则会降低表现。
- **证据等级**：B
- **来源**：E03:Behm-2016；E03:Boullosa-2026

**[session.warmup.ramp_sets]**
- **规则**：第一个负重多关节动作做 2 个热身组（约正式重量 50% × 8 次、75% × 3 次）；之后的多关节动作 0–1 个（约 60% × 5 次）；自重主项做 1 组（阶梯降一级，或同一动作做目标次数的一半）；孤立动作不做。热身组不计入正式组。
- **理由**：专项热身组（包括较重的组）对最大力量和次数表现帮助最大；为节省时间，热身以专项热身组为主。
- **证据等级**：B（第二个及以后动作用 60% 是工程选择，待教练审核）
- **来源**：E03:Ribeiro-2021；E03:Iversen-2021

**[session.warmup.balance_older]**
- **规则**：老年用户单次 ≥20 分钟时，热身加 60–120 秒 `balance` 模式练习（use = warmup），计入当周平衡训练天数。
- **理由**：指南建议老年人每周 ≥3 天多成分活动（含平衡）预防跌倒，平衡练习可以并入力量课。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E01:WHO20；E01:GARBER11
- **例外/注意**：平衡练习的选择与安全限制以老年人模块为准。

**[session.warmup.no_long_static]**
- **规则**：练前不做长时间静态拉伸：每块肌肉的静态保持 <60 秒；允许 ≤30 秒的短时保持，但之后必须接动态动作。热身槽位只能放 use 含 `warmup` 的动作；长时间静态拉伸和柔韧专项放到放松环节或柔韧日。
- **理由**：练前静态拉伸平均使表现下降约 3.7%；每肌群 ≥60 秒时下降约 4.6%，短于 60 秒约 1.1%；之后接动态活动可以抵消大部分下降。
- **证据等级**：B
- **来源**：E03:Behm-2016

## 4.4　超级组与循环

**[session.superset.when]**
- **规则**：默认结构：10 分钟课用循环；20 分钟课全部用超级组；30 分钟课 M1 用常规组，其余超级组；45、60 分钟课 M1–M2 用常规组，其余超级组；90 分钟课 M1–M3 用常规组，辅助用超级组。循环（3–4 个互不干扰的动作）只用于 ≤20 分钟课或体能环节。力量目标的主项一律用常规组。用户选择"不要超级组"时全部改常规组（时间不够按 [session.fit.algorithm] 处理）。同一肌群的超级组只作为中级用户的收尾。
- **理由**：超级组让单次训练时间更短，总负荷量不变，长期力量和增肌与常规组相同；省时方法可能更适合增肌，而不是最大力量。
- **证据等级**：B
- **来源**：E02:Zhang2025（待核实）；E02:Paz2017（待核实）；E02:Iversen2021；E02:Krzysztofik2019（待核实）

**[session.superset.pairing]**
- **规则**：允许的配对：下肢 + 上肢；推 + 拉；任一力量动作 + 核心；上肢孤立 + 下肢孤立。以下情况禁止配对：两个都带 `grip_intensive`；两个的 `joint_load.back` 都 ≥2；主要动作模式相同；属于同一阶梯；两个的准备时间都 ≥60 秒（如两个杠铃动作）；力量目标下任一带 `heavy_axial_load` 或 `valsalva_prone`；两个都需要 `space: large` 但位置不同。配对不成立时：先把第二个动作换成下一个能成对的未用位置（优先 core_1、core_2）；仍不行就改为两个常规组。
- **理由**：对抗肌配对能做更多次数，同一肌群配对会降低总负荷量；从业者实践是避免两个抓握负荷大或两个脊柱负荷大的动作连做。
- **证据等级**：C
- **来源**：E03:NSCA-Hoffman；E02:Zhang2025（待核实）；E02:Iversen2021

**[session.superset.rest]**
- **规则**：超级组内两个动作之间换动作 15 秒，做完一对后休息 60–90 秒，使每个肌群实际休息约 2–3 分钟；循环每轮之间休息 60 秒，轮内换动作 15 秒。
- **理由**：这样安排能保持每块肌肉的有效休息，同时把总时长减半。
- **证据等级**：B
- **来源**：E02:Zhang2025（待核实）；E02:Paz2017（待核实）；E02:Singer2024

## 4.5　体能与放松

**[session.conditioning.slot]**
- **规则**：体能槽位只放 use 含 `conditioning` 的动作，模式优先级 `cardio_cyclic` → `carry` → `locomotion_ground`；`jump_land` 只对中级用户且未被其他规则排除时可用。持续有氧：RPE 5–6/10，"能说话、不能唱歌"；间歇：每段 20–60 秒，休息 ≥ 运动时间，RPE 7–8。减脂默认间歇，其他目标默认持续。高强度间歇必须先通过解锁门槛。体能分钟计入每周有氧目标。
- **理由**：指南按自觉强度和谈话测试界定中等和剧烈强度；不习惯的剧烈运动是运动相关心脏事件的主要风险情境。
- **证据等级**：C
- **来源**：E01:WHO20；E01:PAG18；E01:FRANK20

**[session.cooldown.stretch]**
- **规则**：放松环节为当天练过的每个主要肌群安排 1 个静态拉伸，默认 2 组 × 30 秒（老年人每次保持 30–60 秒），每肌群累计约 60 秒；时间不够时，先拉 M1–M3 用到的肌群。灵活性目标的放松环节 8–10 分钟。
- **理由**：ACSM 建议每次拉伸保持 10–30 秒（老年人 30–60 秒），每肌群累计约 60 秒。
- **证据等级**：A
- **来源**：E03:Garber-2011（待核实）；E01:GARBER11

## 4.6　装不下时怎么办

**[session.fit.algorithm]**
- **规则**：
  1. 从总时长中扣除热身和放松时间；
  2. 先按时间模型放入主项槽位（M*）；
  3. 按模板顺序填入超级组和辅助槽位，直到时间用完；
  4. 预计超时 >2 分钟时，先减最后一个辅助槽位的轮数，再删除该槽位；
  5. 每周目标组数仍不够时，依次：用户同意则每周加一次课 → 常规组改为配对 → 孤立动作组间休息缩到 60 秒 → 接受较低的组数，只要每肌群每周 ≥4 组（"先动起来"目标不受此下限约束）。
- **理由**：先保证多关节主项，再用省时方法补足；每肌群每周约 4 组是可接受的最低有效剂量。
- **证据等级**：C
- **来源**：E02:Iversen2021；E02:Currier2026

---

## 本章来源

- E01:WHO20 — Bull FC, et al. 2020. WHO 2020 guidelines. *Br J Sports Med* 54(24):1451–1462.
- E01:PAG18 — Piercy KL, et al. 2018. Physical Activity Guidelines for Americans. *JAMA* 320(19):2020–2028.
- E01:GARBER11 — Garber CE, et al. 2011. ACSM Position Stand. *Med Sci Sports Exerc* 43(7):1334–1359.
- E01:FRANK20 — Franklin BA, et al. 2020. AHA scientific statement on exercise-related acute cardiovascular events（见 E01 Topic 2）.
- E02:Currier2026 — Currier BS, et al. 2026. ACSM Position Stand. *Med Sci Sports Exerc* 58(4):851–872.
- E02:Iversen2021 / E03:Iversen-2021 — Iversen VM, et al. 2021. No time to lift? *Sports Med* 51(10):2079–2095.
- E02:Paz2017 — Paz GA, et al. 2017. Agonist-antagonist paired-set vs traditional-set training. *J Strength Cond Res*.（年份与卷期待核实）
- E02:Schoenfeld2015 — Schoenfeld BJ, et al. 2015. Repetition duration and hypertrophy. *Sports Med* 45(4):577–585.
- E02:Zhang2025 — Zhang X, et al. 2025. Superset vs traditional prescriptions. *Sports Med*.（作者待核实）
- E02:Krzysztofik2019 — Krzysztofik M, et al. 2019. Advanced resistance training techniques. *IJERPH* 16(24):4897.（作者待核实）
- E02:Singer2024 — Singer A, et al. 2024. Inter-set rest and hypertrophy, Bayesian meta-analysis. *Front Sports Act Living* 6:1429789.
- E02:Grgic2018-rest — Grgic J, et al. 2018. Rest interval duration and strength. *Sports Med* 48(1):137–151.
- E02:Remmert2025 — Remmert JF, et al. 2025. Per-session volume. SportRxiv 预印本，未经同行评审。
- E03:Eddens-2018 — Eddens L, et al. 2018. *Sports Med* 48(1):177–188.
- E03:Nunes-2021 — Nunes JP, et al. 2021. Exercise order. *Eur J Sport Sci* 21(2):149–157.（作者待核实）
- E03:NSCA-Hoffman — Hoffman J (ed.). *NSCA's Guide to Program Design*（节选）.
- E03:Fradkin-2010 — Fradkin AJ, et al. 2010. Warm-up meta-analysis. *J Strength Cond Res* 24(1):140–148.（作者待核实）
- E03:McGowan-2015 — McGowan CJ, et al. 2015. Warm-up strategies. *Sports Med* 45(11):1523–1546.
- E03:Ribeiro-2021 — Ribeiro B, et al. 2021. Warm-up in resistance training. *Motricidade* 17(1):87–94.
- E03:Boullosa-2026 — Boullosa D, et al. 2026. Warm-up Delphi consensus. *Int J Sports Physiol Perform*.
- E03:Behm-2016 — Behm DG, et al. 2016. Acute effects of muscle stretching. *Appl Physiol Nutr Metab* 41(1):1–11.
- E03:Garber-2011 — 同 E01:GARBER11（E03 经二手摘要打开，DOI 待核实）。
- E03:Rodriguez-2026 — Rodríguez MÁ, et al. 2026. Exercise snacks. *Br J Sports Med* 60(2):133–141.


## v2 调整：规则分级与目标

以下调整取代本章对应项目的旧硬门槛表述，其余准入和动作安全排除保持原样。

- `session.cooldown.stretch`：20分钟以内免除放松拉伸；其他课放不下时以1个30–60秒拉伸替代；此项为target。
