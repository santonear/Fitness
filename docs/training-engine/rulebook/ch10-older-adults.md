# 第 10 章　老年人（65 岁及以上）

> 机器规则：`rules-ch10.yaml`（26 条，id 一一对应）。条件表达式约定见第 9 章第 0 节。
> 标「【需专业审核】」的规则和文案，上线前必须由医生、物理治疗师或具备资质的运动专业人员审核。来源后标「（待核实）」的，只通过二手摘要获得，需对照原文。
> 特别说明：本章力量剂量的具体数字来自 NSCA 立场声明（Fragala 2019）的**二手摘要**，全文未打开，因此全部标为待核实。

## 本章边界

本章叠加在通用规则之上。年满 65 岁自动启用，用户也可以主动开启。与第 9 章（关节注意）同时命中时，排除条件取并集。

应用**不评估**跌倒风险，**不提供**"防跌倒治疗"，也**不告诉**有骨质疏松或骨折史的用户哪种负荷"安全"。跌倒相关问题只用来选择更稳妥的训练模板。

---

## 10.1　启用与筛查

**[older.activation]**
- **规则**：年龄 ≥65 岁，或用户主动开启时，启用老年人模块（population = `older_adult`）。
- **理由**：WHO 对 65 岁及以上人群单独给出多组分训练和平衡训练建议。
- **证据等级**：A
- **来源**：E05:WHO2020；E01:WHO20

**[older.screen.general]**
- **规则**：生成第一份计划前，先完成通用的 PAR-Q+ 式筛查问答（运动前健康筛查），再进入跌倒相关问题。
- **理由**：通用筛查覆盖心血管、代谢、肾脏疾病和相关症状，对所有年龄都适用。
- **证据等级**：A
- **来源**：E05:Riebe2015；E01:PARQ23

**[older.screen.falls]** 【需专业审核】
- **规则**：额外询问 4 个是/否问题：过去 12 个月是否跌倒过、是否担心跌倒、是否经常头晕或站不稳、是否使用助行工具。任一为"是"，启用"平衡谨慎"档案（`balance_cautious`）；使用助行工具的，同时记 `walking_aid`。不计算风险分。
- **理由**：跌倒史、对跌倒的担心和头晕，提示平衡练习需要从有支撑的版本开始。应用不做临床评估，只据此选模板。
- **证据等级**：C（问答为工程选择）
- **来源**：E05:WHO2020；E05:Sherrington2019；E05:Fragala2019（待核实）

**[older.screen.copy]** 【需专业审核】
- **规则**：问答文案：

| 场景 | 中文 | English |
|---|---|---|
| 引导 | 为了把平衡练习安排得更稳妥，想先问你 4 个简单的问题。 | To set up your balance work safely, we have 4 quick questions. |
| 问 1 | 过去 12 个月里，你摔倒过吗？ | Have you had a fall in the past 12 months? |
| 问 2 | 你平时会担心自己摔倒吗？ | Do you worry about falling? |
| 问 3 | 你经常感到头晕或站不稳吗？ | Do you often feel dizzy or unsteady? |
| 问 4 | 你平时走路会用手杖、助行器等辅助工具吗？ | Do you use a stick, frame or other walking aid? |
| 任一"是" | 谢谢。我们会从有扶手支撑的平衡练习开始，一步步来。 | Thanks. We'll start your balance work with something to hold on to and build up step by step. |

- **理由**：语气平和，不出现"跌倒风险高"之类的判断。
- **证据等级**：C
- **来源**：E05:Sherrington2019

**[older.hypertension]**
- **规则**：用户报告高血压未控制或不清楚时：排除 flags 含 `valsalva_prone`（憋气发力）的动作；每组不少于 8 次；力量与静力保持的自觉强度 ≤7/10；提示"用力时呼气，不要憋气"。
- **理由**：高血压未控制时，应避免憋气用力引起的血压骤升。
- **证据等级**：C（具体上限为工程选择）
- **来源**：E05:Fragala2019（待核实）；E05:Riebe2015
- **例外/注意**：按当前标注排除 39 个动作。

---

## 10.2　每周目标：有氧、力量、平衡（多组分）

**[older.week.aerobic]**
- **规则**：每周中等强度 150–300 分钟，或较大强度 75–150 分钟，或两者等量组合；1 分钟较大强度按 2 分钟中等强度计。
- **理由**：老年人的有氧目标与 18–64 岁成人相同。新手按通用规则从低于目标处起步。
- **证据等级**：A
- **来源**：E05:WHO2020；E01:WHO20；E01:PAG18

**[older.week.strength]**
- **规则**：每周 2–3 天力量训练（默认 2 天），中等或以上强度，覆盖全部主要肌群。
- **理由**：WHO 建议每周至少 2 天；NSCA 建议 2–3 天。
- **证据等级**：A
- **来源**：E05:WHO2020；E05:Fragala2019（待核实）

**[older.week.multicomponent]**
- **规则**：每周至少 3 天含平衡与功能性力量的多组分训练（multicomponent training）。可以与力量课合并，默认在力量课最后加 10 分钟平衡练习；力量课少于 3 天时，补单独的平衡短课。
- **理由**：WHO 建议每周至少 3 天多组分训练，以改善功能、预防跌倒；UK 为至少 2 天。取更高的 3 天。
- **证据等级**：A（10 分钟为工程选择，WHO 未规定时长）
- **来源**：E05:WHO2020；E01:WHO20；E01:UKCMO

**[older.week.flexibility]**
- **规则**：每周至少 2 天拉伸，每个肌群累计约 60 秒，放在整理活动（cooldown）中。
- **理由**：ACSM 建议老年人的训练包含有氧、力量和柔韧；UK 也把柔韧列入老年人建议。60 秒取自成人通用建议。
- **证据等级**：A
- **来源**：E05:Chodzko2009（待核实：只看了摘要，老年人分项细节未核实）；E01:UKCMO；E01:GARBER11

**[older.template.balance_required]**
- **规则**：凡含力量训练的老年人模板，平衡/功能训练少于每周 3 天的一律不予采用。目标为"预防跌倒"时，模板必须同时含平衡/功能训练和抗阻训练。
- **理由**：Cochrane 综述显示：平衡与功能训练约减少 24% 的跌倒，多种类型组合约减少 34%；单纯力量训练的证据不足。
- **证据等级**：B
- **来源**：E05:Sherrington2019

**[older.program_horizon]**
- **规则**：老年人训练计划以至少 12 周为一个周期，在第 4、8、12 周显示鼓励文案。
- **理由**：最有效的项目多持续 12 周以上。
- **证据等级**：B（里程碑周次为工程选择）
- **来源**：E05:Sherrington2019

**[older.intensity.aerobic]**
- **规则**：中等强度 = 0–10 自觉强度（RPE）5–6、能说话但不能唱歌；较大强度 = 7–8、只能说几个字。强度相对于本人体能。用户报告服用 β 受体阻滞剂或有心脏病时，不显示心率目标。
- **理由**：谈话测试和自觉强度不需要设备；年龄推算的最大心率个体误差大，且不适用于服用 β 受体阻滞剂的人。
- **证据等级**：A
- **来源**：E01:CDC-INT；E01:PAG18；E01:TANAKA01

---

## 10.3　力量剂量与进阶

**[older.strength.dose]**
- **规则**：每个动作 1–3 组（新手可 1 组）；每次全身课 8–10 个动作，时间不够时按时长截断；起步期每组 10–15 次、自觉强度 5–6/10，之后可进到 6–12 次；离力竭次数（RIR）≥2，不练到力竭。
- **理由**：中等负荷对老年人通常已经足够，练到力竭没有必要。
- **证据等级**：A
- **来源**：E05:Fragala2019（待核实）
- **例外/注意**：RIR ≥2 为工程选择，待教练审核。

**[older.strength.progression]**
- **规则**：起步期 4 周（证据范围 2–4 周）后，才从 10–15 次转到 6–12 次；每次加重不超过 5%（证据范围 5–10%）；加重前须以 RIR ≥2 完成目标次数。
- **理由**：小步加重，减少因负荷过大或技术不佳导致的受伤；老年人受伤多与此有关。
- **证据等级**：A（取证据范围的保守端）
- **来源**：E05:Fragala2019（待核实）

**[older.strength.low_start]**
- **规则**：平衡谨慎档案、使用助行工具或目前不活动的用户：从每个动作 1 组、最轻负荷、自觉强度 ≤5/10 开始；连续 2 周无症状后每个动作加 1 组，逐步到 3 组 × 8–12 次。优先器械、弹力带和坐姿动作，并包含坐站转换（sit-to-stand）这类功能动作。
- **理由**：体弱的老年人应从很轻的负荷开始，再逐步增加到 3 组 × 8–12 次；器械是合理的起点。
- **证据等级**：A
- **来源**：E05:Fragala2019（待核实）
- **例外/注意**：自觉强度上限和加组节奏为工程选择。应用无法判断"体弱"，这里只按用户自述分组。动作库暂缺坐站转换，已记入 `catalog_gaps`。

---

## 10.4　排除标记与平衡训练

**[older.exclude.base]**
- **规则**：所有老年用户排除：flags 含 `high_fall_risk` / `jumping`；`modality` 为 `plyometric` 或 `power`；`primary_pattern` 为 `jump_land` 或 `olympic`；use 含 `skill`。默认低冲击（排除 `impact >= 2`）；不在平衡谨慎档案中的用户可以关闭低冲击。
- **理由**：默认不安排跳跃；闭眼平衡、不稳定面上单腿站和增强式落地都属于高跌倒风险动作。
- **证据等级**：C
- **来源**：E05:Fragala2019（待核实）；E05:Sherrington2019；E01:PAG18
- **例外/注意**：按当前标注排除 61 个动作；低冲击另排除 8 个。

**[older.exclude.balance_cautious]** 【需专业审核】
- **规则**：平衡谨慎档案另外排除：flags 含 `unstable_surface` / `running` / `high_fall_risk`、`impact >= 2`，以及没有扶墙或扶椅版本的 `balance_demand` 动作；保留的 `balance_demand` 动作一律显示"扶墙或扶椅"提示。
- **理由**：有跌倒史、担心跌倒或头晕的人，平衡练习应从有支撑的版本开始。
- **证据等级**：C
- **来源**：E05:Fragala2019（待核实）；E05:Sherrington2019
- **例外/注意**：按当前标注约排除 81 个动作。

**家居支撑物 — v2 调整**

平衡动作的家居支撑物默认值见 [environment.household_support]。三个既有支撑平衡动作可用稳固椅背或稳固桌边、台面代替持续轻扶的墙面；仍需通过原有的人群、关节、体位、噪声与空间筛选。可扶物开关与空间大小独立，`mat` 不代表没有支撑物；户外只按实际登记器械或用户显式开启的开关判断。未修改任何老年平衡排除条件、动作难度或剂量上限。

**[older.balance.progression]**
- **规则**：平衡训练（动作模式 `balance`）分 3 级：
  - 第 1 级：宽站距、静态、手扶支撑；
  - 第 2 级：窄站距或前后脚站，可以动态，手扶支撑；
  - 第 3 级：窄站距或单腿，去掉手部支撑。
  - 连续 2 次训练没有失衡（没有踉跄、没有临时抓扶）才升一级；本次出现失衡则降一级。平衡谨慎档案最高停在第 2 级。永不安排闭眼平衡或不稳定面平衡。
- **理由**：先静态后动态、先宽后窄、最后去掉支撑；能安全挑战平衡的项目效果最好。
- **证据等级**：C（升降级条件为工程选择）
- **来源**：E05:Sherrington2019；E05:Fragala2019（待核实）
- **例外/注意**：动作库目前没有标为 `balance` 模式的动作，需要补充标注（如扶椅单腿站、前后脚站、平衡步行）。

---

## 10.5　爆发力训练准入

**[older.power.gate]** 【需专业审核】
- **规则**：
  - 准入：规律训练 ≥6 周、最近 6 周完成计划课次 ≥80%、且没有报告任何警示症状。
  - 方式：负荷为当前正式负荷的 40–60%，提示"快起、慢放"；只从 `modality = strength`、`difficulty <= 2`、坐姿或站姿、无 `balance_demand` / `unstable_surface` / `high_fall_risk` / `overhead_load` / `jumping` 的动作中选择；优先顺序为坐姿器械 → 弹力带 → 坐姿自由重量 → 箱式深蹲快速站起。
  - 平衡谨慎档案只用坐姿版本。组数与次数沿用 [older.strength.dose]。不安排任何跳跃。
- **理由**：爆发力训练适合在基础力量稳定之后加入，宜用轻负荷、快速向心的方式。
- **证据等级**：A（6 周取证据 4–6 周的上限）
- **来源**：E05:Fragala2019（待核实：负荷和速度的数字来自二手摘要，各来源说法不一）
- **例外/注意**：80% 完成率和动作筛选条件为工程选择，待教练审核。

---

## 10.6　起身与地面动作

**[older.floor.transitions]**
- **规则**：
  - "地面动作"定义为：position 含 `supine` / `prone` / `side_lying` / `quadruped` / `kneeling`，且 `space = mat`，且 position 不含 `standing` / `seated`。
  - 平衡谨慎档案或使用助行工具的用户：排除地面动作，改用坐姿、站姿或卧推凳上的版本。
  - 其他老年用户：地面动作集中安排，每节课最多下地一次，并提示"扶着椅子慢慢下、慢慢起"。
- **理由**：反复上下地面本身就是失衡和头晕的风险点。
- **证据等级**：C（工程选择，待教练审核）
- **来源**：E05:Sherrington2019；E05:Fragala2019（待核实）
- **例外/注意**：按当前标注约 115 个动作属于地面动作。建议在标注标准中新增 flag `floor_transition`，以免靠 `space` 间接判断。应用不教授"跌倒后如何起身"等干预内容。

**[older.floor.copy]**
- **规则**：地面动作提示文案：

| 场景 | 中文 | English |
|---|---|---|
| 下地前 | 接下来几个动作在垫子上做。请扶着椅子慢慢下去，做完再扶着椅子慢慢起来，不用着急。 | The next few moves are on the mat. Use a chair to lower yourself down slowly, and use it again to get up when you're done. Take your time. |
| 起身后 | 起身后先站稳几秒，没有头晕再继续。 | Once you're up, stand still for a few seconds and carry on only if you don't feel dizzy. |

- **理由**：动作提示只为安全过渡，不属于跌倒干预。
- **证据等级**：C
- **来源**：E05:Sherrington2019

---

## 10.7　骨骼健康与停训回归

**[older.bone]** 【需专业审核】
- **规则**：用户报告骨质疏松或骨折史时，设"需医疗许可"。在用户确认已咨询专业人士前，排除 flags 含 `loaded_spinal_flexion` / `loaded_spinal_rotation` / `heavy_axial_load` / `jumping` / `high_fall_risk` 的动作和 `impact >= 2` 的动作。应用不告诉用户哪种负荷"安全"。

| 中文 | English |
|---|---|
| 骨质疏松或骨折史需要专业人士帮你判断适合的负荷。在你确认已咨询医生或物理治疗师之前，我们会先避开负重弯腰、负重扭转、大重量和跳跃类动作。 | With osteoporosis or a past fracture, a health professional should advise on suitable loads. Until you confirm you've spoken to a doctor or physiotherapist, we'll leave out loaded bending, loaded twisting, heavy lifts and jumping. |

- **理由**：PAR-Q+ 把近期骨折和骨质疏松性骨折列为需要进一步评估的情况；具体负荷属于专业判断。
- **证据等级**：C（排除清单为工程选择）
- **来源**：E05:Fragala2019（待核实）；E01:PARQ23

**[older.return_after_break]**
- **规则**：老年用户的停训回归分档阈值减半：短停训 ≤2 周；中停训 2–6 周；长停训 >6 周。各档的负荷与容量回退比例沿用通用的停训回归规则。
- **理由**：停训后老年人的力量损失比年轻人大（效应量约 0.76 对 0.31）。
- **证据等级**：C（减半为作者估算）
- **来源**：E04:S16（待核实：效应量经 S17 二手获得）；E04:S17（待核实：作者未核实）

---

## 10.8　停止信号与警示文案

**[older.stop.trigger]** 【需专业审核】
- **规则**：
  - 训练中出现胸痛或压迫感、异常气促、头晕或要晕倒、心跳过快或不规则：结束训练，显示心脏警示文案，锁定训练直到用户确认已获医疗许可。
  - 训练中跌倒：结束训练，询问是否撞到头、能否承重。撞到头或不能承重：显示就医文案，锁定训练直到用户确认已就诊。没有受伤：显示休息文案，下次平衡阶段降一级。
- **理由**：这些症状是运动中需要立即停止的信号；跌倒后撞头或不能承重需要专业评估。
- **证据等级**：A（无伤跌倒后降级为工程选择）
- **来源**：E05:Fragala2019（待核实）；E01:FRANK20；E01:RIEBE15

**[older.stop.copy]** 【需专业审核】
- **规则**：警示文案：

| 场景 | 中文 | English |
|---|---|---|
| 心脏警示 | 如果你感到胸口疼或发紧、异常气喘、头晕想晕倒，或者心跳很快、不规律，请马上停下来坐好，并尽快就医。如果休息几分钟后仍没有缓解，请立即拨打急救电话。 | If you feel chest pain or tightness, unusual breathlessness, dizziness or faintness, or a racing or irregular heartbeat, stop now, sit down and seek medical advice. If it doesn't ease after a few minutes' rest, call emergency services. |
| 跌倒受伤 | 摔倒时撞到了头，或者站起来后腿不能用力，请尽快就医。训练计划先暂停，等你确认看过医生后再继续。 | If you hit your head when you fell, or you can't put weight on your leg, please get medical advice soon. Your plan is paused until you confirm you've been checked. |
| 跌倒无伤 | 今天的训练先到这里，好好休息。下次我们会把平衡练习调得更稳一些。 | Let's stop here for today and rest. Next time we'll make the balance work a bit steadier. |

- **理由**：急症与非急症分开，行动指示明确。
- **证据等级**：C
- **来源**：E05:Fragala2019（待核实）；E01:FRANK20；E01:Healthline（待核实）

**[older.never]**
- **规则**：应用绝不：
  - 把训练称为"防跌倒治疗"；
  - 评估或打分用户的跌倒风险；
  - 告诉有骨质疏松或骨折史的用户哪种负荷"安全"；
  - 在出现警示症状时鼓励继续训练；
  - 教授"跌倒后如何起身"等干预内容（工程选择）。
- **理由**：这些属于临床评估与干预，超出应用范围。
- **证据等级**：A
- **来源**：E05:Sherrington2019；E05:Fragala2019（待核实）

---

## 本章来源

- **E05:WHO2020 / E01:WHO20**：Bull FC, Al-Ansari SS, Biddle S, et al. 2020. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462.
- **E05:Sherrington2019**：Sherrington C, Fairhall N, Wallbank G, et al. 2019. Exercise for preventing falls in older people living in the community. *Cochrane Database Syst Rev* (1):CD012424.
- **E05:Fragala2019**：Fragala MS, Cadore EL, Dorgo S, et al. 2019. Resistance training for older adults: position statement from the NSCA. *J Strength Cond Res* 33(8):2019–2052.（待核实：推荐数字来自 IDEA Fit 二手摘要，全文未打开）
- **E05:Chodzko2009**：Chodzko-Zajko WJ, Proctor DN, Fiatarone Singh MA, et al. 2009. Exercise and physical activity for older adults (ACSM position stand). *Med Sci Sports Exerc* 41(7):1510–1530.（待核实：只读了摘要）
- **E05:Riebe2015 / E01:RIEBE15**：Riebe D, Franklin BA, Thompson PD, et al. 2015. Updating ACSM's recommendations for exercise preparticipation health screening. *Med Sci Sports Exerc* 47(11):2473–2479.
- **E01:PARQ23**：Warburton D, et al. 2023. The 2023 PAR-Q+ and ePARmed-X+. *Health & Fitness Journal of Canada* 16(1):46–49.
- **E01:PAG18**：Piercy KL, et al. 2018. The Physical Activity Guidelines for Americans. *JAMA* 320(19):2020–2028；US DHHS 2018，第 2 版。
- **E01:UKCMO**：UK Chief Medical Officers. 2019（页面 2026 更新）. Physical Activity Guidelines.
- **E01:GARBER11**：Garber CE, et al. 2011. Quantity and quality of exercise… *Med Sci Sports Exerc* 43(7):1334–1359.
- **E01:CDC-INT**：CDC. How to Measure Physical Activity Intensity.
- **E01:TANAKA01**：Tanaka H, Monahan KD, Seals DR. 2001. Age-predicted maximal heart rate revisited. *J Am Coll Cardiol* 37(1):153–156.
- **E01:FRANK20**：Franklin BA, et al. 2020. AHA Scientific Statement. *Circulation* 141:e705–e736.
- **E01:Healthline**：Healthline. Problems during exercise: warning signs（引用 AHA）。（待核实：二手来源）
- **E04:S16**：Bosquet L, et al. 2013. Effect of training cessation on muscular performance: a meta-analysis. *Scand J Med Sci Sports* 23(3).（待核实：效应量经 S17 获得）
- **E04:S17**：Stronger By Science. Detraining: how long does it take to lose strength and muscle?（待核实：作者未核实；从业者文章）


## v2 调整：规则分级与目标

以下调整取代本章对应项目的旧硬门槛表述，其余准入和动作安全排除保持原样。

- `older.template.balance_required`：老年人可用日≥3天时每周至少3天含平衡为hard；少于3天时每次至少1个平衡动作为target。

### v2 调整：平衡覆盖的环境例外（2026-10-17 用户裁定）

每周平衡天数仍为原硬性要求。有任何合法平衡候选而未安排满原要求天数时，属于算法失败，不能标环境受限。

唯一获批例外：对户外或用户手动关闭可扶物的情况，完整合法平衡候选池确实为零；在不改变健康资料、疼痛、安全限制及偏好的前提下，仅恢复器械／空间／可扶物就能找到合法平衡候选。例外配置保存在 `older.template.balance_required.environment_exception`，公开校验返回来源定义的 `balance_days.environment_exempt` 非错误诊断，缺失的平衡要求仍单列。

此时保留非空、可应用的 `environmentLimited` 草案，不视为质量合格；计划顶部持续显示已有“平衡练习缺支撑物”提示。其他全部硬规则仍须通过。用户开启可扶物后重新生成，即恢复原每周平衡天数要求。

独立验证必须自行复核候选池和仅环境恢复，不相信生成端或备份中的例外标记。强度、剂量、冲击、起落地、时长、孕产和健康准入不属于此授权；不得借覆盖例外绕过它们。以后同类覆盖要求可按相同已批准结构实施；新增用户文案仍需批准。
