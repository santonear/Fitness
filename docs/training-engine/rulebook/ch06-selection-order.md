# 第 6 章　动作选择、顺序与均衡

机器规则：`rules-ch06.yaml`（本章 20 条规则，id 一一对应）

第 3 章给出每天的日模板（每个位置要什么动作模式），第 4 章把位置变成带时间预算的槽位（slot）。本章回答剩下的问题：**每个槽位具体放动作库里的哪一个动作、按什么顺序做、一周下来各类动作是否均衡、家里器械不够时怎么办。**

**筛选流程，用大白话说**：对每个槽位，引擎先拿出整个动作库，然后一层层"过筛子"——

1. **先去掉不能做的**：人群（老年、孕期、产后）、部位注意（膝/腰/肩/腕）和新手前 4 周的排除项，这一步来自其他章节，任何情况下都不放宽；
2. **再去掉做不了的**：用户没有的器械、放不下的空间、楼下有人时太吵的动作；
3. **再挑合适的**：动作的用途标签（use）要对得上槽位，动作模式（movement pattern）要对得上日模板，难度要落在用户水平的窗口内；已经在练的进阶阶梯（progression ladder）沿用当前那一级；
4. **再照顾新鲜感**：同一次课不重复，力量类动作隔天不重复；
5. **最后排序取第一名**：难度最贴近、双侧多关节、标注置信度高、关节负荷低的优先；完全并列时按动作 id 排，保证同样的输入永远得到同样的计划。

如果某个槽位筛到最后一个都不剩，就按固定的"后备链"逐级放宽（但安全排除永不放宽），实在没有就把这个槽位留空、把时间让给下一个槽位，并记录覆盖缺口。

| 步骤 | 做什么 | 规则 id |
|---|---|---|
| 1 | 硬排除（安全、人群、新手） | 其他章节 |
| 2 | 器械可用 | `equipment.*` |
| 3 | 空间与噪音 | 用户设置 |
| 4 | use 标签匹配槽位 | `select.use_tag.slot_match` |
| 5 | 动作模式匹配 | `select.pattern.match` |
| 6 | 难度窗口 | `select.difficulty.window` |
| 7 | 阶梯连续 | `select.difficulty.window`（阶梯优先） |
| 8 | 变化过滤 | `variety.*` |
| 9 | 排序与并列处理 | `select.rank` |
| — | 候选为空时 | `select.fallback.chain` |

本章字段名与《动作标注标准 v0.1》（`annotation-rubric.md`）一致：`primary_pattern`、`secondary_patterns`、`difficulty`、`use`、`ladder{id, step}`、`flags`、`joint_load`、`nsca_class`、`laterality`、`modality`、`time.setup_s`。器械名取自动作库原始字段（如 `none`、`dumbbell`、`resistance-band`、`loop-band`、`pull-up-bar`）。

## 6.1　筛选流程与排序

**[select.pipeline]**
- **规则**：每个槽位按固定 9 步筛选：硬排除 → 器械可用 → 空间与噪音（动作 `space` ≤ 用户空间，`noise` ≤ 用户噪音上限）→ use 标签匹配 → 动作模式匹配 → 难度窗口 → 阶梯连续（已在用的阶梯沿用当前 step）→ 变化过滤 → 排序取第一。候选为空时转入 [select.fallback.chain]。
- **理由**：先做"能不能做"的硬筛，再做"哪个更好"的软排序，结果可复现、可解释；对一般健康成人，器械、模型等次要变量对效果影响不一致，规律训练本身最重要，因此规则应简单固定。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E03:ACSM-2026；E04:S8

**[select.use_tag.slot_match]**
- **规则**：动作的 `use` 必须与槽位要求有交集：主项槽位要求 `use` 含 `main` 且 `nsca_class` 为 `compound` 或 `power`；辅助槽位要求 `use` 含 `accessory` 或 `main`；热身槽位要求 `warmup`；放松槽位要求 `cooldown`；体能槽位要求 `conditioning`。`use` 为 `skill` 的动作只有用户开启"进阶"（advanced_opt_in）后才可用。
- **理由**：主项要承担负荷进阶，应选多关节动作；体操、奥举类技巧动作不适合一般用户的自动编排。
- **证据等级**：C（工程选择）
- **来源**：E04:S19；E03:NSCA-Hoffman
- **例外/注意**：主项动作可以下放到辅助槽位，反过来不行。

**[select.pattern.match]**
- **规则**：先按动作的 `primary_pattern` 匹配槽位要求的模式，找不到再看 `secondary_patterns`；只有辅助、核心、体能槽位允许用次要模式补位，主项槽位只认主要模式。槽位列出多个模式时（如 `[carry, locomotion_ground]`），按列出顺序尝试，第一个有候选的模式胜出。
- **理由**：主项要稳定地代表一个动作模式，便于计量和进阶；辅助位用次要模式补位（如带抗旋转的单腿 RDL 补 `anti_rotation`）可以提高覆盖率。动作模式分类本身是教练经验，不是实证结构。
- **证据等级**：C（工程选择）
- **来源**：E04:S21；E04:S25

**[select.difficulty.window]**
- **规则**：难度（1–5）窗口按水平：新手目标 2（允许 1–3）；中级目标 3（允许 2–4）；开启"进阶"者目标 4（允许 2–5）。难度 5 或 `use: skill` 的动作只对开启"进阶"者开放。热身、放松动作难度 ≤2。新手前 4 周另受新手周上限约束（第 1–2 周 ≤2，第 3–4 周 ≤3）。已经在某条阶梯上练习的动作，以阶梯当前 step 为准，不按目标难度重选。
- **理由**：难度量表按未训练成人的技术、稳定性和相对负荷要求分级；新手应从有支撑或降阶的版本开始，动作稳定后再升级。
- **证据等级**：C（工程选择）
- **来源**：E04:S8；E04:S20；E04:S27（待核实）
- **例外/注意**：用户反馈"太简单/太难"可覆盖默认难度（个体的肢长、体重、活动度都会影响实际难度）。

**[select.rank]**
- **规则**：通过筛选的候选按以下键依次排序，取第一名：
  1. |难度 − 目标难度| 小者优先；
  2. 主项槽位：`laterality` 为 bilateral 者优先，`nsca_class` 为 compound 者优先；
  3. 标注置信度 high > medium > low；
  4. `review` 为 false 者优先；
  5. `joint_load` 各项之和小者优先；
  6. `time.setup_s` 小者优先；
  7. 动作 id 字母序。
  排序必须完全确定，相同输入得到相同结果。
- **理由**：节省时间的方案以双侧多关节动作为核心，每组能练到更多肌肉；双侧训练对双侧力量提高更多，增肌与单侧相近。
- **证据等级**：C（工程选择）
- **来源**：E03:Iversen-2021；E03:Kassiano-2025

**[select.fallback.chain]**
- **规则**：候选为空时按顺序逐级放宽，每放宽一级重新筛选，有结果即停：
  1. 难度窗口放宽 ±1；
  2. 允许用次要模式匹配（仅辅助、核心槽位）；
  3. 器械按 [equipment.downgrade] 降一档；
  4. 换相邻模式：squat ↔ lunge，push_horizontal ↔ push_vertical，pull_horizontal ↔ pull_vertical，各 `anti_*` 之间互换；
  5. 槽位留空，时间让给下一个槽位，并记录覆盖缺口。
  硬排除和 skill 门槛永不放宽。
- **理由**：先在同一模式内放宽，再跨模式，最后接受空位，尽量保住训练意图；任何情况下不能为了"填满"而放宽安全排除。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E04:S8；E03:ACSM-2026
- **审核提示**：① 第 1 步"难度 ±1"可能突破新手第 1–2 周 `max_difficulty: 2`、第 3–4 周 ≤3 的上限，也可能让中级用户（上限 4）拿到难度 5 的动作，而 `never_relax` 只列了 `hard_excludes` 和 `use_skill_gate`；建议把新手周难度上限和"难度 5 仅限进阶"一并列入 `never_relax`。② [select.pattern.match] 在常规筛选中已允许辅助/核心/体能槽位用次要模式，第 2 步只在这些槽位生效，实际不会产生新候选，需确认本意（是否应改为常规筛选只认主要模式）。

## 6.2　动作顺序

**[order.sort_key]**
- **规则**：同一次课内的动作按以下等级排序（数字小的先做）：
  1. 爆发动作：模式为 `jump_land`、`throw_upper`、`olympic`，或 `modality` 为 plyometric / power；
  2. 力量目标下用户指定的优先主项；
  3. 双侧多关节下肢动作；
  4. 多关节上肢动作；
  5. 单侧或交替的多关节动作；
  6. 孤立动作；
  7. 核心与负重行走（`anti_extension`、`anti_rotation`、`anti_lateral_flexion`、`rotation`、`trunk_flexion`、`carry`、`locomotion_ground`）；
  8. 体能；
  9. 放松与柔韧（`modality: mobility`）。
  同一等级内，难度高（技术要求高）的先做，再按模板槽位顺序。超级组成员保留模板中的位置，不拆开重排。增肌目标例外：落后肌群的孤立动作可以提前到第 3 级。
- **理由**：先做的动作力量进步更多（多关节先做利于多关节力量，效应量 0.32），而动作顺序不影响增肌（效应量 0.03）；应按目标优先级排序，而不是按肌肉大小。技术复杂的动作趁精力充沛时做。
- **证据等级**：B
- **来源**：E03:Nunes-2021（待核实）；E03:Simao-2012；E03:NSCA-Hoffman；E04:S19
- **例外/注意**：爆发动作只对中级开放（第 5 章 `dose.power`），新手前 4 周排除；环节总顺序见第 4 章 `session.order.blocks`。

## 6.3　每周均衡

**[select.unilateral.weekly]**
- **规则**：每周有 ≥1 天力量训练时，至少安排 1 个单侧下肢动作（`primary_pattern` 为 `lunge`，或 `laterality` 为 unilateral 的下肢动作）。
- **理由**：单侧训练对单侧任务的力量提高更多，增肌与双侧相近；单侧训练还能提高未训练一侧肢体的力量（交叉迁移，cross-education）。单腿动作也适合居家、无需重器械。
- **证据等级**：B
- **来源**：E03:Kassiano-2025；E03:ACSM-2026
- **审核提示**：E03 把"每周 ≥1 个单侧下肢动作"这条规则本身标为 A/C——研究支持单侧训练的效果，但"每周至少 1 个"这个数是工程选择，没有研究直接检验；YAML 标 B，建议教练确认等级。

**[balance.week.pull_push]**
- **规则**：每周拉类直接组数 ÷ 推类直接组数应在 1.0–1.5 之间。拉类 = `pull_horizontal`、`pull_vertical`；推类 = `push_horizontal`、`push_vertical`；按动作主要模式计直接组数。低于 1.0 时：先给已有的拉类辅助动作加 1 组；仍不够，把最后一个推类辅助动作换成 `pull_horizontal`。触发 [equipment.pull_gap] 时本规则暂停。
- **理由**：从业者普遍主张拉的训练量不少于推，久坐人群常用 ≥1:1；这没有荟萃分析或原始研究支持，只作软规则。
- **证据等级**：C
- **来源**：E03:NSCA-Hoffman；E04:S25
- **审核提示**：E03 明确写明推拉比例"没有核实到原始来源"，并未把它归于 NSCA-Hoffman（该节选讲的是动作顺序和配对）；实际支持只有 E04:S25（Boyle 访谈，从业者观点）。建议把来源改为 E04:S25 并注明"从业者共识"。

**[balance.week.hinge_knee]**
- **规则**：每周髋主导（`hinge`）组数 ÷ 膝主导（`squat` + `lunge`）组数应在 0.7–1.3 之间。超出范围时，在 hinge 与 lunge 辅助槽位之间挪 1 组。
- **理由**：从业者把下肢分为髋主导和膝主导，主张两者训练量大致相当（相差不超过约 30%）。
- **证据等级**：C
- **来源**：E03:NSCA-Hoffman；E04:S25
- **例外/注意**：两份证据的分母不同：E04（Boyle）是"深蹲 + 弓步"，E03 是"深蹲"；YAML 采用 E04 的写法。与第 3 章 `week.coverage.patterns`（髋主导、膝主导每周各 ≥2 次）同时生效。

**[balance.week.core_three]**
- **规则**：每周 ≥3 天力量训练时，`anti_extension`、`anti_rotation`、`anti_lateral_flexion` 每种至少 1 次；每周 1–2 天时，必须有 `anti_extension`，并在 `anti_rotation`、`anti_lateral_flexion` 中至少有 1 种。`rotation`、`trunk_flexion` 为可选。次要模式也计入。
- **理由**：功能训练框架把核心训练分为抗伸展、抗侧屈、抗旋转三类，以"抵抗"为主；屈体和旋转动作不是必需。
- **证据等级**：C（工程选择：E04 只要求每周 1 个抗伸展 + 1 个抗旋转或抗侧屈，≥3 天要求三类齐全是本产品更严格的选择）
- **来源**：E04:S25；E04:S21
- **审核提示**：v0.1 动作库中，器械为 `none`/弹力带且 use 含 main/accessory 的 `anti_rotation` 主模式动作只有 2 个（另有约 7 个以它为次要模式），居家用户在 3 天以上时虽能满足，但可选余地很小；该模式已在 [equipment.catalog_gap_report] 的缺口清单中。

**[balance.week.carry_ground]**
- **规则**：每周 ≥2 天力量训练时，至少安排 1 次 `carry`（负重行走）或 `locomotion_ground`（爬行、翻滚、起身等地面动作）；优先 carry，没有可负重的器械时用 locomotion_ground。
- **理由**：负重行走是基本人类动作之一，地面动作被部分教练列为"第六类"；功能训练框架建议在器械允许时每周都有。
- **证据等级**：C
- **来源**：E04:S22；E04:S24（待核实）；E04:S25
- **审核提示**：E04 的原话是"器械允许时"每周 1 次，YAML 写成无条件的 gate。核查 v0.1 动作库：器械为 `none`/弹力带且 use 含 main/accessory 的 `carry` 和 `locomotion_ground` 动作均为 0 个，次要模式中也没有——无器械用户无法满足本规则。需要补库，或像 [balance.week.pull_push] 那样增加"无可用动作时暂停"的条件。

## 6.4　变化与轮换

**[variety.no_repeat]**
- **规则**：同一次课里，同一个动作 id 最多出现 1 次，同一条阶梯（`ladder.id`）最多 1 个动作；连续两天同一力量类动作不重复（v2适用范围澄清见下）；A/B 日的同一模式优先选不同动作。热身组不算重复。
- **理由**：同一次课重复同一动作或同一阶梯的相邻变体，等于把同一刺激堆在一处；按周分散比集中在一次课更合理。
- **证据等级**：C（工程选择）
- **来源**：E04:S8

**[variety.rotation]**
- **规则**：主项动作固定 4–8 周，在训练块结束或减量周时轮换；辅助动作每 4 周轮换，或用户要求时轮换；仍在进步的动作可以保留不换；用户表示不喜欢某个动作时立即替换。
- **理由**：主项保持不变才能衡量进步；辅助动作可以较自由地轮换，用于维持兴趣和覆盖不同角度。动作选择在训练优先级中排在坚持、训练量和进阶之后。
- **证据等级**：C
- **来源**：E03:NSCA-Hoffman；E04:S8
- **审核提示**：`rotate_main_at: block_end_or_deload` 允许在减量周换主项，但减量规则（`rules-part2.yaml` 的 `deload.prescription`，`keep: [exercises, frequency]`）要求减量周保留原动作、专注技术。建议改为"减量周结束后的第一周轮换"。

## 6.5　器械替换与缺口

**[environment.household_support] — v2 调整**

- **规则**：`householdSupport` 未指定时，家中（`home`）、混合（`mixed`）及健身房（`gym`）默认可使用家居支撑物，户外默认不可用；`mat` 空间不改变该默认值。开启后，`wall`、`chair`（椅背）、`counter`（稳固桌边或台面）参与器械满足与替代判断。显式关闭只取消这组隐含器械，用户实际登记的器械仍可用。
- **范围**：只有扶墙单腿站、扶墙前后脚站立、扶墙提踵平衡三个既有动作登记 `wall → chair/counter` 替代，持续轻扶支撑的动作要求不变。其他扶墙动作没有因此获得替代；不适用于借墙承重的动作。
- **证据等级**：C（经用户确认的产品配置和动作标注，不是新增医疗结论）。
- **来源**：用户《训练引擎 V2 收尾》第 1.1 节；数值与配置见同名机器规则。

**[equipment.downgrade]**
- **规则**：同一动作模式内，器械按以下顺序降档替换：杠铃 → 哑铃/壶铃 → 器械/拉索 → 弹力带 → 自重；替换时保持主要动作模式和槽位 use 不变，难度差 ≤1。对一般目标，替换不扣减预期效果。力量目标且下肢只有自重时，优先用单腿阶梯进阶（分腿蹲 → 后脚抬高分腿蹲 → 手枪蹲系列）、放慢节奏和接近力竭的高次数，并显示 [equipment.strength_bodyweight_copy]。
- **理由**：器械与自由重量的力量效果没有差别；弹力带能提高力量和肌肉量，上下肢力量增益与常规负重相近；居家训练能提高力量、耐力和平衡。
- **证据等级**：A（"替换无损"这一结论）；降档顺序和难度容差 ≤1 为工程选择
- **来源**：E03:ACSM-2026；E03:Lopes-2019；E03:Iversen-2021
- **例外/注意**：自重下肢训练的证据很少，重负荷下肢多关节训练需要常规器械（见 [equipment.strength_bodyweight_copy]）。手枪蹲为难度 5，只对开启"进阶"者开放（[select.difficulty.window]）。

**[equipment.pull_gap]**
- **规则**：当用户器械条件下，动作库中没有任何 `primary_pattern` 为 `pull_horizontal` 或 `pull_vertical` 的动作能通过筛选时触发（典型情况：器械只有 `none`）。触发后：
  1. 拉类槽位依次用：弹力带拉类动作（如有）→ 以拉为次要模式的动作 → 下一个未用的核心或髋主导位置；
  2. 缺口存在期间，推类组数保持在目标起始值，不做每周递增；
  3. 暂停 [balance.week.pull_push]；
  4. 每周显示 1 次 [equipment.pull_gap_copy]，直到用户更新器械，最多 4 次。
  用户添加 `resistance-band`、`loop-band`、`pull-up-bar`、`suspension-trainer`、`dumbbell`、`kettlebell` 中任一项后解除。
- **理由**：v0.1 动作库中器械为 `none` 的拉类动作为 0 个；弹力带拉类只有 band-pull-apart（热身/辅助）和 band-assisted-pull-ups（需要单杠）。不削减推类，避免整体训练量下降；不再加推，避免推拉差距扩大。
- **证据等级**：C（工程选择）
- **来源**：E03:Lopes-2019；E03:ACSM-2026；E03:NSCA-Hoffman
- **审核提示**：动作库原始数据中 band-assisted-pull-ups 的器械字段只有 `resistance-band`，没有 `pull-up-bar`。只有弹力带的用户会通过器械筛选拿到这个动作（实际做不了），而本规则也不会触发。需在动作库补上 `pull-up-bar`；另外动作库里没有"弹力带划船"，第 1 步"弹力带拉类"目前实际只剩 band-pull-apart。

**[equipment.pull_gap_copy]**
- **规则**：[equipment.pull_gap] 触发时显示：
  - 中文：没有器械时，"拉"类动作（练背）很难安排。一根带门扣的弹力带就能补上划船和下拉，效果和器械训练相近。要添加到你的器材清单吗？
  - 英文：Without equipment, it's hard to train pulling (your back). A resistance band with a door anchor covers rows and pulldowns, with results similar to machines. Add one to your equipment list?
- **理由**：弹力带训练的上肢和下肢力量增益与常规负重训练相近，是最便宜、最省空间的补救办法。
- **证据等级**：B
- **来源**：E03:Lopes-2019；E03:ACSM-2026

**[equipment.strength_bodyweight_copy]**
- **规则**：目标为力量、且没有可加重的下肢器械时显示：
  - 中文：只用自重练腿，力量进步可能较早停滞。我们会用单腿动作、放慢节奏和接近力竭的高次数来继续加难度；有条件时加一对哑铃或壶铃会更好。
  - 英文：With bodyweight only, leg strength may plateau sooner. We'll keep progressing with single-leg moves, slower tempo and high reps near failure; adding dumbbells or a kettlebell will help.
- **理由**：俯卧撑、引体向上等上肢自重训练证据较好，但只用自重的下肢训练证据很少；力量目标的重负荷下肢训练需要常规器械。
- **证据等级**：C
- **来源**：E03:Iversen-2021

**[equipment.catalog_gap_report]**
- **规则**：按动作模式统计"器械为 `none`、`resistance-band` 或 `loop-band`，且 use 含 main 或 accessory"的动作数，少于 4 个即为居家覆盖缺口，报告给内容团队补库。v0.1 已知缺口：`pull_horizontal`、`pull_vertical`、`carry`、`anti_rotation`、`rotation`、`locomotion_ground`。
- **理由**：动作标注标准要求每个模式至少有 4 个无器械或弹力带动作；缺口会让居家用户的均衡规则无法满足。
- **证据等级**：C（工程选择）
- **来源**：E03:ACSM-2026
- **审核提示**：按本规则的统计口径复核 v0.1 动作库（637 个动作），实际不足 4 个的还有 `push_vertical`（3 个）和 `isolation_upper`（0 个），以及爆发类 `jump_land`、`throw_upper`（各 2 个）、`olympic`（0 个）；YAML 的已知缺口清单漏列了 `push_vertical` 和 `isolation_upper`。清单是给内容团队的参考，不影响引擎运行，但建议更新。复核数字：pull_horizontal 1、pull_vertical 1、carry 0、locomotion_ground 0、anti_rotation 2、rotation 2。

---

## 本章来源

- E03:ACSM-2026 — Currier BS, D'Souza AC, Singh MAF, Lowisz C, Rawson ES, Schoenfeld BJ, Smith-Ryan A, Steen JP, Thomas GA, Triplett NT, Washington T, Werner TJ, Phillips SM. 2026. American College of Sports Medicine Position Stand: Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews. *Med Sci Sports Exerc* 58(4):851–872. DOI 10.1249/MSS.0000000000003897.（另一来源记为 58(3):512–545，卷期页码待核实）
- E03:NSCA-Hoffman — Hoffman J (ed.), NSCA. *NSCA's Guide to Program Design*. Human Kinetics. 节选 "Utilize proper workout structure and exercise order." https://us.humankinetics.com/blogs/excerpt/utilize-proper-workout-structure-and-exercise-order（所提及的 NSCA *Essentials of Strength Training and Conditioning*, 4th ed., 2016 未打开，待核实）
- E03:Iversen-2021 — Iversen VM, Norum M, Schoenfeld BJ, … Fimland MS. 2021. No time to lift? Designing time-efficient training programs for strength and hypertrophy: a narrative review. *Sports Med* 51(10):2079–2095. DOI 10.1007/s40279-021-01490-1.（仅打开出版社页面部分正文）
- E03:Kassiano-2025 — Kassiano W, Nunes JP, Costa B, Ribeiro AS, Loenneke JP, Cyrino ES. 2025. Comparison of muscle growth and dynamic strength adaptations induced by unilateral and bilateral resistance training: a systematic review and meta-analysis. *Sports Med* 55:923–936. DOI 10.1007/s40279-024-02169-z.
- E03:Nunes-2021 — Nunes JP, Grgic J, Cunha PM, Ribeiro AS, Schoenfeld BJ, de Salles BF, Cyrino ES. 2021. What influence does resistance exercise order have on muscular strength gains and muscle hypertrophy? A systematic review and meta-analysis. *Eur J Sport Sci* 21(2):149–157. DOI 10.1080/17461391.2020.1733672.（作者表待核实）
- E03:Simao-2012 — Simão R, de Salles BF, Figueiredo T, Dias I, Willardson JM. 2012. Exercise order in resistance training. *Sports Med* 42(3):251–265.（DOI 未见）
- E03:Lopes-2019 — Lopes JSS, Machado AF, Micheletti JK, de Almeida AC, Cavina AP, Pastre CM. 2019. Effects of training with elastic resistance versus conventional resistance on muscular strength: a systematic review and meta-analysis. *SAGE Open Med* 7. DOI 10.1177/2050312119831116.
- E04:S8 — Helms E, Morgan A, Valdez A. 2019（2025 更新）. How to build training programs（*The Muscle and Strength Pyramid: Training*, 3rd ed. 节选）. RippedBody. https://rippedbody.com/how-to-build-training-programs/
- E04:S19 — HPRC / Uniformed Services University. 2021. Choosing the right exercises to optimize your resistance training（转引 NSCA *Essentials of Strength Training and Conditioning*）. https://www.hprc-online.org/physical-fitness/training-performance/choosing-right-exercises-optimize-your-resistance-training
- E04:S20 — Silverberg A, Woodruff J. 2024. Squat progressions. PowerliftingTechnique.com. https://powerliftingtechnique.com/squat-progressions/
- E04:S21 — Saville W. 2016（2025 更新）. Basic movement patterns. Science for Sport. https://www.scienceforsport.com/basic-movement-patterns/
- E04:S22 — Cook M / John D. 2016. Dan John: 5 basic human movements（*Intervention* 节选）. On Target Publications. https://www.otpbooks.com/?p=17307
- E04:S24 — Trotter S. 2021. Go beyond the 5 fundamental movement patterns. Breaking Muscle. https://breakingmuscle.com/go-beyond-the-5-fundamental-movement-patterns/（Dan John "第六类动作"仅见于二手描述，原书出处待核实）
- E04:S25 — Boyle M. 年份不详. Insights on functional athletic performance training（访谈）. SimpliFaster. https://simplifaster.com/articles/insights-functional-athletic-performance-training-michael-boyle/
- E04:S27 — Contreras B, Schoenfeld B, Mike J, Tiryaki-Sonmez G, Cronin J. 约 2012. The biomechanics of the push-up: implications for resistance training programs. 录用稿. https://www.lookgreatnaked.com/articles/biomechanics_of_the_Pushup.pdf（期刊待核实，可能为 *Strength Cond J*）


## v2 调整：规则分级与目标

以下调整取代本章对应项目的旧硬门槛表述，其余准入和动作安全排除保持原样。

- `balance.week.carry_ground`：只在器械及完整硬筛选允许该类动作且力量日不少于2天时尝试；缺少候选跳过、不提示，作为advice不扣分。

### v2 澄清（2026-10-17）：课内去重与隔天恢复范围
课内同动作／同阶梯不重复仍为所有人群的硬限制；真实热身组仍按原来源证明规则处理。隔天去重针对力量、抗阻、爆发与负重等长，不把低强度有氧、灵活性／拉伸、呼吸和盆底提醒误当力量恢复要求。低强度有氧必须有实际处方RPE上界不高于既有中强度上限且非HIIT，未知不能伪装轻松。缺等长负荷事实时保守按力量处理；只有目录已核实的纯静态平衡例外，不用缺失公斤数推断无负荷。范围、源RPE引用与排除条件均登记在variety.no_repeat.adjacent_day_scope。
模板仅保留真实DayPlan.weekday；邻日包含周日→周一，不按数组相邻、部分preferredDays或未知旧计划猜日期。不变更孕产准入、剂量、每周目标或其他强度限制。产后阶段1来源允许的轻步行自然可连续日安排，不设单独产后例外。此裁定在最终PR“规格冲突与裁定”列明。
