# 第 1 章　安全边界与筛查

版本：v0.1（2026-10-14）　｜　机器可读镜像：`rules-ch01.yaml`

本章决定**谁可以直接开始、以什么强度开始、什么情况下必须先找医生、训练中出现什么症状必须立即停止**。本章规则优先级最高（见 `meta.conflict.precedence`）：其他任何章节都不能放宽本章设定的门槛。

总原则：身体活动对绝大多数人是安全的，益处远大于风险；风险主要集中在**不习惯剧烈运动的人突然进行剧烈运动**（E01:FRANK20）。所以筛查的目的不是吓退用户，而是把少数需要专业评估的人分流出去，并让其他人“从低强度开始，慢慢加”。

本章用到的状态字段（引擎内部）：

| 字段 | 取值 | 含义 |
|---|---|---|
| `activity_status` | `active` / `inactive` | 是否已规律运动（定义见 `safety.screen.activity_status`） |
| `clearance_state` | `none_needed` / `required` / `hard_stop` / `confirmed` | 医学许可状态 |
| `max_intensity` | `light_moderate` / `moderate` / `vigorous` | 当前允许的最高强度 |
| `plan_lock` | `true` / `false` | 是否锁定全部训练内容 |

---

## 1.1 适用年龄

**[safety.scope.age_min]**

- **规则：** 用户年龄 < 18 岁时，引擎不生成任何训练计划，只显示 `safety.copy.under_18` 文案；年龄 ≥ 18 岁才进入筛查流程。年龄以出生年月计算，不接受跳过。
- **理由：** 本手册的全部证据与剂量都来自 18 岁及以上成人（证据库范围即为成人），青少年的生长发育、剂量与监护问题不在证据库覆盖之内，不能套用成人规则。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E01:WHO20；E05:Riebe2015（证据库适用范围均为成人）
- **例外/注意：** 不为未成年人提供“简化版”或“家长同意后解锁”的路径，除非将来补充青少年证据并单独成章。

**[safety.copy.under_18]**

- **规则：** 未满 18 岁时显示：
  - 中文：「本应用的训练计划只面向 18 岁及以上的成年人。未满 18 岁的朋友，建议在体育老师、教练或家长的指导下参加适合你年龄的运动。」
  - 英文："Our training plans are designed for adults aged 18 and over. If you're under 18, please exercise with guidance from a PE teacher, coach or parent."
- **理由：** 说明原因并给出去向，避免让用户觉得被拒之门外。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E01:WHO20

---

## 1.2 运动前筛查

### 筛查思路（ACSM 2015）

美国运动医学会（ACSM）2015 年更新的运动前健康筛查不再“数危险因素”，只看三件事（E01:RIEBE15，A）：

1. **现在是否规律运动；**
2. **是否已知有心血管、代谢（1 型 / 2 型糖尿病）或肾脏疾病（简称 CMR 疾病），或有提示这些疾病的体征 / 症状；**
3. **打算做多大强度的运动。**

另外，单纯的肺部疾病不再单独触发转诊；抗阻训练没有足够证据要求单独做正式预筛查（E05:ACE2018，待核实）。

ACSM 的分支可概括为下表（E01:RIEBE15；E01:FRANK20）：

| 人群 | 是否需要医学许可 | 起始强度 |
|---|---|---|
| 不规律运动，无 CMR 疾病，无症状 | 不需要 | 低到中等，逐步过渡到高强度 |
| 不规律运动，已知 CMR 疾病，无症状 | 开始前建议获得许可 | 许可后低到中等 |
| 不规律运动，有任何症状 | 任何运动前都建议获得许可 | 许可后低到中等 |
| 规律运动，无 CMR 疾病，无症状 | 不需要 | 继续中等或高强度，逐步进阶 |
| 规律运动，已知 CMR 疾病，无症状 | 中等强度不需要；高强度前建议获得许可 | 等待期间维持中等 |
| 规律运动，出现新症状 | 需要：停止运动并获得许可 | 许可后恢复 |

### PAR-Q+ 的要点（用我们自己的话）

PAR-Q+（身体活动准备问卷，2023 共识版，现行表格 2024 年 11 月版）是官方的自我筛查工具（E01:PARQ23；E01:PARQ25，A）。它有 7 个是 / 否问题，大意是：

1. 医生是否说过你有心脏问题或高血压；
2. 休息时、日常活动时或运动时是否胸痛；
3. 过去 12 个月是否因头晕失去平衡或失去意识（因呼吸过快导致的头晕除外）；
4. 是否被诊断过其他慢性疾病；
5. 是否在为慢性疾病服用处方药；
6. 现在（或过去 12 个月内）是否有骨骼、关节或软组织问题，可能因活动增加而加重；
7. 医生是否说过你只能在医学监督下运动。

全部为“否”即可开始，循序渐进；任何“是”则进入分病种的追问，追问中仍有“是”的，应先完成 ePARmed-X+ 或咨询合格的运动专业人员。本应用不复刻完整的追问流程，而是**把任何“是”直接视为需要医学许可**（更保守）。

**[safety.screen.parq]**

- **规则：** 生成第一份计划前必须完成入门筛查，不可跳过。问卷包含：(a) 上述 7 个 PAR-Q+ 问题（改写版）；(b) `safety.screen.cmr_symptoms` 的症状清单；(c) 是否怀孕或产后 12 个月内；(d) 当前是否有感冒、发烧等急性不适；(e) 当前活动水平（`safety.screen.activity_status`）；(f) 是否知道自己的静息血压，以及是否 ≥160/90 mmHg。7 题中任一回答“是”，或 (b) 中任一症状为“是”，设 `clearance_state = required`（再按 `safety.clearance.matrix` 细分）。
- **理由：** PAR-Q+ 是现行官方自评工具；追问流程复杂且依赖专业判断，消费级应用直接按“任何是 → 需许可”处理，宁可多转诊。
- **证据等级：** A
- **来源：** E01:PARQ23；E01:PARQ25；E01:RIEBE15；E05:Riebe2015
- **例外/注意：** PAR-Q+ 比 ACSM 更保守，可能让部分人望而却步；文案须强调“大多数人可以安全运动”（见 `safety.copy.disclaimer`）。血压 ≥160/90 或不知道属于 PAR-Q+ 追问中的标记项。

**[safety.screen.activity_status]**

- **规则：** 过去 3 个月以上、每周 ≥3 天、每次 ≥30 分钟有计划的中等强度运动，判定为 `active`；否则为 `inactive`。用户不确定时按 `inactive` 处理。
- **理由：** 这是 ACSM 筛查中“规律运动”的定义；规律运动者在剧烈运动时的相对风险明显更低。
- **证据等级：** A
- **来源：** E01:RIEBE15；E01:OEP（待核实，二手来源）

**[safety.screen.cmr_symptoms]**

- **规则：** 入门问卷与每次复筛都询问以下体征 / 症状，任一为“是”即视为“有症状”：胸部、颈部、下颌或手臂的疼痛或不适；休息或轻微用力时异常气短；头晕或晕厥；平躺时气短或夜间憋醒；脚踝肿胀；心悸或心跳过快；走路时小腿疼、休息后缓解；已知心脏杂音；日常活动中异常疲劳或气短。
- **理由：** 这是 ACSM 用来触发医学许可的体征 / 症状清单；应用只记录“有 / 无”，不解读原因。
- **证据等级：** A
- **来源：** E01:RIEBE15；E01:OEP（待核实，二手来源）；E05:ACE2018（待核实，二手来源）
- **例外/注意：** 清单原文未能直接打开，经两份二手来源确认，与 ACSM 教材一致；上线前以原文核对。

---

## 1.3 需要医生许可的情况

**[safety.clearance.matrix]**

- **规则：** 按以下顺序判定（命中即停）：
  1. 过去 12 个月内胸痛或晕厥 / 失去意识（PAR-Q 第 2、3 题），或当前有任一 CMR 症状 → `hard_stop`（见 `safety.clearance.hard_stop`）。
  2. 已知 CMR 疾病 + `inactive` → `required`，锁定全部训练（`plan_lock = true`），直到用户确认已获许可。
  3. 已知 CMR 疾病 + `active` + 无症状 → `required`，但允许继续中等强度（`max_intensity = moderate`，自觉用力 ≤6/10）；高强度与 HIIT 锁定，直到用户确认已获许可。
  4. PAR-Q 其他“是”（其他慢性病、慢性病用药、骨关节问题、医生要求监督下运动、血压 ≥160/90 或不知道）→ `required`，进入受限模式（`safety.clearance.restricted_mode`）。
  5. 以上都不是 → `none_needed`；`inactive` 用户 `max_intensity = moderate`，`active` 用户 `max_intensity = vigorous`。
- **理由：** 第 2、3、5 步直接对应 ACSM 2015 的分支；第 2 步 ACSM 原文是“建议”获得许可，应用无法核实用户是否真的无症状，因此改为强制锁定，更保守。
- **证据等级：** A
- **来源：** E01:RIEBE15；E01:FRANK20；E05:Riebe2015；E05:ACE2018（待核实）；E01:PARQ23
- **例外/注意：** 怀孕或产后不在此表中判定，转入对应模块（`safety.screen.pregnancy_route`）。

**[safety.clearance.hard_stop]**

- **规则：** `hard_stop` 状态下不生成任何训练计划，显示 `safety.copy.clearance_needed`，直到用户确认已就医并获得许可。默认锁定全部内容（包括轻柔活动度练习）。
- **理由：** 近 12 个月胸痛或晕厥、或当前有心血管相关症状，是证据库中唯一的“硬停止”情形；此时任何运动前都应先接受专业评估。
- **证据等级：** A
- **来源：** E01:RIEBE15；E01:PARQ23
- **例外/注意：** 硬停止期间是否开放轻柔活动度内容，属于产品与专业顾问的待决事项；在决定之前一律锁定。

**[safety.clearance.restricted_mode]**

- **规则：** `clearance_state = required` 且未确认许可时：自觉用力上限 5/10（“能轻松说话”）；排除 `modality` 为 `plyometric`、`power` 的动作，排除 `flags` 含 `jumping`、`valsalva_prone` 的动作；不安排 HIIT、最大用力测试、力竭组；每节课显示「增加强度前，请先咨询医生或合格的运动专业人员」。
- **理由：** 证据库建议需许可者只做低到中等强度（自觉用力约 4–5/10），并屏蔽高强度、间歇、最大用力和跳跃内容；取上端 5，对应“中等”的下限，与 PAR-Q+ 对“是”用户建议的“低到中等强度起步”一致。
- **证据等级：** C（工程选择，方向有 A 级支持）
- **来源：** E01:PARQ23；E01:RIEBE15；E01:CDC-INT
- **例外/注意：** 受限模式的建议起步剂量可参照 PAR-Q+：每周 3–5 天、每次 20–60 分钟低到中等强度的有氧加力量训练，逐步迈向每周 150 分钟。

**[safety.clearance.confirm]**

- **规则：** 用户只能通过“我已咨询医生 / 合格的运动专业人员，并获准进行（选择：中等 / 高强度）运动”的自我声明解除 `required` 或 `hard_stop`；记录声明日期与所获准的强度，`max_intensity` 不超过所声明的强度；声明有效期最长 12 个月。应用任何文案都不得说“应用已为你放行”。
- **理由：** PAR-Q+ 的许可有效期最长 12 个月；应用不是医疗器械，只能记录用户的确认，不能自己给出医学许可。
- **证据等级：** A
- **来源：** E01:PARQ23；E01:PARQ25；E01:RIEBE15
- **例外/注意：** 声明的强度为“中等”时，高强度与 HIIT 继续锁定。

**[safety.copy.clearance_needed]**

- **规则：** `required` 或 `hard_stop` 时显示：
  - 中文：「根据你的回答，开始（或加大）运动前，建议先咨询医生或合格的运动专业人员。这不代表你不能运动——大多数人在专业人士确认后都可以安全地动起来。确认后回到这里，我们会为你安排合适的计划。」
  - 英文："Based on your answers, please check with a doctor or qualified exercise professional before starting or stepping up exercise. This doesn't mean you can't be active—most people can exercise safely once they've been checked. Come back after that and we'll set up a suitable plan."
- **理由：** 说明原因与下一步，避免恐吓式措辞。
- **证据等级：** A
- **来源：** E01:PARQ23；E01:RIEBE15

### 其他分流

**[safety.screen.temporary_illness]**

- **规则：** 用户报告感冒、发烧等急性不适时，进入“暂停 / 休息”模式：不安排训练，不计为缺勤；用户报告恢复后，按停训回归规则恢复（由进阶章节定义）。
- **理由：** PAR-Q+ 建议在暂时性疾病期间推迟增加活动量。
- **证据等级：** A
- **来源：** E01:PARQ23；E01:PARQ25
- **例外/注意：** 恢复后首次训练的具体减量幅度为工程选择，见进阶与停训回归相关章节。

**[safety.copy.illness_pause]**

- **规则：** 进入暂停模式时显示：
  - 中文：「身体不舒服时先好好休息。等感觉恢复了再告诉我们，我们会帮你从合适的强度重新开始。」
  - 英文："Rest up while you're unwell. Let us know when you feel better and we'll help you restart at the right level."
- **理由：** 与 PAR-Q+“暂时性疾病期间推迟增加活动”一致，语气轻松。
- **证据等级：** A
- **来源：** E01:PARQ23

**[safety.screen.pregnancy_route]**

- **规则：** 用户报告怀孕或产后 12 个月内，不使用本章矩阵判定强度，转入孕期 / 产后模块的筛查与门槛；同时提示“与你的医生或助产士确认后再增加运动量”。
- **理由：** PAR-Q+ 要求孕期咨询医疗人员；孕期 / 产后有专门的禁忌证和剂量规则。
- **证据等级：** A
- **来源：** E01:PARQ23；E05:Mottola2019；E05:ACOG804（待核实，二手来源）

**[safety.hypertension.limits]**

- **规则：** 用户报告静息血压 ≥160/90 mmHg、不知道血压、或高血压未控制时，即使已确认许可，也持续执行：排除 `flags` 含 `valsalva_prone` 的动作；抗阻组次数 ≥8 次，自觉用力 ≤7/10；不做静力最大保持。直到用户更新为“已控制”。
- **理由：** 未控制的高血压应避免憋气式大重量用力带来的血压骤升；血压 ≥160/90 或未知是 PAR-Q+ 的追问标记项。
- **证据等级：** C（工程选择，方向有 A 级支持）
- **来源：** E05:Fragala2019（待核实，二手来源）；E01:PARQ23；E05:Riebe2015
- **例外/注意：** 应用不解读血压读数、不建议药物，只做训练限制与就医提示。

---

## 1.4 强度解锁关卡

**[safety.unlock.vigorous]**

- **规则：** `inactive` 用户起始 `max_intensity = moderate`；累计 8 个“规律周”（定义见 `safety.unlock.regular_week`）且期间没有报告任何症状后，`max_intensity` 升为 `vigorous`。`active` 且 `clearance_state = none_needed` 的用户从一开始即为 `vigorous`。任何时候报告新症状，回到 `hard_stop` 判定。HIIT 另有准入条件（见第 8 章 `hiit.gate.unlock`）。
- **理由：** 剧烈运动使心脏事件风险短暂升高，且主要发生在不习惯剧烈运动的人身上；ACSM 要求不活跃者从低到中等开始“逐步”进阶。证据库给出 4–8 周的产品经验值，对不活跃者取上端 8 周。
- **证据等级：** C（工程选择，待教练审核；方向有 A 级支持）
- **来源：** E01:RIEBE15；E01:FRANK20；E01:PAG18
- **例外/注意：** 老年人、孕期、产后模块可设更严格的上限，以更严格者为准。

**[safety.unlock.regular_week]**

- **规则：** 一周同时满足以下条件计为 1 个“规律周”：完成 ≥2 节训练，且完成率 ≥80%（已完成 / 已计划），且没有报告症状。不满足的周不计数但不清零；连续 2 周不满足时，累计数清零。
- **理由：** 解锁需要“持续、无症状的适应”作为依据；证据库没有给出“规律周”的定义，这里按 ACSM“规律运动”的精神设定可执行的门槛。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E01:RIEBE15；E01:OEP（待核实）

**[safety.age45.vigorous_advisory]**

- **规则：** 年龄 ≥45 岁且入门时不习惯高强度运动（`inactive`，或用户回答“从未 / 很少做高强度运动”）的用户，第一次安排高强度、HIIT 或最大用力内容之前，必须显示 `safety.copy.age45_advisory` 并由用户点击确认；未确认则该内容不出现。确认只需一次，复筛时重新询问。
- **理由：** PAR-Q+ 建议 45 岁以上、不习惯剧烈或最大用力运动的人在尝试之前咨询合格的运动专业人员。
- **证据等级：** A
- **来源：** E01:PARQ23；E01:PARQ25

**[safety.copy.age45_advisory]**

- **规则：** 显示：
  - 中文：「接下来的训练强度较高。如果你 45 岁以上、平时很少做这么累的运动，建议先咨询医生或合格的运动专业人员。确认没问题后再继续；感觉不对随时停下。」
  - 英文："The next session is high intensity. If you're over 45 and not used to exercise this hard, we recommend checking with a doctor or qualified exercise professional first. Continue once you're comfortable, and stop any time something feels wrong."
- **理由：** 落实 PAR-Q+ 的 45 岁以上提示，并给出停止的出口。
- **证据等级：** A
- **来源：** E01:PARQ23

**[safety.session.warmup_cooldown]**

- **规则：** 任何中等及以上强度的有氧、HIIT 或循环课，热身与放松各不少于 5 分钟；其余课程的热身与放松时长按第 13 章 `duration.block.warmup_cooldown`，两者取较长者。
- **理由：** 热身与放松是减少运动相关心血管事件的推荐措施之一；5 分钟是惯例取值，原指南只建议做、没有给出时长。
- **证据等级：** C（工程选择；“做热身与放松”有 A 级支持）
- **来源：** E01:FRANK20

---

## 1.5 训练中立即停止的警示症状

**[safety.stop.button]**

- **规则：** 每节训练全程显示“感觉不对”按钮。点击后列出 `safety.copy.stop_symptoms` 中的症状供选择：
  - 选中任一心血管相关症状（胸部压迫 / 疼痛、放射痛、异常气短、头晕或接近晕倒、心悸或心跳不齐、冷汗或恶心）→ 立即结束本节课，显示 `safety.copy.stop_emergency`，设 `plan_lock = true`，直到用户确认“已就医并获得许可”（走 `safety.clearance.confirm`）；
  - 选“其他不适”→ 结束本动作，提示休息，允许用户选择结束本节课；疼痛相关处理见关节注意与疼痛规则章节。
- **理由：** 证据库要求出现这些症状时停止运动并就医；锁定计划可防止用户在未评估前继续训练。
- **证据等级：** A
- **来源：** E01:RIEBE15；E01:FRANK20；E01:Healthline（待核实，二手来源，引用 AHA）；E05:Riebe2015
- **例外/注意：** 应用不判断症状原因，也不提供“症状已缓解可以继续”的选项。

**[safety.copy.stop_symptoms]**

- **规则：** 训练前说明、“感觉不对”按钮及帮助页使用：
  - 中文：「出现以下任何情况，请立即停止训练：胸口发紧、压迫、疼痛或胀满感；疼痛放射到手臂、背部、颈部、下颌或上腹；与用力程度不相称的气短；头晕、眼前发黑或快要晕倒；心慌、心跳不规律或漏跳感；出冷汗或恶心。」
  - 英文："Stop exercising right away if you notice: chest tightness, pressure, pain or fullness; pain spreading to your arm, back, neck, jaw or stomach; shortness of breath out of proportion to the effort; dizziness, light-headedness or feeling faint; a racing, irregular or skipping heartbeat; a cold sweat or nausea."
- **理由：** 让用户在出现症状前就知道哪些信号必须停。
- **证据等级：** A
- **来源：** E01:FRANK20；E01:RIEBE15；E01:Healthline（待核实，二手来源）

**[safety.copy.stop_emergency]**

- **规则：** 用户报告上述症状后显示：
  - 中文：「请立即停止运动，坐下或躺下休息。如果胸部不适持续超过几分钟、休息后不缓解，或出现晕倒，请马上拨打急救电话（中国大陆 120）。在医生确认之前，我们会暂停你的训练计划。」
  - 英文："Stop exercising now and sit or lie down. If chest discomfort lasts more than a few minutes, doesn't ease with rest, or you faint, call your local emergency number right away. We'll pause your training plan until a doctor has checked you."
- **理由：** 胸部不适持续数分钟应按急症处理；明确告诉用户下一步做什么。
- **证据等级：** A
- **来源：** E01:Healthline（待核实，二手来源，引用 AHA）；E01:FRANK20
- **例外/注意：** 急救号码按用户所在地区本地化，中文版默认中国大陆 120，其他地区需产品配置。

**[safety.copy.disclaimer]**

- **规则：** 入门筛查页与设置页显示：
  - 中文：「运动对绝大多数人是安全的，好处远大于风险。本应用提供一般健身指导，不是医疗器械，不能诊断或治疗任何疾病，也不能代替医生的意见。」
  - 英文："Exercise is safe for most people, and the benefits far outweigh the risks. This app offers general fitness guidance. It is not a medical device, can't diagnose or treat any condition, and doesn't replace advice from your doctor."
- **理由：** 既避免恐吓，也清楚交代应用的边界。
- **证据等级：** A
- **来源：** E01:PAG18；E01:UKCMO；E01:RIEBE15

---

## 1.6 复筛

**[safety.rescreen.interval]**

- **规则：** 距上次筛查满 12 个月时，下一次打开应用先完成复筛才能继续训练；此外，用户报告新诊断、新用药、新症状、怀孕或分娩时立即复筛。复筛结果按 `safety.clearance.matrix` 重新判定；自我声明的许可同样在 12 个月后失效。
- **理由：** PAR-Q+ 的许可有效期最长 12 个月，ACSM 对已知疾病者的高强度许可也以近 12 个月为宜；健康状况变化时应重新评估。
- **证据等级：** A
- **来源：** E01:PARQ23；E01:PARQ25；E01:RIEBE15；E05:Riebe2015
- **例外/注意：** 复筛期间不清空训练记录；若复筛结果变为 `required`，按受限模式继续。

---

## 本章证据与取舍说明

| 主题 | 处理 |
|---|---|
| ACSM“建议”许可 vs 应用强制锁定 | 不活跃且有已知 CMR 疾病者，ACSM 为“建议许可”；应用无法核实无症状，改为强制锁定。 |
| PAR-Q 追问流程 | 不复刻分病种追问，任何“是”即需许可，更保守。 |
| 受限模式强度上限 | 证据库给出自觉用力 4–5/10，取 5。 |
| 高强度解锁周数 | 证据库给出 4–8 周（产品经验值），不活跃者取 8 周。 |
| 硬停止期间的内容 | 是否开放轻柔活动度内容待产品与专业顾问决定，暂时全部锁定。 |
| 二手来源 | ACSM 症状清单与“规律运动”定义、AHA 停止症状文案均经二手来源确认，上线前需核对原文。 |

## 本章来源

- **E01:RIEBE15** — Riebe D, Franklin BA, Thompson PD, Garber CE, Whitfield GP, Magal M, Pescatello LS. 2015. Updating ACSM's recommendations for exercise preparticipation health screening. *Med Sci Sports Exerc* 47(11):2473–2479. DOI 10.1249/MSS.0000000000000664.
- **E01:OEP**（待核实，二手来源）— Open Exam Prep. PAR-Q+ and ACSM Preparticipation Screening（用于确认症状清单与“规律运动”定义）。
- **E01:PARQ23** — Warburton D, Jamnik V, Bredin SSD, Shephard RJ, Gledhill N. 2023. The 2023 Physical Activity Readiness Questionnaire for Everyone (PAR-Q+) and electronic Physical Activity Readiness Medical Examination (ePARmed-X+). *Health & Fitness Journal of Canada* 16(1):46–49. DOI 10.14288/hfjc.v16i1.839.
- **E01:PARQ25** — PAR-Q+ Collaboration. PAR-Q+ form, version date 01-11-2024, © 2025（第三方托管的官方表格）。
- **E01:FRANK20** — Franklin BA, Thompson PD, Al-Zaiti SS, et al. 2020. Exercise-related acute cardiovascular events and potential deleterious adaptations following long-term exercise training: placing the risks into perspective. AHA Scientific Statement. *Circulation* 141:e705–e736. DOI 10.1161/CIR.0000000000000749.
- **E01:Healthline**（待核实，二手来源）— Healthline. Problems during exercise: warning signs（引用 AHA）；应以 AHA 原始页面替换。
- **E01:CDC-INT** — CDC. How to Measure Physical Activity Intensity.
- **E01:PAG18** — Piercy KL, Troiano RP, Ballard RM, et al. 2018. The Physical Activity Guidelines for Americans. *JAMA* 320(19):2020–2028；US DHHS. 2018. *Physical Activity Guidelines for Americans*, 2nd ed.
- **E01:UKCMO** — UK Chief Medical Officers. 2019（页面更新于 2026）. UK Chief Medical Officers' Physical Activity Guidelines.
- **E01:WHO20** — Bull FC, Al-Ansari SS, Biddle S, et al. 2020. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462.
- **E05:Riebe2015** — 同 E01:RIEBE15（E05 第 5 节）。
- **E05:ACE2018**（待核实，二手来源）— American Council on Exercise. 2018. New preparticipation guidelines remove barriers to exercise（ACSM 算法的二手总结）。
- **E05:Fragala2019**（待核实，推荐数值来自二手总结）— Fragala MS, Cadore EL, Dorgo S, et al. 2019. Resistance training for older adults: position statement from the National Strength and Conditioning Association. *J Strength Cond Res* 33(8):2019–2052.
- **E05:Mottola2019** — Mottola MF, Davenport MH, Ruchat S-M, et al. 2018/2019. 2019 Canadian guideline for physical activity throughout pregnancy. *Br J Sports Med* 52(21):1339–1346.
- **E05:ACOG804**（待核实，二手来源）— ACOG. 2020. Physical Activity and Exercise During Pregnancy and the Postpartum Period. Committee Opinion No. 804. *Obstet Gynecol* 135(4):e178–e188.
