# 第 12 章　产后

> 机器规则：`rules-ch12.yaml`（24 条，id 一一对应）。条件表达式约定见第 9 章第 0 节。
> **本章全部规则【需专业审核】**（`postpartum.module_end` 除外）：上线前必须由医生、助产士或盆底物理治疗师审核。
> 跑步时间线和准入清单来自英国专家共识指南（Goom 2019），属 C 级。ACOG 804 原文未能打开，凡引用处都标"（待核实）"。

## 本章边界

应用在产后只做三件事：**按分娩方式和时间开放内容、按阶段过滤动作、出现症状时回退并转介**。

应用**不诊断**、**不测量**腹直肌分离（diastasis recti）或盆腔器官脱垂，**不开具**盆底康复方案，**不承诺**"让腹直肌闭合"。

---

## 12.1　准入：分娩方式与时间

**[postpartum.activation]**
- **规则**：用户表示产后（或在孕期模块中报告分娩）时，启用产后模块（population = `postpartum`），询问：产后几周、分娩方式（顺产 `vaginal` / 器械助产 `assisted` / 剖宫产 `caesarean`）、是否有会阴撕裂或损伤、是否已做产后复查、复查时医护是否确认可以运动。
- **理由**：阶段边界和准入条件都取决于这几项信息。
- **证据等级**：C
- **来源**：E05:WHO2020；E05:Goom2019

**[postpartum.gate.pre_check]**
- **规则**：用户确认"产后复查已获准运动"之前，只开放阶段 1 的内容（步行、盆底肌提醒、轻柔活动），并提示先咨询医护。复查时间默认按产后 6 周，用户可按当地情况设为 6–8 周。

| 中文 | English |
|---|---|
| 恭喜你！在正式开始训练前，请先和医生或助产士确认身体恢复情况（通常在产后 6–8 周的复查时）。在那之前，我们只安排步行、盆底肌提醒和轻柔的活动。 | Congratulations! Before starting training, please check your recovery with your doctor or midwife, usually at your 6–8 week postnatal check. Until then, we'll keep to walking, pelvic floor reminders and gentle movement. |

- **理由**：产后复查的时间因国家而异（英国通常 6–8 周；ACOG 主张产后 12 周内持续随访，待核实）。
- **证据等级**：A
- **来源**：E05:WHO2020；E05:ACOG804（待核实）；E05:Goom2019

**[postpartum.gate.clearance]**
- **规则**：阶段 2 及以上，必须先由用户确认"复查时医生或助产士已确认可以开始运动"。未确认时，即使周数已到，也停在阶段 1。

| 中文 | English |
|---|---|
| 产后复查时，医生或助产士是否已经确认你可以开始运动？ | At your postnatal check, did your doctor or midwife confirm you can start exercising? |

- **理由**：恢复情况因人而异，周数只是下限。
- **证据等级**：A
- **来源**：E05:WHO2020；E05:Goom2019

**[postpartum.gate.caesarean]**
- **规则**：剖宫产用户在确认获准前，只开放步行（以及盆底肌提醒），不安排任何其他训练，包括轻柔活动。
- **理由**：WHO 建议剖宫产后先咨询医护再恢复运动。
- **证据等级**：A
- **来源**：E05:WHO2020

---

## 12.2　三阶段模板与缓冲

**[postpartum.phase.boundaries]**
- **规则**：
  - 基础阶段：阶段 1 为产后 0–6 周；阶段 2 为 6–12 周；阶段 3 从 12 周起。
  - 剖宫产或报告会阴损伤：阶段 2 和阶段 3 的起点各推后 4 周（证据范围 2–4 周），即阶段 2 从 10 周起、阶段 3 从 16 周起。
  - 用户当前阶段 = "按周数应处阶段"与"按关卡（是否获准）允许阶段"中较低的那个。
- **理由**：剖宫产的组织愈合会持续到 6 周以后；会阴损伤也是放慢进度的因素。
- **证据等级**：C（4 周缓冲为工程选择，取证据范围上限）
- **来源**：E05:Goom2019；E05:WHO2020
- **例外/注意**：证据库原文为"每个阶段加 2–4 周缓冲"，本引擎理解为各阶段起点整体后移，而不是逐段累加。这一理解需要专业确认。

**[postpartum.phase1]**
- **规则**：阶段 1（0–6 周）只包括：步行；盆底肌提醒；呼吸练习；轻柔活动度练习。动作库中只允许 `walking`，以及 `modality = mobility`、`difficulty = 1`、`impact = 0`、无 `balance_demand` / `high_fall_risk` / `unstable_surface`、不倒立的动作。步行时长按舒适程度逐周增加，不设分钟目标。
- **理由**：专家共识建议产后最初几周以步行、盆底和轻柔核心为主；ACOG 指出盆底训练可在产后立即开始（待核实）。
- **证据等级**：C（不设分钟目标为工程选择）
- **来源**：E05:Goom2019；E05:ACOG804（待核实）；E05:DHSC2022
- **例外/注意**：Goom 的时间线在 2–4 周就提到可考虑深蹲、弓步和臀桥；本引擎在用户确认获准前不安排这些动作，更保守。

**[postpartum.exclude.pre_phase3]**
- **规则**：进入阶段 3 之前，排除：flags 含 `jumping` / `running` / `valsalva_prone` / `heavy_axial_load` / `loaded_spinal_flexion` / `high_fall_risk` / `unstable_surface`；`impact >= 2`；`modality` 为 `plyometric` 或 `power`；以及 `impact = 1` 的有氧循环动作（`walking`、`incline-treadmill-walk`、`stair-climber` 除外）。
- **理由**：恢复跑跳最早约在产后 12 周；憋气大重量和负重屈曲在 12 周前也排除。
- **证据等级**：C
- **来源**：E05:Goom2019
- **例外/注意**：按当前标注排除约 115 个动作。

**[postpartum.phase2]**
- **规则**：阶段 2（6–12 周，须已获准）：
  - 有氧：固定单车 → 椭圆机 → 步行 → 坡度步行；用户确认恶露已停、伤口已愈合后可以游泳（动作库暂缺）。
  - 力量：每周 2 天，自重到轻负荷，`difficulty <= 2`，RIR ≥3。
  - 同时执行 [postpartum.exclude.pre_phase3]。
- **理由**：专家共识建议这一阶段做低冲击有氧和轻负荷力量（6–8 周快走、轻阻力；8–12 周游泳、动感单车）。
- **证据等级**：C（难度上限和 RIR 为工程选择）
- **来源**：E05:Goom2019；E05:WHO2020；E05:DHSC2022

**[postpartum.phase3]**
- **规则**：阶段 3（12 周起，须已获准）：力量训练按通用进阶规则从轻负荷起步，`valsalva_prone` / `heavy_axial_load` / `loaded_spinal_flexion` 解除排除；跑步、跳跃、`impact = 2`、增强式训练和 HIIT 仍锁定，直到通过 [postpartum.running.readiness]。
- **理由**：恢复跑步以功能自测而不只是时间作为门槛。
- **证据等级**：C
- **来源**：E05:Goom2019

---

## 12.3　跑步与高冲击准入清单

**[postpartum.running.readiness]**
- **规则**：
  - 前提：已进入阶段 3。
  - 自测清单全部通过，且过程中没有疼痛、沉重感、下坠感或漏尿：连续步行 30 分钟；单腿站立 10 秒（每侧）；单腿蹲 10 次（每侧）；原地慢跑 1 分钟；向前跳 10 次；单腿跳 10 次（每侧）；交替跨步跳（running man）10 次（每侧）。
  - 通过后解锁 flags 含 `running` / `jumping`、`impact >= 2`、`modality = plyometric` 的动作。
  - 未通过：继续锁定，2 周后再测，并显示盆底物理治疗评估建议。
  - 力量参考目标（不作为门槛）：单腿提踵、单腿臀桥、单腿坐站、侧卧髋外展各约 20 次。
- **理由**：专家共识以产后约 12 周为最早时间，通常 3–6 个月恢复跑步，并用功能自测判断准备情况。
- **证据等级**：C（2 周复测为工程选择）
- **来源**：E05:Goom2019
- **例外/注意**：自测结果由用户自报，应用不判断结果是否"正常"。

**[postpartum.running.copy]**
- **规则**：准入清单文案：

| 场景 | 中文 | English |
|---|---|---|
| 引导 | 想恢复跑步和跳跃？先做下面这几项自测。每一项都要做到不痛、没有下坠或沉重感、没有漏尿，才算通过。 | Want to get back to running and jumping? Try these self-checks first. Each one counts only if there's no pain, no heaviness or dragging, and no leaking. |
| 清单 | 连续步行 30 分钟；单腿站立 10 秒（每侧）；单腿蹲 10 次（每侧）；原地慢跑 1 分钟；向前跳 10 次；单腿跳 10 次（每侧）；交替跨步跳 10 次（每侧） | Walk for 30 minutes; stand on one leg for 10 seconds (each side); single-leg squat 10 times (each side); jog on the spot for 1 minute; jump forward 10 times; hop on one leg 10 times (each side); running man 10 times (each side) |
| 通过 | 全部通过了，可以开始循序渐进地恢复跑步。大多数人在产后 3–6 个月回到跑步。 | You've passed every check, so you can start easing back into running. Most women return to running 3–6 months after birth. |
| 未通过 | 有一项还没通过也很正常。我们先继续力量和低冲击训练，2 周后再试。也可以请盆底物理治疗师帮你看一看。 | It's normal not to pass every check yet. We'll keep going with strength and low-impact work and try again in 2 weeks. A pelvic health physiotherapist can also help. |

- **理由**：把通过标准说清楚，未通过时不制造焦虑。
- **证据等级**：C
- **来源**：E05:Goom2019

**[postpartum.risk_modifiers]**
- **规则**：用户报告以下任一因素时，进阶速度取通用规则范围的下限，并在跑步准入前显示盆底物理治疗评估建议：产后不足 3 个月；剖宫产或会阴损伤；哺乳；BMI >30；睡眠差；关节过度灵活；产前已有盆底或腰盆问题；能量摄入不足；有过度运动的心理驱动。
- **理由**：专家共识认为这些因素会放慢产后恢复。
- **证据等级**：C（具体放慢方式为工程选择）
- **来源**：E05:Goom2019

**[postpartum.breastfeeding]**
- **规则**：哺乳用户显示以下提示：

| 中文 | English |
|---|---|
| 如果你在哺乳，运动前先喂奶或吸奶会更舒服。运动一般不会影响奶量。 | If you're breastfeeding, feeding or expressing before exercise can feel more comfortable. Exercise doesn't usually affect milk supply. |

- **理由**：运动不影响泌乳量；运动前先哺乳可减少不适。
- **证据等级**：A
- **来源**：E05:ACOG804（待核实）

---

## 12.4　症状触发回退

**[postpartum.doming]**
- **规则**：用户报告做腹部动作时肚子中间鼓起（doming）：排除 `primary_pattern = trunk_flexion` 和 flags 含 `loaded_spinal_flexion` 的动作，按顺序换成绳索抗旋推 → 鸟狗式 → 侧卧髋外展，提示"用力时呼气"。界面不得称为"腹直肌分离治疗""修复"或"闭合"。

| 中文 | English |
|---|---|
| 做腹部动作时如果肚子中间鼓起来，我们先换成更温和的版本，用力时记得呼气。也可以请盆底物理治疗师看一看。 | If the middle of your tummy bulges during ab exercises, we'll switch to gentler versions. Breathe out as you push. A pelvic health physiotherapist can also take a look. |

- **理由**：专家共识认为，腹壁功能（能否控制腹压、是否鼓起）比间距宽度更重要。一项 2025 年荟萃分析显示，腹部训练使腹直肌间距比对照多缩小约 0.5 cm，确定性低到中等，临床意义不明。
- **证据等级**：C
- **来源**：E05:Goom2019；E05:Beamish2025（待核实：经二手摘要获得）

**[postpartum.symptom_regression]**
- **规则**：训练中或训练后，用户报告漏尿、沉重感、下坠感、疼痛或出血：
  - 回退一个阶段；
  - 排除 `impact >= 1` 和 flags 含 `valsalva_prone` / `heavy_axial_load` 的动作（步行除外，由阶段白名单保留）；
  - 显示普通警示文案；
  - 在用户确认已看过专业人士，或连续 2 周无症状之前，不自动进阶。
- **理由**：这些症状提示需要专业评估，继续加量可能使情况加重。
- **证据等级**：C（2 周为工程选择）
- **来源**：E05:Goom2019；E05:Woodley2020

**[postpartum.referral_signs]**
- **规则**：在每次阶段转换、跑步准入自测和每周回访时询问：漏尿、漏便或尿急；沉重、压迫、膨出或下坠感；性交痛；排便困难；腹部分离伴鼓起或功能差；腰盆部疼痛；产后 8 周以后与月经无关的阴道出血。任一为"是"：执行 [postpartum.symptom_regression]，并显示普通警示文案。
- **理由**：这些是盆底功能障碍的信号，需要专业评估，不由应用处理。
- **证据等级**：C
- **来源**：E05:Goom2019

**[postpartum.urgent]**
- **规则**：用户报告大量出血、发烧、伤口红肿发热或渗液、小腿疼痛或肿胀、胸痛或呼吸困难：立即结束训练，显示紧急警示文案，暂停全部训练，直到用户确认已就医。
- **理由**：这些情况需要尽快就医。
- **证据等级**：C（清单来自证据库建议文案，待专业核实）
- **来源**：E05:Goom2019；E05:WHO2020；E01:FRANK20

---

## 12.5　警示文案

**[postpartum.copy.warning]**
- **规则**：普通警示（暂停冲击与重负荷，并转介）：

| 场景 | 中文 | English |
|---|---|---|
| 警示 | 漏尿、下坠或沉重感、盆腔或腹部疼痛，或者出血又出现或一直不停，都不是需要硬撑的情况。先暂停跑跳和大重量，并和你的全科医生、助产士或盆底物理治疗师谈一谈。 | Leaking, a feeling of heaviness or dragging, pelvic or tummy pain, or bleeding that comes back or won't stop aren't things to push through. Pause running, jumping and heavy lifting, and speak to your GP, midwife or a pelvic health physiotherapist. |
| 已回退 | 我们已把计划调回上一阶段。等你看过专业人士，或连续 2 周没有这些症状，再继续往前。 | We've moved your plan back a stage. We'll move forward again once you've seen a professional or had 2 weeks without these symptoms. |

- **理由**：明确"不要硬撑"和"找谁"。
- **证据等级**：C
- **来源**：E05:Goom2019

**[postpartum.copy.urgent]**
- **规则**：紧急警示：

| 场景 | 中文 | English |
|---|---|---|
| 紧急 | 大量出血、发烧、伤口红肿发热或渗液、小腿疼痛或肿胀、胸痛或呼吸困难，请尽快就医，不要等待。 | Heavy bleeding, a fever, a wound that's hot, red or oozing, calf pain or swelling, chest pain or breathlessness need prompt medical care. Please don't wait. |
| 胸痛急救 | 如果胸痛或呼吸困难在休息几分钟后仍没有缓解，请立即拨打急救电话。 | If chest pain or breathlessness doesn't ease after a few minutes' rest, call emergency services now. |
| 暂停 | 训练计划已暂停，等你确认看过医生后再继续。 | Your plan is paused until you confirm you've seen a doctor. |

- **理由**：紧急情况必须给出明确行动；胸痛另给急救指引。
- **证据等级**：C
- **来源**：E05:Goom2019；E01:FRANK20；E01:Healthline（待核实）

---

## 12.6　每周目标、盆底与模块结束

**[postpartum.weekly_target]**
- **规则**：每周至少 150 分钟中等强度活动，力量每周 2 天，循序渐进地恢复；分钟目标从阶段 2 起逐步爬升，阶段 1 不设。盆底肌训练尽早开始、每天进行。
- **理由**：WHO 和英国产后指南给出相同的目标，并强调逐步恢复。
- **证据等级**：A（阶段 1 不设目标为工程选择）
- **来源**：E05:WHO2020；E05:DHSC2022

**[postpartum.pelvic_floor]**
- **规则**：从产后尽早开始，每天提醒盆底肌训练；有漏尿时转到 [postpartum.referral_signs]；应用不开具盆底治疗方案。

| 中文 | English |
|---|---|
| 今天记得做盆底肌练习。如果不确定动作对不对，或者有漏尿，请找助产士或盆底物理治疗师帮忙。 | Remember your pelvic floor exercises today. If you're not sure you're doing them right, or you have any leaking, ask a midwife or pelvic health physiotherapist. |

- **理由**：Cochrane 综述显示，产后对已有尿失禁者做盆底训练，6–12 个月时效果不明确（低确定性）。所以提醒是合理的，但漏尿需要专业评估，不由应用处理。
- **证据等级**：B
- **来源**：E05:WHO2020；E05:DHSC2022；E05:Woodley2020；E05:ACOG804（待核实）

**[postpartum.physio_offer]**
- **规则**：从产后 6 周起，显示盆底物理治疗评估建议（不作为准入条件）。

| 中文 | English |
|---|---|
| 产后 6 周起，可以考虑请盆底物理治疗师做一次评估，帮你更放心地恢复训练。 | From 6 weeks after birth, you might consider a pelvic health physiotherapy assessment to help you return to exercise with confidence. |

- **理由**：专家共识建议从 6 周起提供专科盆底评估。
- **证据等级**：C
- **来源**：E05:Goom2019

**[postpartum.module_end]**
- **规则**：产后模块持续到产后 52 周，之后转为通用规则；如果跑步准入从未通过，跑跳锁定继续保留。
- **理由**：英国产后指南覆盖产后 12 个月。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E05:DHSC2022；E05:Goom2019

**[postpartum.never]**
- **规则**：应用绝不：
  - 诊断或"测量"腹直肌分离、盆腔器官脱垂；
  - 开具盆底康复方案；
  - 承诺"让腹直肌闭合"；
  - 把核心训练称为"腹直肌分离治疗"；
  - 鼓励用户带着漏尿、沉重感、疼痛或出血继续训练；
  - 判断自测结果是否"正常"。
- **理由**：这些属于诊断和治疗，超出应用范围。
- **证据等级**：C
- **来源**：E05:Goom2019；E05:Beamish2025（待核实）

---

## 本章来源

- **E05:WHO2020**：Bull FC, et al. 2020. WHO 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462.
- **E05:DHSC2022**：Department of Health and Social Care (UK). 2022, updated 2026. Physical activity for women after childbirth (birth to 12 months): text of the infographic.
- **E05:Goom2019**：Goom T, Donnelly G, Brockwell E. 2019. Returning to running postnatal: guideline for medical, health and fitness professionals managing this population. 自出版指南（专家共识，4 级证据）。
- **E05:ACOG804**：ACOG. 2020. Physical Activity and Exercise During Pregnancy and the Postpartum Period. Committee Opinion No. 804. *Obstet Gynecol* 135(4):e178–e188.（待核实：原文未能打开，经二手摘要获得）
- **E05:Woodley2020**：Woodley SJ, et al. 2020. Pelvic floor muscle training for preventing and treating urinary and faecal incontinence in antenatal and postnatal women. *Cochrane Database Syst Rev* (5):CD007471.
- **E05:Beamish2025**：Beamish NF, Davenport MH, Ali MU, et al. 2025. Impact of postpartum exercise on pelvic floor disorders and diastasis recti abdominis: a systematic review and meta-analysis. *Br J Sports Med* 59(8):562–575.（待核实：经 physiotutors 二手摘要获得；DOI 未核实）
- **E01:FRANK20**：Franklin BA, et al. 2020. AHA Scientific Statement. *Circulation* 141:e705–e736.
- **E01:Healthline**：Healthline. Problems during exercise: warning signs（引用 AHA）。（待核实：二手来源）


## v2 调整：用户确认的无候选环境状态

剖宫产尚未获许可时，仍只允许原步行动作，不扩大医学范围。该动作目录要求large空间；若用户空间不足且完整硬筛选池为空，单列环境受限并说明修改场地条件，不伪造计划、不伪造健康阻断、不计质量通过。此项为2026-10-16用户明确确认的产品状态处理，原医学限制与目录事实均保留。

### v2 澄清（2026-10-17）：阶段1步行与隔天范围
阶段1的轻柔步行采用现有aerobic.intensity.rpe_scale.light_max作为明确处方与门禁上限（source walking_intensity_ref），不另创阈值，也不增加分钟目标。这样邻日范围检查读取真实计划强度，不把缺失RPE猜成低强度；周二、周三均可安排来源允许步行，其他孕产和症状暂停规则保持严格。

### v2 调整：小空间原地慢走（2026-10-17 用户裁定）

- 新增“原地慢走 / Slow walking in place”，固定 ID `83cb6674-515a-52cc-8ff4-b74c33f5da5a`，仅作为未获许可剖宫产用户在原步行不可用时的低强度步行候补。大空间仍优先原 walking；已获许可、其他产后及孕期用户的生成候选保持原样。
- **最低空间为 mat**，兼容 mat / small / medium / large；仅此动作如此标注。全局空间顺序及筛选逻辑不变。原地站立、不向外移动，不衍生转身、侧移、前后跨步、高抬腿、快节奏、负重或手臂负重变式。
- 无必需器械；站姿、无起落地、冲击0、各关节负担不超过1；低强度及产后适用标志，墙或椅背仅为可选支撑。动作模式沿用 walking 的现有 cardio_cyclic 领域映射（locomotion／低强度有氧），不擅自新增与现有合同冲突的枚举。
- 剂量与步行相同。时长、频率、RPE／谈话测试上限、每周进度及本章全部停止信号共用现有来源参数，不新增数值。只允许回到普通步行，不提供更高强度的自动阶梯。
- 已批准动作要领：中文“慢慢原地踏步，脚轻轻离地，膝盖不用抬高，手臂自然摆动。需要的话可以扶着墙或椅背。”英文“Step slowly in place, lifting your feet just off the floor. No need to raise your knees high; let your arms swing naturally. Hold a wall or chair back if you like.”不另加垫子位置等用户文案。
- 一般产后活动依据：[ACOG Exercise After Pregnancy](https://www.acog.org/womens-health/faqs/exercise-after-pregnancy) 与 Opinion804。具体原地动作及适用范围来自本次产品裁定，不宣称ACOG逐项验证本动作。加入 review-queue.csv，教练复核尚待完成。
