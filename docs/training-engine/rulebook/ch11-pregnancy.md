# 第 11 章　孕期

> 机器规则：`rules-ch11.yaml`（26 条，id 一一对应）。条件表达式约定见第 9 章第 0 节。
> **本章全部规则【需专业审核】**：上线前必须由产科医生、助产士或具备资质的孕产运动专业人员审核，包括所有通俗化的禁忌证表述。
> ACOG804已按2026-10-18报告核对；专业审核仍未完成。
> 孕期规则优先于本手册其他章节；冲突时以本章为准。

## 本章边界

没有禁忌证的孕妇，包括孕前不运动的人，都应在整个孕期保持活动。应用的角色是：**设准入关卡、按孕周过滤动作、控制强度、提示停止并联系医护**。

应用**不判断**某种孕期情况是否适合运动，**不解读**症状，**不建议**用运动"催产"或"治疗"妊娠糖尿病。

---

## 11.1　准入关卡

**[pregnancy.activation]**
- **规则**：用户表示怀孕时，启用孕期模块（population = `pregnant`），询问孕周或预产期，然后依次进行医护确认、绝对禁忌证、相对禁忌证三道关卡。孕周未知时，按孕 13 周及以上的规则处理。
- **理由**：多数过滤条件都依赖孕周；孕周不明时按更严格的一档处理。
- **证据等级**：C（孕周未知时的处理为工程选择）
- **来源**：E05:Mottola2018；E01:PARQ23

**[pregnancy.gate.provider]**
- **规则**：先确认正在定期产检，再确认产检医生或助产士没有说过她不适合运动。定期产检回答为否或未知，均不生成新计划。旧版已应用计划缺少新增答案时继续训练并常驻回答入口；下次生成或孕13/28周复查必须回答，其他健康阻断不豁免。
- **理由**：孕期指南把医护人员的意见作为开始或继续运动的前提。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:ACOG804

**[pregnancy.gate.absolute]**
- **规则**：用通俗中文列出以下绝对禁忌证（absolute contraindications），任一为"是"即不生成训练计划，并建议与产检医护沟通：
  1. 破水，或有液体从阴道流出；
  2. 出现早产迹象；
  3. 原因不明、持续的阴道出血；
  4. 孕 26 周以后仍为前置胎盘（placenta praevia）；
  5. 子痫前期（pre-eclampsia）；
  6. 宫颈机能不全；
  7. 胎儿生长受限；
  8. 三胞胎或更多；
  9. 没有控制好的 1 型糖尿病、高血压或甲状腺疾病；
  10. 其他严重的心血管、呼吸或全身性疾病（加拿大指南条目；具体情况由产科医护评估）。
- **理由**：有这些情况时，是否运动必须由产科专业人员判断。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:ACOG650
- **例外/注意**：前置胎盘26周引用 ACOG 650（2015，已被 804 取代），保守保留；胎儿生长受限按加拿大指南作为绝对禁忌。804没有这份绝对/相对禁忌证清单，不将650清单归于804。

**[pregnancy.gate.relative]**
- **规则**：以下相对禁忌证（relative contraindications）任一为"是"：在用户确认医护已同意她在这种情况下运动之前，不生成计划。
  - 加拿大指南：反复流产史；自然早产史；妊娠期高血压；轻到中度心血管或呼吸系统疾病；有症状的贫血；营养不良或进食障碍；孕 28 周以后的双胎妊娠；其他明显的健康问题。
  - ACOG 增补5项：体重明显过低或过高；大量吸烟；控制不佳的癫痫；未经评估的心律失常；骨科方面的限制。来源为 ACOG 650（2015，已被 804 取代），保守保留。
- **理由**：这些情况不一定禁止运动，但需要医护根据个人情况决定。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:ACOG650

**[pregnancy.gate.copy]**
- **规则**：准入页文案（中英文，禁忌证清单见 YAML 中的 `absolute_list_zh/en` 与 `relative_list_zh/en`）。要点：

| 场景 | 中文 | English |
|---|---|---|
| 引导 | 孕期保持活动对大多数准妈妈有好处。不过有些情况需要先听医生或助产士的意见，所以先请你确认几件事。 | Staying active is good for most pregnant women. Some situations need your doctor's or midwife's advice first, so please confirm a few things. |
| 定期产检 | 你现在在定期做产检吗？ | Are you having regular prenatal check-ups? |
| 医护确认 | 你的产检医生或助产士有没有说过你不适合运动？ | Has your doctor or midwife told you not to exercise? |
| 请先确认 | 请先在产检时和医生或助产士聊聊运动的事，确认后回来告诉我们，我们再为你安排。 | Please talk to your doctor or midwife about exercise at a prenatal check-up first. Come back once you have, and we’ll set up your plan. |
| 绝对禁忌为"是" | 根据你的回答，现在不适合由我们为你安排训练。请和你的产检医生或助产士谈一谈，听取适合你的建议。 | Based on your answers, we can't set up a training plan for you right now. Please talk to your doctor or midwife about what's right for you. |
| 相对禁忌为"是" | 你提到的情况需要医生或助产士先确认你可以运动。确认后回来告诉我们，我们再为你安排。 | What you've mentioned needs your doctor or midwife to confirm exercise is okay. Let us know once they have, and we'll set up your plan. |
| 应用边界 | 我们无法判断你的具体情况是否适合运动。到孕 13 周和 28 周时，我们会再请你确认一次。 | We can't judge whether your situation is suitable for exercise. We'll ask you to confirm again at 13 and 28 weeks. |

- **理由**：措辞平静、不吓人，同时不让应用显得在做医学判断（不使用"已获许可"等说法）。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:ACOG804
- **例外/注意**：增补5项标注为“ACOG 650（2015，已被 804 取代），保守保留”，数据与界面均不再显示旧核对标记；专业审核仍未完成。

**[pregnancy.reconfirm]**
- **规则**：在孕 13 周和 28 周重新完成全部关卡；孕 26 周单独再问一次前置胎盘；用户更新健康信息时也重新确认。任一关卡不通过，计划暂停。
- **理由**：孕期情况会变化，需要按孕期阶段重新确认。
- **证据等级**：A（26 周单独询问为工程选择）
- **来源**：E05:Mottola2018；E05:ACOG804

**[pregnancy.precedence]**
- **规则**：模块优先级：孕期 > 关节注意 > 老年人 > 通用。关节注意的替换动作也必须通过孕期过滤。
- **理由**：例如，腰背替换表中的死虫式，在孕 13 周起会被仰卧排除拦下。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E05:Mottola2018

---

## 11.2　排除标记

**[pregnancy.exclude.supine]**
- **规则**：孕 13 周起，排除 position 含 `supine`（仰卧）的动作。
- **理由**：仰卧可能减少回心血量、引起低血压；系统综述认为仰卧运动是否安全的证据不足，纳入研究中有 31% 的急性仰卧运动出现胎心率异常。
- **证据等级**：A
- **来源**：E05:WHO2020；E05:ACOG804；E05:Mottola2018；E05:Mottola2019
- **例外/注意**：WHO 为“孕早期之后”，ACOG804说明孕20周后长时间仰卧的风险，加拿大指南在出现症状时改变体位。本引擎保守取13周；不声称该13周界线来自ACOG804。

**[pregnancy.supine_symptom]**
- **规则**：任何孕周，用户在仰卧时感到头晕、恶心或不适：立即换成侧卧或坐姿，并从此排除仰卧动作。

| 中文 | English |
|---|---|
| 平躺时如果觉得头晕、恶心或不舒服，请马上换成侧躺或坐姿。之后我们不再安排平躺的动作。 | If lying on your back makes you feel lightheaded, sick or unwell, switch to lying on your side or sitting up. We won't schedule lying-on-your-back moves from now on. |

- **理由**：加拿大指南建议出现这些症状时改变体位。
- **证据等级**：A
- **来源**：E05:Mottola2018

**[pregnancy.exclude.prone]**
- **规则**：孕 13 周起，或用户更早表示俯卧不舒服时，排除 position 含 `prone`（俯卧）的动作。
- **理由**：孕肚变大后俯卧会不舒服。
- **证据等级**：C（证据只说"孕肚让俯卧不舒服时"；13 周为工程选择，待专业审核）
- **来源**：E05:Mottola2018
- **例外/注意**：按当前标注排除 48 个动作，包括胸部支撑划船和平板支撑（目录中标为 prone），由 [pregnancy.substitute] 补位。

**[pregnancy.exclude.impact]**
- **规则**：排除 flags 含 `jumping`、`modality = plyometric`、`primary_pattern = jump_land` 的动作。`impact >= 2` 的动作也排除，只有一种例外：跑步类（flag `running`、不含 `jumping`），且用户孕前已规律跑步，并确认"跑起来舒适，医护也同意"。
- **理由**：孕前已经跑步的人，在医护同意下可以继续跑步；孕前不活动的人不宜从高冲击开始。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:ACOG804
- **例外/注意**：证据只要求孕前不活动者排除增强式训练；本引擎对所有孕妇排除跳跃，更保守。

**[pregnancy.exclude.fall_risk]**
- **规则**：整个孕期排除 flags 含 `high_fall_risk` / `unstable_surface` 和 position 含 `inverted` 的动作；孕 13–27 周，`balance_demand` 动作只在显示"扶墙或扶椅"提示时使用；孕 28 周起排除 `balance_demand`。
- **理由**：指南建议避开跌倒风险高的活动；随着孕期推进，平衡能力会变化。
- **证据等级**：A（13 周和 28 周这两个分界为工程选择，证据只说"后期"）
- **来源**：E05:Mottola2018；E05:ACOG804

**[pregnancy.exclude.valsalva]**
- **规则**：排除 flags 含 `valsalva_prone` / `heavy_axial_load` 的动作；力量训练 RIR ≥3；提示"用力时呼气，不要憋气"。
- **理由**：避免接近极限的重量和憋气发力。
- **证据等级**：C（证据库没有找到指南级证据，属预防性共识；RIR ≥3 为工程选择）
- **来源**：E05:Mottola2018

**[pregnancy.exclude.abdominal_flexion]**
- **规则**：孕 13 周起，排除 `primary_pattern = trunk_flexion`（卷腹、仰卧起坐、举腿等）和 flags 含 `loaded_spinal_flexion` 的动作。
- **理由**：孕早期之后不做完整的仰卧起坐或卷腹，与仰卧排除一致。
- **证据等级**：C
- **来源**：E05:WHO2020；E05:Mottola2018

**[pregnancy.substitute]**
- **规则**：被排除的动作按以下顺序替换（取第一个用户有器材且通过全部过滤的）：
  - 仰卧推：上斜哑铃推 → 史密斯上斜卧推 → 器械推胸；
  - 俯卧划船：单臂坐姿绳索划船 → 坐姿绳索划船；
  - 卷腹类：绳索抗旋推（Pallof press）→ 侧桥 → 鸟狗式；
  - 仰卧或俯卧的核心：绳索抗旋推 → 鸟狗式 → 扶墙俯卧撑；
  - 仰卧臀桥类：坐姿臀推器械 → 弹力带罗马尼亚硬拉 → 壶铃硬拉；
  - 俯卧腿弯举：坐姿腿弯举；
  - 仰卧拉伸：坐姿前屈 → 凳上 4 字拉伸。
- **理由**：用上斜、坐姿、侧卧或站姿版本，保留同一动作模式。
- **证据等级**：C
- **来源**：E05:Mottola2018；E05:WHO2020
- **例外/注意**：动作库暂缺靠墙或上斜死虫式、上斜平板支撑。

---

## 11.3　强度上限与每周目标

**[pregnancy.intensity]**
- **规则**：强度上限为中等：能说话但不能唱歌（谈话测试，talk test），0–10 自觉强度 5–6，约等于 6–20 博格量表（Borg RPE）的 13–14；力量训练 RIR ≥3。
- **理由**：孕期指南用谈话测试和中等自觉强度把关；高强度只建议在有监测的环境中进行。
- **证据等级**：A（RIR ≥3 为工程选择）
- **来源**：E05:Mottola2018；E05:ACOG804；E01:CDC-INT

**[pregnancy.hiit]**
- **v2 澄清（2026-10-17 用户裁定，覆盖下文旧解锁说明）**：本版本孕期不提供高强度间歇训练。孕前已有规律高强度训练的用户，可在医护同意下自行安排；应用内提供中等强度的有氧和力量训练。
- This version doesn’t offer high-intensity interval training during pregnancy. If you trained at high intensity regularly before pregnancy, you can arrange it yourself with your care provider’s approval; the app provides moderate-intensity cardio and strength training.
- `pregnancy.hiit` 标记 `deferred: true`、分级 `mechanic`；v1 不实现，见 v2 澄清。不参与生成或校验；`hiit.gate.unlock` 的孕期锁定仍属硬规则。仅当已有画像勾选了孕前规律高强度时可提示一次，占用三条提示中的一条；没有既有入口时不新增入口、不显示此提示。
- **规则**：高强度间歇训练（HIIT）默认锁定。只有在用户孕前有规律的高强度训练、并确认医护同意她做较高强度时才解锁；解锁后每段用力 ≤30 秒，恢复到能通过谈话测试再开始下一段，每周最多 1 次。
- **理由**：证据允许孕前有训练基础、且经医护同意的人做短间歇，但须在每段之间满足谈话测试。
- **证据等级**：C（30 秒和每周 1 次为工程选择，证据只说"短间歇"）
- **来源**：E05:Mottola2018；E05:ACOG804

**[pregnancy.week.target]**
- **规则**：每周至少 150 分钟中等强度活动，分布在至少 3 天，鼓励每天都活动；有氧与力量结合，力量默认每周 2 天；孕前不活动的人从低于目标的量开始，逐步增加。
- **理由**：孕期指南建议规律的中等强度活动；ACOG 建议大多数日子活动 20–30 分钟。
- **证据等级**：A（力量 2 天沿用成人通用规则）
- **来源**：E05:Mottola2018；E05:WHO2020；E05:ACOG804；E01:WHO20

**[pregnancy.pelvic_floor]**
- **规则**：每天提醒一次盆底肌训练（pelvic floor muscle training）；应用不教技术，请用户向专业人士学习。

| 中文 | English |
|---|---|
| 今天别忘了做盆底肌练习。如果还不确定怎么做，可以请产检医生、助产士或盆底物理治疗师教你。 | Remember your pelvic floor exercises today. If you're not sure how to do them, ask your doctor, midwife or a pelvic health physiotherapist to show you. |

- **理由**：指南建议每天做盆底肌训练；Cochrane 综述显示，原本没有尿失禁的孕妇做产前盆底训练，孕晚期尿失禁风险可能降低（RR 0.38，中等确定性）。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:WHO2020；E05:Woodley2020

**[pregnancy.environment]**
- **规则**：永不安排：高温瑜伽、高温普拉提、身体对抗类运动、跌倒或腹部撞击风险高的运动（越野骑行、骑马、滑雪、体操）、潜水、跳伞。炎热或潮湿天气显示防暑和补水提示；未适应的高海拔地区不做剧烈运动。

| 场景 | 中文 | English |
|---|---|---|
| 炎热 | 天气炎热或潮湿时，请选择凉爽通风的地方运动，穿宽松透气的衣服，随时补水。觉得太热或不舒服就停下来休息。 | In hot or humid weather, exercise somewhere cool and well ventilated, wear loose, breathable clothing, and drink regularly. If you feel too hot or unwell, stop and rest. |
| 高海拔 | 在还没适应的高海拔地区（约 1,800 米以上），请不要做剧烈运动。 | Avoid strenuous exercise above about 1,800 metres if you’re not used to the altitude. |

- **理由**：孕期指南明确列出这些需要避开的活动和环境。动作库没有对应字段，所以用内容黑名单加环境提示实现。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:ACOG804；E05:ACOG-FAQ119（跳伞、高温瑜伽/普拉提）

---

## 11.4　停止信号

**[pregnancy.stop.trigger]**
- **规则**：训练中或训练后出现以下任一情况：立即结束训练，显示停止文案，暂停全部训练，直到用户确认已联系医护：
  - 阴道出血；
  - 规律的疼痛宫缩；
  - 阴道流液；
  - 休息后仍不缓解的气促，或运动前就呼吸费力；
  - 胸痛（同时显示急救文案）；
  - 头晕或要晕倒；
  - 头痛；
  - 影响平衡的肌肉无力；
  - 小腿疼痛或肿胀；
  - 腹痛。
- **理由**：这些是孕期指南列出的"停止并就医"信号。应用不解读原因，只负责停止和转介。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:ACOG804；E01:FRANK20

**[pregnancy.stop.copy]**
- **规则**：停止文案：

| 场景 | 中文 | English |
|---|---|---|
| 停止 | 请现在停止运动，并联系你的产检医生或助产士，如果你出现：阴道出血、有液体流出、规律的疼痛宫缩、胸痛、头晕或要晕倒、运动前就呼吸费力或休息后仍气喘、头痛、小腿疼痛或肿胀、腹痛，或者腿没力气、站不稳。 | Stop exercising now and contact your doctor or midwife if you have vaginal bleeding, fluid leaking, regular painful contractions, chest pain, dizziness or feeling faint, breathlessness before exercise or that doesn't ease afterwards, a headache, calf pain or swelling, tummy pain, or weakness that affects your balance. |
| 胸痛急救 | 如果胸痛或呼吸困难在休息几分钟后仍没有缓解，请立即拨打急救电话。 | If chest pain or breathlessness doesn't ease after a few minutes' rest, call emergency services now. |
| 暂停 | 训练计划先暂停。联系过医生或助产士后回来确认，你的计划会一直保留。 | Your plan is paused. Once you've spoken to your doctor or midwife, come back and confirm. Your plan will be waiting. |

- **理由**：一句话说清"停下、联系谁"；胸痛另给急救指引。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:ACOG804；E01:FRANK20；E01:Healthline（待核实）

---

## 11.5　绝不能做的事与模块切换

**[pregnancy.never]**
- **规则**：应用绝不：
  - 判断某种孕期并发症是否适合运动；
  - 解读症状；
  - 建议用运动"催产"或"治疗"妊娠糖尿病；
  - 在用户完成准入关卡前生成计划；
  - 在出现停止信号后鼓励继续；
  - 使用暗示应用给出医学许可的措辞。
- **理由**：这些都属于产科医疗判断。
- **证据等级**：A
- **来源**：E05:Mottola2018；E05:ACOG804

**[pregnancy.end]**
- **规则**：用户报告已分娩时，切换到第 12 章产后模块，产后周数从 0 开始，并询问分娩方式。
- **理由**：产后有独立的准入与分阶段规则。
- **证据等级**：C
- **来源**：E05:WHO2020；E05:Goom2019

---

## 本章来源

- **E05:Mottola2018**：Mottola MF, Davenport MH, Ruchat S-M, et al. 2018/2019. 2019 Canadian guideline for physical activity throughout pregnancy. *Br J Sports Med* 52(21):1339–1346；同时刊于 *J Obstet Gynaecol Can* 40(11):1549–1559。
- **E05:Mottola2019**：Mottola MF, Nagpal TS, Bgeginski R, et al. 2019. Is supine exercise associated with adverse maternal and fetal outcomes? A systematic review. *Br J Sports Med* 53(2):82–89.
- **E05:ACOG804**：American College of Obstetricians and Gynecologists. 2020. Physical Activity and Exercise During Pregnancy and the Postpartum Period. Committee Opinion No. 804. *Obstet Gynecol* 135(4):e178–e188.（已按2026-10-18报告核对）
- **E05:WHO2020 / E01:WHO20**：Bull FC, et al. 2020. WHO 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462.
- **E05:Woodley2020**：Woodley SJ, Lawrenson P, Boyle R, et al. 2020. Pelvic floor muscle training for preventing and treating urinary and faecal incontinence in antenatal and postnatal women. *Cochrane Database Syst Rev* (5):CD007471.
- **E05:Goom2019**：Goom T, Donnelly G, Brockwell E. 2019. Returning to running postnatal: guideline for medical, health and fitness professionals.
- **E01:PARQ23**：Warburton D, et al. 2023. The 2023 PAR-Q+ and ePARmed-X+.
- **E01:CDC-INT**：CDC. How to Measure Physical Activity Intensity.
- **E01:FRANK20**：Franklin BA, et al. 2020. AHA Scientific Statement. *Circulation* 141:e705–e736.
- **E01:Healthline**：Healthline. Problems during exercise: warning signs（引用 AHA）。（待核实：二手来源）

### 2026-10-18 来源澄清

- **E05:ACOG650**：ACOG Committee Opinion No.650（2015，已被804取代）；前置胎盘26周及增补5项保守保留，不归为804原文清单。
- **E05:ACOG-FAQ119**：[Exercise During Pregnancy](https://www.acog.org/womens-health/faqs/exercise-during-pregnancy)，用于跳伞、高温瑜伽/普拉提、头晕停止及环境提醒。
- 对外表述为“参考 ACOG 等指南，采取更保守的做法”。本次核对不是持证专业审核，不能替代第11–12章的专业审核。

### ACOG核对后的规则数据调整（2026-10-18）

- `pregnancy.gate.provider`先问“你现在在定期做产检吗？”，再问原医护是否禁止运动的问题。未确认定期产检时，不生成计划，使用已批准的`ask_provider`文案；旧记录不自动推定答案。
- `pregnancy.week.target.previously_inactive`：基线实测首周29、29、28分钟，超过15分钟。因此按用户批准的产品参数，首周每次约10分钟、每周增加5分钟、直到30分钟；以训练周数计算，并且不超过用户预留时间。这组具体参数是本次产品裁定，不声称FAQ119原文规定首周10分钟。
- `pregnancy.intensity.static_standing`：孕期静态站立保持类动作单组最多60秒。步行、踏步等动态有氧不套此静态上限；其他更低剂量上限仍优先。
- `pregnancy.copy.long_session`：按实际单次课时长严格超过45分钟显示进食及补水提示，45分钟整不触发。
- 用户已批准四项最小接线，不重构引擎流程；数值和文案仍由规则数据决定。产检字段缺失保持未知，已应用旧计划只读继续、不自动进阶，下次生成或13/28周重新确认必须作答；其他健康阻断不豁免。递增剂量按新方案首次采用时刻起算，不用孕前既有训练记录当作递增周数。备份保留新答案及起算时刻，旧备份不补造答案。
