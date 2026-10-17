# 第 7 章　进阶、减量与新手/停训恢复

机器规则：`rules-ch07.yaml`（本章 37 条规则，id 一一对应）

本章决定"什么时候加、加多少、什么时候减、停了多久要退回多少"。原则只有三条：**先加次数、后加重量；先学动作、再加负荷；宁可起点低，也不让一次训练过量。**

本章所有"加"的规则都受上层规则约束（第 0 章 `meta.conflict.precedence`）：安全门槛（第 1 章）、人群模块（第 10–12 章）、关节注意与疼痛规则（第 9 章）先于本章；本章各项上限又先于时长拟合（第 13 章）。同一层级冲突时取更保守者。

本章与其他章节的分工：

| 内容 | 定义位置 | 本章怎么用 |
|---|---|---|
| 次数区间、RIR 目标、每周组数上下限 | 第 5 章 `dose.*`、第 2 章 `goal.params.*` | 进阶的起点和天花板 |
| 首次选重量 | 第 5 章 `dose.load.initial_selection` | 直接引用 |
| 等长动作加秒数 | 第 5 章 `dose.isometric` | 直接引用 |
| 本周内错过一次课如何挪组 | 第 3 章 `week.missed_session` | 直接引用；本章只补进阶状态 |
| 有关节注意时的进阶 | 第 9 章 `caution.progression` | 直接引用 |
| 老年人进阶与停训阈值 | 第 10 章 `older.strength.progression`、`older.return_after_break` | 直接引用 |
| 不活跃用户的强度起点 | 第 1 章 `safety.unlock.vigorous`、第 8 章 `aerobic.progression.ramp` | 直接引用 |

**本章速查**

| 项目 | 默认值 |
|---|---|
| 加重条件 | 所有正式组在目标 RIR 下做到 rep_max，连续 2 次课（新手第 5 周起、RIR ≥2 时 1 次课） |
| 加重幅度 | 下肢复合 +5%（≥2.5 kg）；上肢复合 +2.5%（≥1 kg）；孤立 +2% 或最小档；单步 ≤10% |
| 停滞 | 同一负荷连续 2 次课低于 rep_min → −10% 重新爬升 |
| RIR 自动调节 | 比目标高 ≥2：+5%；高 1：+2.5%；低 1：−2.5%；低 ≥2：−10% |
| 阶梯升级 / 降级 | 连续 2 次课 ≥3 组 × rep_max 且 RIR ≥1 → +1 级；首组 <5 次或"太难" → −1 级 |
| 每周容量递增 | 新手 +1、中级 +1～2 组/肌群/周，至目标上限 |
| 反应式减量 | 过去 10 天 4 项疲劳信号中 ≥2 项 |
| 减量处方 | 1 周；组数 −50%（轻 −30%，重 −70%），负荷不变，RIR ≥3 |
| 新手前 4 周 | 第 1 周 2 次课、每动作 1–2 组、RIR ≥3、难度 ≤2；第 4 周前每肌群 ≤10 组 |
| 停训回归 | ≤4 周：90% 负荷；4–12 周：80% 负荷、60% 容量、3 周恢复；>12 周：60% 负荷、50% 容量、4–8 周恢复 |

## 7.1　进阶模型与双重进阶

**[progression.model.default]**
- **规则**：所有可加重的动作默认用"双重进阶"（double progression）：在次数区间内先加次数，做到区间上限后再加重量；自重动作先加次数，再沿难度阶梯（ladder）升级；等长动作先加秒数（第 5 章 `dose.isometric`），再升阶梯。一般用户不需要正式的周期化（periodization）；力量目标的次数区间直接按第 2 章 `goal.params.strength` 执行，本章不另设训练块。
- **理由**：对一般健康成人，逐步增加负荷是最主要的变量；复杂周期化只带来很小的额外力量收益，对增肌基本无额外好处，对新手无差别。
- **证据等级**：A
- **来源**：E04:S1；E04:S2；E04:S8；E04:S4（待核实）

**[progression.double.trigger]**
- **规则**：每个可加重动作有次数区间 rep_min–rep_max（取自第 5 章 `dose.reps.by_class` 或第 2 章目标参数）和目标 RIR（第 5 章 `dose.rir.targets`）。当**所有正式组**都做到 rep_max，且记录的 RIR 不低于目标 RIR 下限，并且**连续 2 次课**做到时，下次课加重。新手（第 5 章 `dose.level.definition`）从第 5 周起，若该次课所有正式组记录的 RIR ≥2，可放宽为 1 次课达标即加重。加重后下次课目标次数回到 rep_min。
- **理由**：先把次数做满再加重，保证每次加重都建立在稳定完成的基础上；"连续 2 次"能过滤偶然状态好的一天；新手进步快，可以更早加重。
- **证据等级**：A（"连续 2 次课"规则）；RIR 门槛与新手 1 次课快速通道为 C
- **来源**：E04:S3；E02:Ratamess2009；E04:S8
- **例外/注意**：ACSM 2009 原文的触发条件是"比目标多做 1–2 次、连续 2 次课"，该立场声明已被 2026 版取代（作历史依据）；本引擎改用"做到 rep_max 且 RIR 达标"，这是从业者通用写法。新手第 1–4 周另受 `progression.new.load_step` 约束。

**[progression.load.increment]**
- **规则**：每次加重的幅度：下肢复合动作（primary_pattern 为 squat / lunge / hinge / carry，且 nsca_class = compound）+5%，至少 +2.5 kg；上肢复合动作（push_* / pull_*，compound）+2.5%，至少 +1 kg；孤立动作（nsca_class = isolation）及负重核心动作 +2%，或器材最小档。计算出的新重量向下取到用户实际可用的重量。单步加重不超过 10%。若用户可用的最小一档超过 10%（常见于固定哑铃或轻重量）：仍取这一档，但下次课次数回到 rep_min，且该次课目标 RIR 上调 1；若这次首组达不到 rep_min，退回原重量，该动作改走 `progression.fixed_load.order`。
- **理由**：大肌群多关节动作能承受较大跳档，小肌群和孤立动作宜小步；ACSM 给出的加重区间是 2–10%；档位过大时，用"回到区间下限重新爬"来抵消跳档。
- **证据等级**：A（2–10% 区间与 10% 上限）；各类具体百分比、最小公斤数和大跳档处理为 C
- **来源**：E04:S3；E02:Ratamess2009；E04:S8
- **例外/注意**：证据库中上肢复合动作有 +2.5% 与 +2.5–5%、最小增量有 1 kg 与 1–2.5 kg 几种写法，取最保守的 +2.5% / +1 kg（工程选择，待教练审核）。老年人每步不超过 5%（第 10 章 `older.strength.progression`）。

**[progression.fixed_load.order]**
- **规则**：无法加重时（自重动作、只有一个重量、或大跳档失败后），按以下顺序进阶：① 加次数，每组最多 30 次（第 5 章 `dose.reps.bounds`）→ ② 下放（离心）放慢到 3 秒（第 5 章 `dose.tempo`）→ ③ 同一阶梯升 1 级（`ladder.step.up`）；动作不在任何阶梯中时，换同一 primary_pattern、难度高 1 级的动作（按第 6 章选择流程）。
- **理由**：家用器材档位有限；次数、节奏和动作难度都能继续提供进阶刺激。超过 30 次后 RIR 判断变差、耗时变长。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E02:Iversen2021；E02:Currier2026；E04:S8

**[progression.stall.reset]**
- **规则**：同一负荷下连续 2 次课，正式组次数低于 rep_min：下次课负荷 −10%，次数目标回到 rep_min，重新爬升。自重阶梯动作的停滞按 `ladder.step.down` 处理。同一周内 ≥3 个不同动作触发本规则，计为反应式减量的"表现下降"信号（`deload.trigger.reactive` 第 (a) 项）。
- **理由**：减负后重新积累是从业者打破停滞的常用做法；多个动作同时停滞更像整体疲劳，而不是单个动作的问题。
- **证据等级**：C
- **来源**：E04:S8
- **例外/注意**：证据库给出 5–10%，取 10%（降得更多，更保守；工程选择）。

**[progression.change.priority]**
- **规则**：每个动作每次课结束后最多做**一个**负荷或阶梯调整，按以下顺序取第一个命中的规则：① 疼痛（`progression.feedback.pain`、第 9 章 `pain.rule`）→ ② 用户反馈"太难 / 太简单"（`progression.feedback.*`）→ ③ 停滞（`progression.stall.reset` / `ladder.step.down`）→ ④ RIR 自动调节（`progression.autoreg.rir`）→ ⑤ 双重进阶或阶梯升级。减量周、停训回归恢复期内不做 ⑤，但 ①–④ 的下调照常执行。所有调整都不得突破新手、人群和关节注意的上限。
- **理由**：多条规则同时命中时，必须有确定的唯一结果；把"往下调"的规则放在前面，避免同一天既加又减，也避免两次下调叠加。
- **证据等级**：C（工程选择）
- **来源**：本手册撰写规范（内部）；E04:S8

## 7.2　按离力竭次数（RIR）自动调节

**[progression.autoreg.input]**
- **规则**：自动调节使用每个动作**最后一个正式组**记录的 RIR。用户没记录 RIR 时按以下方式推断：做到 rep_max 并点了"轻松"→ RIR = 目标上限 + 2；按计划完成、没有反馈 → RIR = 目标值（视为无偏差）；做不满计划次数 → RIR 0。新手前 4 周，记录的 RIR 与目标只差 1 时视为无偏差（只对差 ≥2 的情况调整）。
- **理由**：越接近力竭、次数 ≤12 时 RIR 估计越准，所以取最后一组；人们平均会把剩余次数估少约 1 次、个体误差约 1.5 次，新手早期的 ±1 偏差多半是估计误差。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E04:S5；E02:Halperin2021；E02:Helms2016

**[progression.autoreg.rir]**
- **规则**：偏差 = 记录 RIR 与目标 RIR 区间的差（高于区间上限为正，低于下限为负，落在区间内为 0）。下次课负荷：偏差 ≥+2 → +5%；+1 → +2.5%；−1 → −2.5%；≤−2 → −10%。同一次课的组间只做下调：某一组偏差 ≤−2 时，下一组 −10%。所有上调仍受 `progression.load.increment` 的 10% 上限和最小档位约束，向下取到可用重量。与双重进阶同时命中时，只执行优先级更高的一条（`progression.change.priority`）。
- **理由**：基于 RIR 的自动调节至少与固定负荷一样有效，RIR 版本可能略有优势；用小步调整控制估计误差。
- **证据等级**：C（方向有 B 级证据支持；具体百分比为工程选择）
- **来源**：E04:S5；E04:S6（待核实）；E02:Zourdos2016；E02:Helms2016
- **例外/注意**：证据库对"低 ≥2"给出 −5% 至 −10%，取 −10%（更保守）。

## 7.3　难度阶梯

阶梯 id 与《动作标注标准》一致：`push_h`、`push_v`、`squat`、`lunge`、`hinge`、`pull_v`、`pull_h`、`core_ae`、`core_lat`。只在同一阶梯内比较 step。

**[ladder.step.up]**
- **规则**：在同一阶梯内，连续 2 次课都完成 ≥3 组 × rep_max（rep_max 取当前处方，如第 5 章自重阶梯 15 次、单侧自重 12 次）且最后一组 RIR ≥1，下次课 step +1。处方组数少于 3 组时（如新手第 1–2 周），要求所有正式组都做到 rep_max。每次只升 1 级；新动作的 difficulty 最多比当前高 1 级，且必须在第 6 章难度窗口和新手难度上限内；新一级从 rep_min 开始。
- **理由**：一项俯卧撑阶梯试验按"连续两次达标再升级"进阶，4 周卧推力量增长与渐进卧推相近；俯卧撑各变式的地面反作用力从约 41% 到 74% 体重递增，支持"墙→上斜→跪姿→标准→脚抬高"的顺序。
- **证据等级**：C（单项试验与实验室研究）
- **来源**：E04:S9（待核实）；E04:S26；E04:S27（待核实）；E04:S8
- **例外/注意**：证据库默认 3×12（自重）、3×8（单侧），仅在动作没有处方次数区间时使用。有关节注意的用户还需满足第 9 章 `caution.progression`。

**[ladder.step.missing]**
- **规则**：step +1 在动作库中不存在、或被设备 / 关节注意 / 人群规则过滤掉时，可跳到更高的下一个可用 step，前提是 difficulty 最多比当前高 1 级；否则停在当前 step，继续按 `progression.fixed_load.order` 用次数和节奏进阶。
- **理由**：动作库中的阶梯并不完整；跳级不能变成难度骤增。
- **证据等级**：C（工程选择）
- **来源**：E04:S8；E04:S20

**[ladder.step.down]**
- **规则**：出现以下任一情况，下次课 step −1：第一个正式组做不到 5 次；连续 2 次课正式组次数低于 rep_min；用户反馈"太难"（`progression.feedback.too_hard`）；疼痛规则要求换动作（第 9 章 `pain.rule`）。已在阶梯最低一级时，改为组数 −1、次数目标取 rep_min。
- **理由**：做不满最低次数说明当前难度超出能力；降一级能保住训练量和动作质量。
- **证据等级**：C
- **来源**：E04:S8；E04:S9（待核实）
- **例外/注意**："首组 <5 次"来自证据库默认 rep_min 5；与第 5 章自重下限 6 次不同，6 次以下但 ≥5 次时按停滞处理（需连续 2 次课）。

**[ladder.gate.barbell]**
- **规则**：带 `heavy_axial_load` 的杠铃动作，只有在同一阶梯中、难度更低的支撑版或高脚杯 / 哑铃版（如高脚杯深蹲、哑铃罗马尼亚硬拉）以目标次数完成 2 次课后才解锁；use = skill 或 difficulty = 5 的动作只对主动开启"进阶"的用户开放（第 5 章 `dose.level.definition`）。
- **理由**：先用支撑或退阶版本建立稳定的动作模式，再加复杂度和负荷。
- **证据等级**：C
- **来源**：E04:S8；E04:S19；E04:S20

## 7.4　每周容量递增

**[volume.week.increase]**
- **规则**：新手前 4 周之后（新手前 4 周按 `progression.new.weekly_sets`），每周结束时检查每个肌群：本周计划训练全部完成、没有任何疲劳信号（`deload.checkin.inputs`）、下次课前酸痛已消退时，下周该肌群组数增加：新手 +1；中级在表现提高（至少一个动作加了次数或重量、没有动作退步）时 +2，表现持平时 +1。条件不满足时保持不变。上限取第 5 章目标上限（`dose.sets_week.goal_matrix`）与水平上限中较低者，自动编排永不超过 20 组。减量结束后，组数回到目标起始值重新递增。
- **理由**：组数与增肌呈收益递减关系；约 10 组/周已足够一般健身；超过 20 组对普通用户意义很小，疲劳成本却上升。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E02:Currier2026；E02:Pelland2024（待核实）；E04:S13；E04:S8；E04:S28（待核实）

## 7.5　减量（deload）

减量是计划内或按需安排的一段降低训练负担的时期，用来消除身体和心理疲劳。本引擎以**按需（反应式）减量**为主，计划减量只"提供"、可跳过。

**[deload.checkin.inputs]**
- **规则**：每次训练开始前做 4 个快速问答（可跳过），记录 10 天：① 精力 / 训练意愿 1–5 分；② 自上次训练以来有几晚没睡好（整数）；③ 上次训练的肌肉酸痛是否已消退（是 / 否）；④ 有没有新出现或加重的关节疼痛（是 / 否）。跳过的问题不计为信号。训练中记录的疼痛（`progression.feedback.pain`）和表现数据自动计入。
- **理由**：从业者的反应式减量清单就是"怕练、睡差、表现停滞、疼痛增加"几项是 / 否问题；问答必须短，才不影响坚持。
- **证据等级**：C
- **来源**：E04:S8；E04:S10

**[deload.copy.checkin]**
- **规则**：训练前问答文案：
  - 中文：①今天的精力和训练意愿怎么样？（1 很差 – 5 很好）②上次训练后，有几晚没睡好？③上次训练的肌肉酸痛消了吗？④有没有新出现或变得更重的关节疼痛？
  - 英文：1) How are your energy and motivation today? (1 very low – 5 very high) 2) Since your last workout, how many nights did you sleep badly? 3) Has the muscle soreness from your last workout gone? 4) Do you have any new or worse joint pain?
- **理由**：用日常语言收集减量信号，不使用医学术语。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E04:S8

**[deload.trigger.reactive]**
- **规则**：过去 10 天内出现以下 4 项中 ≥2 项，即触发减量：(a) 表现下降：≥2 个不同动作在相同负荷下比上次课少做 ≥1 次，或没能完成计划负荷；或同一周 ≥3 个动作触发停滞（`progression.stall.reset`）；(b) 精力 / 训练意愿 ≤2 分，出现 ≥2 次；(c) 没睡好累计 ≥3 晚；(d) 新出现或加重的关节疼痛（问答 ④ 为"是"，或训练中疼痛 ≥4/10，或疼痛逐周加重）。第 (d) 项同时按第 9 章疼痛规则处理。出现 ≥3 项时用重度减量。
- **理由**：多项疲劳信号同时出现时最需要减量，单一信号可能只是偶然。
- **证据等级**：C
- **来源**：E04:S8；E04:S10；E04:S11（待核实）
- **例外/注意**：证据库窗口为 7–10 天，取 10 天（更容易触发，更保守；工程选择）。新手前 3 个月触发后按 `deload.new_user.easy_days` 处理。

**[deload.trigger.scheduled]**
- **规则**：自上次减量（或开始训练、或停训回归恢复期结束）起，累计 6 个训练周后提供 1 周减量；任一肌群每周组数 >16 的高容量计划，累计 4 个训练周后提供。"训练周"指至少完成 1 次力量训练的自然周。过去 10 天没有任何疲劳信号时用户可以跳过，跳过后 2 周再提供一次。新手前 3 个月（前 12 个训练周）不提供计划减量。
- **理由**：对一般健身人群，减量更适合按需使用；4–8 周一次只是惯例，没有证据确定最佳频率。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E04:S10；E04:S11（待核实）；E04:S13
- **例外/注意**：证据库对高容量计划给出 4–5 周，取 4 周；">16 组"即中级默认区间（10–16）的上沿，"跳过后 2 周再提供"均为工程选择。

**[deload.dose.prescription]**
- **规则**：减量持续 1 周（7 天），只作用于抗阻训练。默认中度：保留原有动作和训练频率，每个动作组数 −50%（向下取整，至少 1 组），负荷和阶梯 step 不变，所有组 RIR ≥3。轻度（计划减量且疲劳信号 ≤1 项）组数 −30%；重度（信号 ≥3 项）组数 −70%。用户可改选"组数不变、负荷 −10%、RIR ≥3"。减量周内 HIIT 改为同时长的中等强度有氧。减量结束后从上次成功的负荷继续（不重置），双重进阶的"连续达标"计数清零；每周组数回到目标起始值（`volume.week.increase`）。力量和增肌目标默认不安排整周完全停训。
- **理由**：减量的共识是减少训练量、保留主要多关节动作并练技术；一次性下调而不是逐步递减。一项试验中，完全停训一周没有改变增肌，但下肢力量略差。
- **证据等级**：C
- **来源**：E04:S10；E04:S11（待核实）；E04:S12
- **例外/注意**："HIIT 改为中等强度"和"计数清零"为工程选择，待教练审核。

**[deload.new_user.easy_days]**
- **规则**：新手前 3 个月触发反应式减量时，不安排整周减量：在下一次训练前额外加 1 个休息日（总计不超过 3 天不练力量），下一次训练按中度减量剂量（组数 −50%、RIR ≥3）进行，之后恢复原计划。
- **理由**：训练 0–3 个月的新手很少需要正式减量，1–3 天轻松或休息即可。
- **证据等级**：C
- **来源**：E04:S11（待核实）；E04:S8
- **例外/注意**："加 1 天、只减 1 次课"是在证据 1–3 天范围内的工程选择。

## 7.6　新手与久坐用户：前 4 周

本节适用于训练经历分类为 `new` 的用户（`progression.return.classify`）。久坐、不活跃的新手还要同时满足：强度从中等开始、满 8 个规律周才解锁高强度（第 1 章 `safety.unlock.vigorous`）；有氧量按第 8 章 `aerobic.progression.ramp` 递增；平衡差、使用助行器或不活跃的老年人按第 10 章 `older.strength.low_start` 起步。

**[progression.new.week_caps]**
- **规则**：`new` 用户各周上限：

| 训练周 | 力量课次数 | 每动作组数 | 每次课动作数 | RIR | 动作难度 |
|---|---|---|---|---|---|
| 第 1 周 | 2 | 1–2 | 4–6 | ≥3，不做到力竭 | ≤2 |
| 第 2 周 | 2–3 | 2 | — | ≥3 | ≤2 |
| 第 3–4 周 | ≤3 | 2–3 | — | 2–3 | ≤3 |

  第 2 周排 3 次课的条件：第 1 周 2 次课都完成、没有触发 `progression.doms.referral`、用户可训练天数 ≥3；否则 2 次。训练周从第一次完成的课开始，每 7 天为一周。全程下放 ≤3 秒（第 5 章 `dose.tempo`）。第 5 章 `dose.rir.calibration` 的"做一次到技术力竭"只在第 3–4 周执行。
- **理由**：首次训练量过大、离心过重是新手出现严重肌肉损伤的已知诱因；起点低几乎没有代价；第 3–4 周达到 ACSM 新手常规剂量（每周 2–3 次全身训练）。
- **证据等级**：C（证据库没有确定前 4 周保守程度的荟萃分析，此表为保守综合）
- **来源**：E04:S3；E02:Ratamess2009；E04:S15
- **例外/注意**："第 2 周排 3 次课的条件"和"RIR 校准只放在第 3–4 周"为工程选择，后者比第 5 章更严格，按"同层取更严"执行。

**[progression.new.weekly_sets]**
- **规则**：`new` 用户每肌群每周分数组上限：第 1 周 = min(目标起始值, 6)；之后每周最多 +2 组，且不超过目标上限；第 4 周前（含）不超过 10 组。第 5 周起按 `volume.week.increase` 继续。
- **理由**：约 4 个分数组/周即可产生效果；前 4 周限制总量，避免早期过量。
- **证据等级**：C
- **来源**：E04:S14（待核实）；E02:Pelland2024（待核实）；E02:Iversen2021

**[progression.new.exclusions]**
- **规则**：`new` 用户第 1–4 周排除：modality = plyometric 的动作；flags 含 `jumping`、`valsalva_prone`、`heavy_axial_load` 的动作；use = skill 的动作。
- **理由**：技术优先；新手先学稳定的基础动作。
- **证据等级**：C
- **来源**：E04:S3；E04:S8；E04:S19
- **例外/注意**：证据库只要求排除难度 >2 的增强式（跳跃）动作，这里全部排除，更保守（工程选择）。

**[progression.new.load_step]**
- **规则**：`new` 用户第 1–4 周每次课都可以进阶，但只能每组 +1–2 次，或在所有正式组做到 rep_max 时加器材最小一档（不按百分比）；RIR 自动调节只执行下调。次数区间按第 5 章 `dose.reps.by_class`；≤6 次的组在训练满 12 周后才开放（第 5 章 `dose.reps.bounds`）。
- **理由**：新手进步快，但技术还不稳定，每次只做最小的增加。
- **证据等级**：C
- **来源**：E04:S8；E04:S3
- **例外/注意**："每组 +1–2 次"为工程选择，待教练审核。

**[progression.doms.copy]**
- **规则**：`new` 用户和停训回归（mid / long）用户在第 1–2 周，训练后显示：
  - 中文：训练后一两天肌肉酸痛很常见，通常几天内会减轻。轻松走走、正常活动往往有帮助。
  - 英文：Muscle soreness a day or two after training is common and usually eases within a few days. Light walking and normal activity often help.
- **理由**：普通的延迟性肌肉酸痛（DOMS）不应吓退新手；提前说明能提高坚持率。
- **证据等级**：C
- **来源**：E04:S15

**[progression.doms.referral]**
- **规则**：用户报告以下任一情况：肌肉严重肿胀；尿色明显变深（像浓茶或可乐）；酸痛剧烈并伴明显无力——立即暂停训练计划，显示下方文案，并锁定训练，直到用户确认已就诊。【上线前需专业审核】
  - 中文：如果肌肉肿得厉害、尿色变得很深（像浓茶或可乐），或者酸痛剧烈、明显没力气，请先停止训练，今天就去医院看看。确认看过医生后再回来继续。
  - 英文：If your muscles are badly swollen, your urine turns very dark (like strong tea or cola), or the soreness is severe with clear weakness, stop training and see a doctor today. Come back once you have been checked.
- **理由**：新手首次高容量或离心过重的训练可能导致严重肌肉损伤，虽然罕见，但需要当天就医；应用不判断原因，只提示求助。
- **证据等级**：C（临床病例报告）
- **来源**：E04:S15

## 7.7　停训后回归

**[progression.return.classify]**
- **规则**：按"距上次完成力量训练的天数"和既往训练史分类：`new`（从未训练，或停训前连续规律训练 <3 个月，或说不出既往负荷）；`trained`（≤7 天，按原计划继续）；`returning_short`（8 天至 4 周）；`returning_mid`（>4 至 12 周）；`returning_long`（>12 周）。年龄 ≥65 岁按第 10 章 `older.return_after_break` 把阈值减半。急病暂停（第 1 章 `safety.screen.temporary_illness`）期间的天数也计入停训天数。水平（新手 / 中级）沿用第 5 章 `dose.level.definition`，停训期不计入训练月数。
- **理由**：年轻成人的最大力量在停训约 4 周内基本保留，之后下降加快；力量耐力下降更早；老年人下降更明显。
- **证据等级**：C（4 周阈值有 B 级荟萃分析支持；12 周阈值和 7 天分界为工程选择）
- **来源**：E04:S16（待核实）；E04:S17（待核实）；E04:S18（待核实）

**[progression.return.short]**
- **规则**：`returning_short`：第 1 周按停训前最后一次正式负荷的 90%、容量（每周组数）100%；第 2 周恢复原负荷。
- **理由**：短期停训后最大力量基本保留，只需短暂过渡。
- **证据等级**：C
- **来源**：E04:S16（待核实）；E04:S17（待核实）

**[progression.return.mid]**
- **规则**：`returning_mid`：第 1 周按 80% 负荷、60% 容量，在 3 周内线性恢复到 100%（第 1/2/3 周：负荷 80/90/100%，容量 60/80/100%）。
- **理由**：中期停训后力量与耐力开始下降，但重新训练恢复较快——一项试验中每次停训 3 周后的损失约 3 周内练回。
- **证据等级**：C
- **来源**：E04:S16（待核实）；E04:S18（待核实）；E04:S17（待核实）
- **例外/注意**：证据库给出容量 60–70%、恢复期 2–3 周，均取保守端（工程选择）。

**[progression.return.long]**
- **规则**：`returning_long`：第 1 周按 60% 负荷、50% 容量；恢复期周数 N = 停训周数 × 0.5，向上取整，限制在 4–8 周；第 k 周的比例 = 起点 + (100 − 起点) × (k − 1)/(N − 1)，第 N 周到 100%。
- **理由**：从业者综合认为，重新练回所需时间约为停训时间的 ⅓–⅔（约一半）；设上下限避免过快或拖得过长。
- **证据等级**：C
- **来源**：E04:S17（待核实）；E04:S18（待核实）；E04:S16（待核实）
- **例外/注意**：证据库给出负荷 60–70%，取 60%（工程选择）。

**[progression.return.bodyweight]**
- **规则**：自重阶梯动作和无法按百分比减重的动作，回归第 1 周：`returning_short` 保持原 step，次数目标取 rep_min；`returning_mid` 和 `returning_long` 降 1 级，次数目标取 rep_min；之后按正常阶梯规则升级，但恢复期内最高只能回到停训前的 step。所有回归用户的第一次课 RIR ≥3。恢复期的负荷和容量比例是上限：自动调节和双重进阶可以下调，不能超过当周比例；比例向下取到可用重量。
- **理由**：自重动作没有"80% 负荷"，用降一级来对应负荷回退；回归首周最容易因"找回状态"而过量。
- **证据等级**：C（工程选择，待教练审核；证据库只给出可加重动作的百分比）
- **来源**：E04:S17（待核实）；E04:S8

**[progression.return.first_session_cap]**
- **规则**：任何回归用户的第一次课，每个动作的负荷和组数都必须低于停训前的最好记录；自重阶梯动作的 step 不高于既往最佳，处于同一 step 时次数必须低于既往最佳。
- **理由**：证据库明确要求首次回归不得达到或超过既往最佳。
- **证据等级**：C
- **来源**：E04:S8；E04:S17（待核实）

**[progression.return.new_user_phase]**
- **规则**：`new` 用户在前 4 周内中断 >7 天：中断 8–28 天时，从最后一个完整完成的训练周的上限重新开始；中断 >28 天时，从第 1 周重新开始。
- **理由**：新手还没有可回退的"既往负荷"，重复已完成的那一周最简单、最保守。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E04:S16（待核实）；E04:S3

## 7.8　错过训练

本周内错过一次课的挪组规则见第 3 章 `week.missed_session`：组数可挪到本周剩余训练（每次每肌群不超过第 5 章单次上限、满足恢复间隔），不在同一天补两节课，放不下就放弃；距上次训练 >7 天时进入 `progression.return.classify`。

**[progression.missed.state]**
- **规则**：错过的课不算"未达标"，也不算停滞：双重进阶、阶梯升级和停滞的"连续 2 次课"计数在 ≤7 天的中断中保留，只看实际完成的课。距上次训练 ≤7 天时按原负荷继续。因急病暂停后恢复（第 1 章 `safety.screen.temporary_illness`），即使中断 ≤7 天，第一次课也按轻松日处理（第 3 章 `week.recovery.light_day`：每动作组数 −1、RIR +1）。
- **理由**：一周内少练一次对结果影响很小，训练效果主要取决于每周总量；病后第一课保守一点几乎没有代价。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E02:Schoenfeld2019；E02:Currier2026；E04:S16（待核实）

## 7.9　用户反馈覆盖默认值

动作难度因人而异（肢体长度、体重、活动度都会影响），所以用户的"太简单 / 太难 / 疼"反馈可以覆盖默认的起始 step 和负荷，但**不能**突破安全、人群、关节注意和新手上限。

**[progression.copy.feedback]**
- **规则**：每个动作结束后提供三个可选按钮，另在课后提供一个整节课反馈：
  - 中文：太简单 ｜ 太难 ｜ 疼痛；整节课："今天整体太累了"
  - 英文：Too easy | Too hard | Pain; whole session: "Today was too tiring overall"
- **理由**：一键反馈比要求用户估计 RIR 更容易坚持，也弥补未记录 RIR 的情况。
- **证据等级**：C（工程选择）
- **来源**：E04:S8

**[progression.feedback.too_easy]**
- **规则**：用户点"太简单"：可加重动作视为 RIR 偏差 +2，下次课 +5%（受 10% 上限和最小档位约束）；自重阶梯动作下次课 step +1（须满足 `ladder.step.missing` 的难度跳幅、第 6 章难度窗口和新手上限）。每个动作每次课最多调整一次。新手第 1–4 周只允许最小一档或 +1 级，且不超过当周难度上限；停训恢复期内不得超过当周比例上限。
- **理由**：默认起点按典型用户设定，个人差异由反馈修正；每次只动一小步。
- **证据等级**：C
- **来源**：E04:S8；E04:S9（待核实）

**[progression.feedback.too_hard]**
- **规则**：用户点"太难"：可加重动作下次课 −10%；自重阶梯动作下次课 step −1（已在最低一级时组数 −1）；次数目标取 rep_min。点"今天整体太累了"：下一次课按轻松日处理（第 3 章 `week.recovery.light_day`），并记为一次精力 ≤2 分（计入 `deload.trigger.reactive` 第 (b) 项）。
- **理由**：做不动时降一步比硬撑更能保住动作质量和坚持率。
- **证据等级**：C
- **来源**：E04:S8；E04:S11（待核实）

**[progression.feedback.pain]**
- **规则**：用户点"疼痛"：先问"是关节疼痛，还是肌肉酸痛？"。肌肉酸痛 → 显示 `progression.doms.copy`，并检查 `progression.doms.referral`。关节疼痛 → 问 0–10 分（第 9 章 `pain.prompt` 的量表），按第 9 章 `pain.rule` 处理（未开启关节注意的用户 ≥4 分时提供开启）；≥4 分计入减量信号 (d)。之后该动作（或替换后的动作）不加重、不升阶梯，直到连续 2 次课疼痛 ≤3 分（与第 9 章 `caution.progression` 相同）。出现胸痛、晕厥等警示症状时，第 1 章停止规则优先。
- **理由**：不在疼痛中进阶；应用不判断疼痛原因，只做保守调整、替换和提示求助。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E04:S8；E04:S10

---

## 本章来源

- E02:Currier2026 — Currier BS, et al. 2026. ACSM Position Stand: Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews. *Med Sci Sports Exerc* 58(4):851–872.
- E02:Ratamess2009 — Ratamess NA, et al. 2009. ACSM Position Stand: Progression models in resistance training for healthy adults. *Med Sci Sports Exerc* 41(3):687–708.（已被 2026 版取代，作历史依据）
- E02:Pelland2024 — Pelland JC, et al. 2024 预印本，SportRxiv；*Sports Med* 2026;56(2):481–505。（正式版 DOI 待核实）
- E02:Iversen2021 — Iversen VM, et al. 2021. No time to lift? *Sports Med* 51(10):2079–2095.
- E02:Halperin2021 — Halperin I, et al. 2022. Accuracy in predicting repetitions to task failure. *Sports Med* 52:377–390.
- E02:Helms2016 — Helms ER, et al. 2016. Application of the RIR-based RPE scale. *Strength Cond J* 38(4):42–49.
- E02:Zourdos2016 — Zourdos MC, et al. 2016. RIR-based RPE scale. *J Strength Cond Res* 30(1):267–275.
- E02:Schoenfeld2019 — Schoenfeld BJ, Grgic J, Krieger J. 2019. How many times per week should a muscle be trained? *J Sports Sci* 37(11):1286–1295.
- E04:S1 — ACSM. 2026. Resistance Training Position Stand（摘要页；完整作者表与 DOI 待核实，正文见 E02:Currier2026）。
- E04:S2 — ACSM. 2026. Resistance Training Position Stand infographic.
- E04:S3 — Ratamess NA, et al. 2009（同 E02:Ratamess2009）。
- E04:S4 — Moesgaard L, et al. 2022. Effects of periodization… *Sports Med* 52(7):1647–1666.（内容经二手摘要阅读，待核实）
- E04:S5 — Hickmott LM, et al. 2022. Load and volume autoregulation: SR & MA. *Sports Med Open* 8:9.
- E04:S6 — Larsen S, et al. 2021. Subjective and objective autoregulation… *PeerJ* 9:e10663.（第一作者以外的作者待核实）
- E04:S8 — Helms E, Morgan A, Valdez A. 2019/2025. *The Muscle and Strength Pyramid: Training*（节选）.
- E04:S9 — Kotarsky CJ, et al. 2018. Progressive calisthenic push-up training. *J Strength Cond Res* 32(3):651–659.（经二手摘要阅读，DOI 待核实）
- E04:S10 — Bell L, et al. 2023. Integrating deloading… Delphi consensus. *Sports Med Open* 9:87.
- E04:S11 — Bell L, et al. 2024/2025. A practical approach to deloading. *Strength Cond J*.（卷期页码与 DOI 待核实）
- E04:S12 — Coleman M, et al. 2024. A one-week deload period… *PeerJ* 12:e16777.
- E04:S13 — RP Strength. 2017. Training volume landmarks for muscle growth.
- E04:S14 — Iversen VM, et al. 2021（同 E02:Iversen2021；E04 仅经引用该文的会议幻灯片看到，待核实）。
- E04:S15 — Khalil MA, Saab BR. 2016. Resistance exercise–induced rhabdomyolysis. *Aust Fam Physician* 45(12).
- E04:S16 — Bosquet L, et al. 2013. Effect of training cessation on muscular performance: a meta-analysis. *Scand J Med Sci Sports* 23(3).（未直接阅读摘要，效应量来自 S17，待核实）
- E04:S17 — Stronger By Science. n.d. Detraining: how long does it take to lose strength and muscle?（作者待核实）
- E04:S18 — Ogasawara R, et al. 2013. Continuous vs periodic strength training. *Eur J Appl Physiol* 113:975–985.（第四作者待核实）
- E04:S19 — HPRC / USU. 2021. Choosing the right exercises（引用 NSCA *Essentials of Strength Training and Conditioning*）.
- E04:S20 — Silverberg A, Woodruff J. 2024. Squat progressions. PowerliftingTechnique.com.
- E04:S26 — Wurm B, et al. 2010. Kinetic analysis of several variations of push-ups. *ISBS Conference Proceedings*.
- E04:S27 — Contreras B, et al. c. 2012. The biomechanics of the push-up.（期刊待核实）
- E04:S28 — Pelland JC, et al. 2024 预印本（E04 经二手摘要阅读，待核实）。
- 本手册撰写规范（内部文件 `rulebook-spec.md`）。

### v2 澄清（2026-10-17）：第2周第三次力量训练的证据
本版保留第2周两次力量训练。第三次所需的首周两次真实完成、未触发延迟性酸痛转介等完整证据链目前不能由一般档案或用户一句自我声明代替，因此仅第三次放行路径标为 deferred；原硬性规则和单次剂量限制仍执行。生成器与公开校验统一采用已实现的两次上限，不删除旧参数或训练记录。
