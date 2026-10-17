# 第 9 章　关节注意时的替换与疼痛规则（膝 / 腰 / 肩 / 腕）

> 机器规则：`rules-ch09.yaml`（26 条，id 一一对应）。
> 标「【需专业审核】」的规则和文案，上线前必须由医生或物理治疗师审核。来源后标「（待核实）」的，表示证据库只通过二手摘要获得，或原文未打开，需对照原文。

## 本章边界

"部位注意"（caution flag）来自用户自述，例如"我膝盖不太舒服"。它**不是诊断**。引擎只做三件事：

1. 避开或降低该部位高负荷的动作（过滤）；
2. 换成更舒适的同类动作（替换）；
3. 出现危险信号（red flag）时停止训练，建议寻求专业帮助（转介）。

应用不判断疼痛原因，不把训练称为"康复"或"治疗"，不开具针对某种病症的方案。

## 0　过滤表达式约定（第 9–12 章通用）

所有排除、降权条件都写成对《动作标注标准 v0.1》字段的表达式，引擎可直接执行。

**动作条件**（对每条动作标注记录求值）：

| 写法 | 含义 | 例 |
|---|---|---|
| `{field: <路径>, <op>: <值>}` | 标量字段比较；op 为 `eq ne gt gte lt lte in not_in` | `{field: joint_load.knee, gte: 3}` |
| `{flag: <名或列表>}` | flags 含其中任一 | `{flag: [jumping, deep_knee_flexion]}` |
| `{position: <名或列表>}` | position 含其中任一 | `{position: supine}` |
| `{use: <名或列表>}` | use 含其中任一 | `{use: skill}` |

**用户条件**：`{user: <路径>, <op>: <值>}`，另有 `contains`、`contains_any`（列表字段）和 `is`（布尔）。
**组合**：`any`（任一）、`all`（全部）、`not`（取反）。
**动作**：`exclude_if`（排除）；`deprioritize_if` + `score_multiplier`（降权，选动作时得分乘以该系数）；`allow_only_if`（只允许白名单）；`modify`（改组数或加提示）。

**用户状态字段**（四章共用）：

| 字段 | 取值 | 用途 |
|---|---|---|
| `caution_selfreport` | `[knee, back, shoulder, wrist]` 的子集 | 第 9 章 |
| `caution.<部位>` | 0 / 1 / 2 | 注意等级 |
| `pain.*` | 当前疼痛分、是否持续到次日早上、是否逐周加重等 | 疼痛规则 |
| `equipment` | 列表，如 `dumbbells`、`pushup_handles` | 替换选择 |
| `age`、`balance_cautious`、`walking_aid`、`hypertension`、`bone_flag` | 见第 10 章 | 老年人 |
| `gestation_week`、`provider_confirmed`、`prepregnancy_running` 等 | 见第 11 章 | 孕期 |
| `postpartum_week`、`delivery`、`perineal_trauma`、`postnatal_cleared` 等 | 见第 12 章 | 产后 |

**冲突处理**：同一用户命中多个模块时，所有排除条件取并集；替换动作必须同时通过全部过滤。孕期、产后、老年人模块优先于本章。

---

## 9.1　开启与等级

**[caution.activation]**
- **规则**：用户自述某部位需要注意时，该部位注意等级设为 1（取值 0–2），并按顺序执行：危险信号问答 → 该部位过滤 → 替换 → 疼痛规则。疼痛规则可把等级升到 2。界面文字只用"膝盖需要注意"这类说法。
- **理由**：自述不能等同诊断；分级让引擎在用户反复不适时自动更保守，平时又不至于过度限制。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E05:Bannuru2019；E05:NICE_NG59（2026 更新部分待核实）
- **例外/注意**：界面不出现任何病名。

---

## 9.2　各部位的过滤（排除与降权）

> 降权系数 0.5 是工程选择，待教练审核：被降权的动作仍可能入选，只是排在同类更低负荷的动作之后。

**[caution.knee.filter]**
- **规则**：
  - 等级 1：排除 `joint_load.knee >= 3`，或 flags 含 `jumping` / `running` / `deep_knee_flexion` / `kneeling_on_knee`，或 `impact >= 2`，或 `modality = plyometric`；`joint_load.knee = 2` 降权。
  - 等级 2：排除 `joint_load.knee >= 2`，或 `impact >= 1`，以及等级 1 的全部 flags；`joint_load.knee = 1` 降权。
- **理由**：减少冲击、负重深屈膝（膝关节屈曲超过约 90° 时负重）和跪压，是在不停止训练的前提下降低膝部负担的直接办法。
- **证据等级**：C
- **来源**：E05:Bannuru2019；E05:Kolasinski2020；E05:Hartmann2013
- **例外/注意**：对技术良好的健康人，深蹲本身并未被证明有害。这里缩短幅度只是为了舒适，文案不得暗示"深蹲伤膝"。按当前标注，等级 1 约排除 97/637 个动作，等级 2 约 141 个。

**[caution.back.filter]**
- **规则**：
  - 等级 1：排除 `joint_load.back >= 3`，或 flags 含 `loaded_spinal_flexion` / `loaded_spinal_rotation` / `heavy_axial_load`，或 `impact >= 2`；`joint_load.back = 2` 或 flags 含 `valsalva_prone`（憋气发力）时降权。
  - 等级 2：排除 `joint_load.back >= 2`，以及上述 flags 加 `valsalva_prone`；`joint_load.back = 1` 降权。
- **理由**：避开负重屈曲、负重扭转、大重量轴向负荷（heavy axial load）和高冲击，同时保留其他动作，让用户继续活动。
- **证据等级**：C（阈值为工程选择；"保持活动"的方向见下一条，A 级）
- **来源**：E05:NICE_NG59（2026 更新部分待核实）
- **例外/注意**：按当前标注，等级 1 约排除 56 个动作，等级 2 约 129 个。

**[caution.back.keep_active]**
- **规则**：腰背注意不减少每周训练次数和有氧分钟目标，只替换动作；任何文案不出现"卧床休息""完全休息""静养"。
- **理由**：腰痛指南的核心建议是继续正常活动，并以运动为主做自我管理。
- **证据等级**：A
- **来源**：E05:NICE_NG59（2026 更新部分待核实）

**[caution.shoulder.filter]**
- **规则**：
  - 等级 1：排除 `joint_load.shoulder >= 3`，或 flags 含 `overhead_load`，或 position 含 `inverted`，或 use 含 `skill`（如借力摆动类）；`joint_load.shoulder = 2` 降权；推类动作（`push_horizontal` / `push_vertical`）每个减 1 组，至少保留 1 组。
  - 等级 2：排除 `joint_load.shoulder >= 2`，以及 position 含 `hanging`；`joint_load.shoulder = 1` 降权。
- **理由**：按标注，颈后推举、双杠臂屈伸、直立划船、倒立都是肩部 3 级负荷，会被过滤掉。降低推举平面、减少推的总量，是常用的肩部调整方式。
- **证据等级**：C
- **来源**：E05:Somerset（年份待核实）
- **例外/注意**：减 1 组为工程选择，待教练审核。按当前标注，等级 1 约排除 100 个动作，等级 2 约 185 个。

**[caution.wrist.filter]**
- **规则**：
  - 等级 1：排除 `joint_load.wrist >= 3`；flags 含 `wrist_extension_loaded`（手掌撑地、手腕后伸负重）的动作也排除，**除非**它是俯卧撑或平板类（`primary_pattern` 为 `push_horizontal` 或 `anti_extension`，且 position 含 `prone`），并且用户有哑铃或俯卧撑支架。这种情况下保留，并提示握住器械、保持手腕中立。`joint_load.wrist = 2` 降权。
  - 等级 2：排除 `joint_load.wrist >= 2` 和全部 `wrist_extension_loaded`。
- **理由**：一项小样本实验（14 人）发现，手腕中立时俯卧撑的受力分布更均匀。研究没有测量损伤结局，所以这里只作为舒适性调整。
- **证据等级**：C
- **来源**：E05:Polovinets2018

---

## 9.3　替换优先级

**[caution.knee.substitute]**
- **规则**：按以下顺序，取第一个用户有器材且通过全部过滤的动作：
  - 深蹲类（squat）：箱式深蹲（box-squat，坐到舒适高度）→ 部分幅度或慢节奏自重深蹲 → 瑞士球靠墙蹲 → 限幅腿举（leg-press）→ 靠墙静蹲（wall-sit）20–45 秒；
  - 弓步类（lunge）：低箱踏步（step-ups）→ 箱式深蹲；
  - 髋铰链类（hinge）：臀桥 → 髋推；
  - 下肢单关节：腿弯举 → 坐姿腿弯举；
  - 有氧：固定单车 → 椭圆机 → 步行 → 游泳（目录暂缺）。
- **理由**：膝骨关节炎指南认为各类运动都有益，没有最优类型，所以按舒适度、器材和用户偏好替换即可。
- **证据等级**：C
- **来源**：E05:Bannuru2019；E05:Kolasinski2020
- **例外/注意**：动作库暂缺西班牙式深蹲（Spanish squat）类静力保持和游泳，已记入 `catalog_gaps`。

**[caution.back.substitute]**
- **规则**：深蹲类：高脚杯深蹲 → 箱式深蹲；髋铰链类：壶铃硬拉（从垫高处起）→ 臀桥；水平拉：胸部支撑哑铃划船 → 单臂坐姿绳索划船 → 单臂壶铃划船（凳上支撑）；核心：鸟狗式 → 侧桥 → 死虫式（孕期不用）；有氧：步行 → 固定单车。
- **理由**：这些动作用支撑、降低起始高度或分担重量的方式，减少腰部的负重屈曲和剪切。
- **证据等级**：C
- **来源**：E05:NICE_NG59（2026 更新部分待核实）
- **例外/注意**：孕 13 周起，第 11 章会排除死虫式等仰卧动作；目录暂缺六角杠硬拉。

**[caution.shoulder.substitute]**
- **规则**：
  - 推类按以下顺序选：地雷管推举 → 上斜哑铃推 → 对握哑铃卧推 → 哑铃地板卧推 → 壶铃地板卧推 → 减小幅度的上斜俯卧撑。
  - 如果所有推类都触发疼痛规则：本次训练去掉 `push_horizontal` 和 `push_vertical`，用面拉、胸部支撑划船、坐姿绳索划船补位。
- **理由**：降低平面（上斜代替过头）、收窄或对握、换成哑铃或地雷管、缩短幅度，都是常用的肩部调整办法；还不舒服时，以拉代推。
- **证据等级**：C
- **来源**：E05:Somerset（年份待核实）

**[caution.wrist.substitute]**
- **规则**：俯卧撑：握哑铃或支架的俯卧撑 → 握支架的上斜俯卧撑 → 器械推胸；平板支撑：前臂平板（目录中的 plank 即前臂支撑，腕负荷 0）；手臂弯举：锤式弯举、EZ 杠弯举；前架深蹲：改为高脚杯持铃深蹲。
- **理由**：握住器械或换对握，可以让手腕保持中立，不必硬撑后伸。
- **证据等级**：C
- **来源**：E05:Polovinets2018
- **例外/注意**：目录暂缺握拳俯卧撑。

**[caution.substitute.priority]**
- **规则**：通用替换算法：
  - 候选池：与原动作 `primary_pattern` 相同、通过全部过滤、`difficulty` 不高于原动作；
  - 排序：① 该部位替换表的顺序（用户有器材的）；② 同一阶梯（ladder）的更低一级；③ 受关注部位 `joint_load` 最低；④ 与原难度差距最小；⑤ 用户偏好；
  - 无候选时：删去这个动作位置，在本周其他训练里保住该模式的覆盖。
- **理由**：骨关节炎指南没有发现最优运动类型，替换应尊重耐受和偏好；保持同一动作模式，可以维持每周的模式覆盖。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E05:Bannuru2019；E05:Kolasinski2020

**[caution.multiple]**
- **规则**：多个部位同时注意时，各部位等级独立计算，排除条件取并集；孕期、产后、老年人模块的规则优先。
- **理由**：保证任何替换都不会违反另一个部位或人群模块的限制。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E05:Bannuru2019

---

## 9.4　0–10 疼痛规则

**[pain.prompt]**
- **规则**：对已开启注意的部位，凡 `joint_load.<该部位> >= 1` 的动作，每组后询问 0–10 疼痛分（0 = 不痛，10 = 能想象的最痛）。下次训练开始前再问两件事：上次的疼痛是否持续到第二天早上；疼痛或僵硬是否比上周更重。
- **理由**：疼痛监测模型同时看"训练中""第二天早上""逐周趋势"三个时间点。
- **证据等级**：C
- **来源**：E05:Silbernagel2007（待核实：规则经二手摘要确认）

**[pain.rule]** 【需专业审核】
- **规则**：
  - 疼痛 ≤3 且很快平复：继续。
  - 疼痛 4–5：停止该动作，换替换表中的下一个。
  - 疼痛 >5，或持续到第二天早上，或逐周加重：本次和下一次训练（共 2 次）去掉该动作模式，该部位注意等级 +1（最高 2）。
  - 未开启注意的用户报告疼痛 ≥4：询问是否开启部位注意。
- **理由**：借鉴肌腱病研究中的疼痛监测模型。该模型允许训练中疼痛低于 5/10；引擎只在 ≤3 时继续，更保守。
- **证据等级**：C（阈值为工程选择）
- **来源**：E05:Silbernagel2007（待核实）
- **例外/注意**：原模型来自跟腱病研究，并非针对膝、腰、肩、腕。

**[pain.repeat_referral]** 【需专业审核】
- **规则**：同一部位第 2 次触发"去掉动作模式"时：显示非紧急就医建议，再做一次危险信号问答；在用户确认已看过医生或物理治疗师之前，该部位不再进阶。
- **理由**：反复出现明显不适，超出了训练调整能处理的范围。
- **证据等级**：C
- **来源**：E05:Silbernagel2007（待核实）

**[pain.copy]**
- **规则**：疼痛规则相关文案：

| 场景 | 中文 | English |
|---|---|---|
| 4–5 分 | 这个动作先停一下，我们换一个更舒服的版本。 | Let's stop this one and switch to a version that feels better. |
| >5 分等 | 疼痛有点明显。接下来两次训练先避开这类动作，其余照常进行。 | That's more discomfort than we want. We'll skip this type of movement for the next two sessions and keep the rest of your plan going. |
| 第 2 次 | 这个部位已经第二次明显不舒服了。建议你找医生或物理治疗师看一看，确认之后再继续加量。 | This is the second time this area has flared up. Please check in with a doctor or physiotherapist before we increase your training again. |
| 缩短幅度 | 幅度小一点通常更舒服，按你觉得舒适的深度来做就好。 | A shorter range is often more comfortable. Go only as deep as feels okay. |

- **理由**：文案只说怎么调整，不说病名，也不解释原因。
- **证据等级**：C
- **来源**：E05:Silbernagel2007（待核实）；E05:Hartmann2013

---

## 9.5　带注意时的进阶

**[caution.progression]**
- **v2 澄清（2026-10-17 用户裁定，覆盖原自动恢复路径）**：本版本不会自动恢复动作幅度或箱高；身体感觉好转后，可以在设置里取消该部位的注意标记。
- This version doesn’t automatically restore range of motion or box height. When you feel better, you can turn off the caution for that area in Settings.
- 自动恢复路径 `deferred: true`，v1 不实现：缺少测量基准与真实记录；原条目分级 mechanic。负荷与阶梯的既有硬门禁独立登记为 `caution.progression_gate`，仍须满足连续两次训练疼痛规则，先加训练量再加负荷。用户主动取消注意前，须重新通过该部位完整红旗问题；不自动取消、不提示取消。说明只用于本手册及设置开关，不占计划三条提示。

- **规则**：连续 2 次训练疼痛都 ≤3 之前，不加负荷。达标后先加组数或次数，再加重量。动作幅度每次只恢复约 10–15°，或升高一档箱高。阶梯升级同样要求连续 2 次训练疼痛 ≤3。
- **理由**：小步恢复幅度和负荷，可以在保持训练的同时观察身体反应。
- **证据等级**：C
- **来源**：E05:Silbernagel2007（待核实）

**[caution.level_down]**
- **规则**：等级 2 在连续 4 次训练疼痛都 ≤3、且没有持续到次日早上的疼痛后，降回等级 1。等级 1 不自动解除；只有在危险信号问答全部为"否"之后，用户才能自己关闭。
- **理由**：证据库没有给出降级条件；需要一个明确的出口，以免用户永久停在最严格的等级。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E05:Silbernagel2007（待核实）

---

## 9.6　转介红旗症状

**[redflag.screen]** 【需专业审核】
- **规则**：在以下时机做危险信号问答：开启部位注意时；疼痛规则走到"去掉动作模式"时；用户在训练中点"身体不对劲"按钮时；每 12 个月；用户更新健康信息时。任一项回答"是"：停止训练，按分级处理（见下面三条）。
- **理由**：危险信号提示问题可能不只是普通训练不适，需要专业评估；应用不判断原因，只负责停止和转介。
- **证据等级**：C（12 个月间隔为工程选择）
- **来源**：E05:NICE_NG59（2026 更新部分待核实）；E05:Riebe2015；E01:PARQ23

**[redflag.joint_any]** 【需专业审核】
- **规则**：任一部位出现以下情况：结束训练，暂停全部计划，显示"尽快就医"文案，直到用户确认已就诊：
  - 跌倒或撞击后疼痛；
  - 无法承重或无法使用该肢体；
  - 关节红、热、肿，或伴发热；
  - 关节卡住或突然打软；
  - 不明原因的夜间痛或静息痛；
  - 明显变形；
  - 麻木、刺痛或无力向手臂或腿扩散。
- **理由**：这些信号需要先排除其他原因，超出训练调整的范围。
- **证据等级**：C
- **来源**：E05:NICE_NG59（待核实：清单为一般临床共识，NICE 把具体红旗清单交给其他指南，证据库未核对）

**[redflag.back]** 【需专业审核】
- **规则**：
  - **急症**（立即去急诊）：腹股沟或臀部周围麻木；新出现的大小便控制问题；腿部无力持续加重。
  - **尽快就医**：腰背痛伴发热或全身不适；有癌症史；不明原因的体重下降；明显外伤后出现；与动作无关的剧烈持续疼痛。
  - 两类都结束训练、暂停计划，直到用户确认已就诊。
- **理由**：前三项是马尾综合征（cauda equina syndrome）的特征，属于急症；后几项需要排除其他病因。
- **证据等级**：A（指南指出需考虑其他病因，马尾综合征属急症）
- **来源**：E05:NICE_NG59（2026 更新部分待核实；具体清单待核实）

**[redflag.shoulder]** 【需专业审核】
- **规则**：肩痛伴胸痛或气促：按心脏警示处理（结束训练，显示急救文案）。受伤后手臂突然抬不起来：尽快就医。两者都暂停计划，直到用户确认已就诊。
- **理由**：肩部或手臂的疼痛可能与心脏有关；受伤后突然失去活动能力需要专业评估。
- **证据等级**：C
- **来源**：E05:NICE_NG59；E01:FRANK20；E01:Healthline（待核实，需换成 AHA 原始页面）

**[redflag.copy]** 【需专业审核】
- **规则**：危险信号文案：

| 场景 | 中文 | English |
|---|---|---|
| 尽快就医 | 你提到的情况需要先请医生看一看。训练计划先暂停，请尽快预约就诊。看过医生后回到这里确认，我们会从轻松的内容重新开始。 | What you've described needs a doctor's opinion first. Your plan is paused. Please book an appointment soon, then come back and confirm, and we'll restart gently. |
| 腰背急症 | 腹股沟或臀部周围发麻、新出现的大小便控制问题，或腿越来越没力气，需要立即去急诊。请不要等待。 | Numbness around the groin or buttocks, new bladder or bowel problems, or legs getting weaker need emergency care now. Please don't wait. |
| 心脏警示 | 请立即停止运动并坐下休息。如果胸口不适或呼吸困难在休息后几分钟内没有缓解，请马上拨打当地急救电话。 | Stop now and sit down. If chest discomfort or breathlessness doesn't ease within a few minutes of rest, call emergency services. |
| 暂停横幅 | 训练计划已暂停，等你确认看过医生后再继续。 | Your plan is paused until you confirm you've seen a health professional. |

- **理由**：语气平静、行动明确；急症与非急症分开，避免用户延误或过度惊慌。
- **证据等级**：C
- **来源**：E05:NICE_NG59（待核实）；E01:FRANK20；E01:Healthline（待核实）

**[redflag.after_clearance]** 【需专业审核】
- **规则**：用户确认就诊后，该部位从注意等级 2、轻到中等强度恢复；如果用户输入了医生的具体建议，以医生建议为准。
- **理由**：就诊后从保守起点恢复，再按 9.5 节的规则逐步进阶。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E05:Riebe2015

---

## 9.7　文案与绝不能做的事

**[caution.copy.labels]**
- **规则**：替换提示用"已为你换成对这个部位更友好的版本"一类说法。禁用词：康复、治疗、疗程、诊断，以及任何病名（如髌股、半月板、椎间盘突出、肩袖撕裂、腱鞘炎）。

| 场景 | 中文 | English |
|---|---|---|
| 已替换 | 已为你换成对这个部位更友好的版本。 | We've swapped in a version that's easier on this area. |
| 腰背 | 保持活动通常比完全休息更有帮助。今天的动作已为你调整过。 | Staying active usually helps more than complete rest. Today's moves have been adjusted for you. |
| 手腕 | 这个动作请握住哑铃或俯卧撑支架来做，让手腕保持笔直。 | Hold dumbbells or push-up handles for this one so your wrists stay straight. |

- **理由**：界面措辞决定用户是否把应用误当成医疗工具。
- **证据等级**：C
- **来源**：E05:NICE_NG59（待核实）；E05:Polovinets2018

**[caution.never]**
- **规则**：应用绝不：
  - 说出诊断名称（如"你是髌股疼痛"）；
  - 把训练称为"康复"或"治疗"；
  - 开具针对某种病症的方案（如麦肯基疗法、离心训练方案）；
  - 建议腰背不适者完全休息；
  - 鼓励用户带着危险信号继续训练；
  - 解读症状原因。
- **理由**：应用不是医疗器械，只做一般训练的保守调整。
- **证据等级**：A
- **来源**：E05:NICE_NG59（2026 更新部分待核实）

---

## 本章来源

- **E05:Bannuru2019**：Bannuru RR, Osani MC, Vaysbrot EE, et al. 2019. OARSI guidelines for the non-surgical management of knee, hip, and polyarticular osteoarthritis. *Osteoarthritis Cartilage* 27:1578–1589.
- **E05:Kolasinski2020**：Kolasinski SL, Neogi T, Hochberg MC, et al. 2020. 2019 ACR/Arthritis Foundation guideline for the management of osteoarthritis of the hand, hip, and knee. *Arthritis Rheumatol* 72(2):220–233.
- **E05:Hartmann2013**：Hartmann H, Wirth K, Klusemann M. 2013. Analysis of the load on the knee joint and vertebral column with changes in squatting depth and weight load. *Sports Med* 43:993–1008.
- **E05:NICE_NG59**：NICE. 2016, updated 2020 and July 2026. Low back pain and sciatica in over 16s (NG59). （待核实：2026 更新内容经二手摘要获得；红旗清单为一般临床共识，未对照原始指南）
- **E05:Somerset**：Somerset D, Pope D. *Rock Solid Resilience*, ch. 8 excerpt（Human Kinetics）。（年份待核实；从业者文本）
- **E05:Polovinets2018**：Polovinets O, Wolf A, Wollstein R. 2018. Force transmission through the wrist during push-ups on a hyperextended and a neutral wrist. *J Hand Ther* 31(3):322–330.
- **E05:Silbernagel2007**：Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J. 2007. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy. *Am J Sports Med* 35(6):897–906.（待核实：疼痛规则经二手摘要确认）
- **E05:Riebe2015**：Riebe D, Franklin BA, Thompson PD, et al. 2015. Updating ACSM's recommendations for exercise preparticipation health screening. *Med Sci Sports Exerc* 47(11):2473–2479.
- **E01:PARQ23**：Warburton D, Jamnik V, Bredin SSD, et al. 2023. The 2023 PAR-Q+ and ePARmed-X+. *Health & Fitness Journal of Canada* 16(1):46–49.
- **E01:FRANK20**：Franklin BA, Thompson PD, Al-Zaiti SS, et al. 2020. Exercise-related acute cardiovascular events… AHA Scientific Statement. *Circulation* 141:e705–e736.
- **E01:Healthline**：Healthline. Problems during exercise: warning signs（引用 AHA）。（待核实：二手来源，需换成 AHA 原始页面）
