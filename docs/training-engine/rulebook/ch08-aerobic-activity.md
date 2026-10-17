# 第 8 章　有氧、日常活动与减脂

版本：v0.1（2026-10-14）　｜　机器可读镜像：`rules-ch08.yaml`

本章规定：每周有氧做多少、多大强度算“中等”和“高强度”、间歇训练（HIIT）什么时候可以开放、每天的步数目标怎么定和怎么加、减脂能期待什么，以及如何打断久坐。

本章所有强度上限都受第 1 章约束：`safety.clearance.restricted_mode`（自觉用力 ≤5/10）、`safety.unlock.vigorous`（不活跃者前 8 个规律周只到中等强度）等优先于本章。孕期、产后、老年人模块另有更严格的规定时，以更严格者为准。

术语：

- **中等强度当量分钟（moderate-equivalent minutes）：** 中等强度分钟 + 2 × 高强度分钟。
- **自觉用力（RPE，rating of perceived exertion）：** 本章统一用 0–10 分制，0 = 坐着休息，10 = 竭尽全力。
- **谈话测试（talk test）：** 用“能不能说话 / 唱歌”来判断强度。

---

## 8.1 每周有氧目标

**[aerobic.target.weekly]**

- **规则：** 默认每周 150 分钟中等强度当量，进阶目标 300 分钟；中等当量 = 中等分钟 + 2 × 高强度分钟。超过 300 分钟不设上限，但触发进阶章节中的恢复与过度使用检查。
- **理由：** WHO 2020、美国 PAG 2018 和英国 CMO 2019 的成人目标一致：每周 150–300 分钟中等强度或 75–150 分钟高强度，超过目标仍有额外获益。
- **证据等级：** A
- **来源：** E01:WHO20；E01:PAG18；E01:UKCMO
- **例外/注意：** 1 分钟高强度 ≈ 2 分钟中等强度是基于代谢当量（MET）的约定，并非生理上精确等价。老年人的多成分（平衡 + 力量）训练天数由老年人模块规定。

**[aerobic.bout.any_length]**

- **规则：** 任何时长 ≥1 分钟、强度达到中等及以上的活动都计入每周分钟数；不要求单次 ≥10 分钟。
- **理由：** PAG 2018 与 WHO 2020 已取消“每次至少 10 分钟”的旧要求。
- **证据等级：** A
- **来源：** E01:WHO20；E01:PAG18

**[aerobic.progression.ramp]**

- **规则：** 当前活动量低于 150 分钟的用户，第 1 周目标 = max(60 分钟, 当前每周中等当量分钟)；之后每周目标增幅 ≤10%，直到 150 分钟；150 分钟以上的继续增加同样遵守 ≤10%/周。增量优先分配到不同的有氧方式，以分散冲击负荷。
- **理由：** 肌肉骨骼损伤风险随运动量上升，低体能者更明显，所以要循序渐进；证据库建议起步“明显低于 150 分钟（如 60–90 分钟）”，取 60；10%/周是从业者惯例。
- **证据等级：** C（工程选择，待教练审核；10% 规则在证据库中未经核实）
- **来源：** E01:PAG18；E01:WHO20；E01:UKCMO
- **例外/注意：** 需许可者按 `safety.clearance.restricted_mode` 的建议起步剂量。

**[aerobic.copy.every_minute]**

- **规则：** 新用户的有氧目标页显示：
  - 中文：「每一分钟都算数。从你现在的水平开始，一点点加量就好。」
  - 英文："Every minute counts. Start where you are and build up a little at a time."
- **理由：** 三份指南都明确“有一点总比没有好”，不活跃者从少量开始也能获益。
- **证据等级：** A
- **来源：** E01:WHO20；E01:PAG18；E01:UKCMO

**[aerobic.modality.any_counts]**

- **规则：** 任何达到目标自觉用力的有氧方式都按同样标准计分（快走、骑车、游泳、爬楼梯、跳舞、划船、原地踏步等）；强度只看用力程度，不看冲击大小。低冲击替换（关节注意、老年人、低冲击 / 安静模式）保持相同的自觉用力目标。
- **理由：** 指南计入任何达到目标强度的有氧活动；低冲击动作同样可以达到中等或高强度。
- **证据等级：** A
- **来源：** E01:PAG18；E01:UKCMO
- **例外/注意：** 具体的低冲击替换列表属于环境与关节注意相关章节；“冲击替换不损失效果”这一点没有专门的荟萃分析，属 C 级推断。

---

## 8.2 强度：谈话测试、自觉用力、最大心率

**[aerobic.intensity.talk_test]**

- **规则：** 所有有氧块都带谈话提示：
  - 中等：中文「还能聊天，但唱不了歌。」英文 "You can talk, but not sing."
  - 高强度：中文「只能一次说几个词，就得停下换气。」英文 "You can only say a few words before pausing for breath."
- **理由：** 谈话测试无需设备，研究显示它能较好地定位通气阈和呼吸代偿阈，从而把用户引导到正确的强度区间。
- **证据等级：** A
- **来源：** E01:CDC-INT；E01:PAG18；E01:BOK22

**[aerobic.intensity.rpe_scale]**

- **规则：** 0–10 自觉用力映射：轻松 ≤4；中等 5–6；高强度 7–8；HIIT 用力段 8–9；HIIT 恢复段 2–4。每个有氧块存 `target_rpe_0_10` 区间与 `talk_cue`。
- **理由：** CDC / PAG 采用 0–10 分制，中等为 5–6、高强度从 7–8 开始；不同量表的锚点不一，应用内统一用 0–10 分制，避免混用 6–20 分的 Borg 量表。
- **证据等级：** A
- **来源：** E01:CDC-INT；E01:PAG18；E01:BOK22
- **例外/注意：** “轻松 ≤4”和 HIIT 段位取值来自证据库的引擎建议（用力段 8–9、恢复段 2–4）。

**[aerobic.intensity.mets]**

- **规则：** 用户手动记录或从设备导入的外部活动，按代谢当量（MET）分级：<3.0 为轻度（不计入有氧分钟）；3.0–5.9 为中等（×1）；≥6.0 为高强度（×2）。快走为中等，慢跑与爬楼梯为高强度。
- **理由：** PAG 2018 的绝对强度分级，可用于没有自觉用力记录的活动。
- **证据等级：** A
- **来源：** E01:PAG18

**[aerobic.intensity.hrmax]**

- **规则：** 最大心率估算用 Tanaka 公式：HRmax ≈ 208 − 0.7 × 年龄（不分性别和训练水平），显示时取整并注明“个人误差约 ±10 次 / 分，偏差可能超过 20 次 / 分”。心率区间（%HRmax）功能默认关闭，直到区间数值完成核实；用户报告服用 β 受体阻滞剂或有心脏疾病时，永不显示心率目标，只用自觉用力。
- **理由：** Tanaka 公式由 351 项研究、约 1.9 万人推导，比“220 − 年龄”更准（后者高估年轻人、低估 40 岁以上者）；但个体误差大，只能作参考；常见的 %HRmax 区间（中等约 64–76%、高强度约 77–93%）在证据库中未经核实。
- **证据等级：** B
- **来源：** E01:TANAKA01；E01:CDC-HR（待核实）
- **例外/注意：** 自觉用力与谈话测试始终是主要强度提示，心率只是辅助。

---

## 8.3 间歇训练（HIIT）

HIIT 有效且省时，但在多数健康指标上并不优于中等强度持续训练；纳入研究都是有监督的，无监督的消费级 HIIT 证据很少（E01:COCH26；E01:MART20）。风险集中在“不习惯剧烈运动的人突然高强度”上（E01:FRANK20）。因此 HIIT 默认锁定，满足准入条件才开放，并且始终是可选项。

**[hiit.gate.unlock]**

- **规则：** 以下全部满足才开放 HIIT：
  1. `clearance_state` 为 `none_needed`，或为 `confirmed` 且所获准强度为“高强度”；
  2. `max_intensity = vigorous`（不活跃者须先满足 `safety.unlock.vigorous` 的 8 个规律周）；
  3. 在应用内连续完成 ≥4 个规律周（`safety.unlock.regular_week`）的中等强度训练；
  4. 近 4 周没有报告任何症状；
  5. 年龄 ≥45 且不习惯高强度者，已确认 `safety.age45.vigorous_advisory`；
  6. 非孕期；产后用户须满足产后模块的准入条件；
  7. 65 岁及以上：HIIT 只能由 `impact ≤ 1` 的动作组成。
- **理由：** 证据库建议 HIIT 须通过筛查、完成 ≥4 周规律中等训练、无新症状，并对 45 岁以上者给出提示；“4 周”为产品经验值。老年人默认使用低冲击选项。
- **证据等级：** C（工程选择，待教练审核；HIIT 有效性有 B 级证据）
- **来源：** E01:COCH26；E01:MART20；E01:FRANK20；E01:PARQ23；E01:ROG12（待核实）；E01:WEW18（待核实）

**[hiit.dose.default]**

- **规则：** 每周 1–2 次，两次之间至少隔 1 天；起步 4–6 组 × 30–60 秒，用力段自觉用力 8，恢复时间 ≥ 用力时间、恢复段自觉用力 2–4；热身 ≥5 分钟（默认 5，最多 10），放松 5 分钟；进阶时先每周最多加 1 组，加到 10 组后才把用力段提到 8–9；全力冲刺式间歇只对主动选择“进阶”的用户开放。
- **理由：** 一般人群 HIIT 剂量是从业者惯例：先加组数再加强度，热身与放松降低心血管事件风险。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E01:COCH26；E01:MART20；E01:FRANK20
- **例外/注意：** “每周最多加 1 组”和“10 组上限”证据库未给出，为工程选择。

**[hiit.credit.minutes]**

- **规则：** HIIT 课计入每周有氧时：用力段分钟 × 2（高强度）；恢复段自觉用力 ≥5 时按中等 × 1 计，否则不计；热身与放松只有达到中等强度时才按 × 1 计。
- **理由：** 中等当量的计算规则只对达到相应强度的时间成立；恢复段通常为轻度，不应虚增分钟数。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E01:WHO20；E01:PAG18；E01:CDC-INT

**[aerobic.snack.option]**

- **规则：** 提供“运动小零食”（exercise snack）选项：每次 ≤5 分钟，每天 ≥2 次，每周 3–7 天，计入每周有氧分钟（按实际强度计分）。只有 `max_intensity = vigorous` 时，才提供 1–2 分钟的高强度小爆发（如快速爬楼梯）。
- **理由：** 针对不活跃成年人的荟萃分析显示，这种短时多次的练习能提高心肺适能，完成率 >90%；日常生活中的短时高强度活动与较低死亡率相关，但属观察性证据。
- **证据等级：** B
- **来源：** E03:Rodriguez-2026；E01:STAM22；E01:WHO20
- **例外/注意：** 运动小零食对力量、体脂、血压、血脂没有明确效果，不能替代力量训练。

---

## 8.4 步数

**[steps.target.daily]**

- **规则：** 每日步数目标：<60 岁 8,000–10,000 步；≥60 岁 7,000–8,000 步。10,000 步是可选目标，不是要求；从低基线开始的任何增加都要正面显示。
- **理由：** 步数与死亡风险的关系在这些区间附近趋于平台（<60 岁约 8,000–10,000，≥60 岁约 6,000–8,000）；另一项荟萃分析显示，与每天 2,000 步相比，7,000 步的获益已接近 10,000 步。
- **证据等级：** B
- **来源：** E01:PALUCH22；E01:DING25（待核实）
- **例外/注意：** 步数数据为观察性关联，不同设备计步差异较大。

**[steps.progression.increment]**

- **规则：** 基线 = 最近 7 天日步数的中位数（无设备数据时用用户估计值）。基线低于目标时，每 2 周评估一次：最近 7 天中 ≥5 天达到当前目标，则当前目标 +1,000 步 / 天；否则维持。到达目标区间上限后停止自动增加。
- **理由：** 证据库给出“每 1–2 周增加 1,000–2,000 步”的产品经验值，取保守端（每 2 周 +1,000），并以达成情况为前提。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E01:PALUCH22；E01:DING25（待核实）

**[steps.credit.mvpa]**

- **规则：** 步数只算日常活动（非运动性活动产热，NEAT），不自动折算成有氧分钟；只有达到谈话测试“中等”标准的连续快走（用户记录，或设备识别为中等强度的步行）才计入有氧分钟。
- **理由：** 步数是日常活动量的实用指标；只有达到中等强度的步行才属于中高强度身体活动（MVPA）。
- **证据等级：** C（工程选择；方向有 A/B 级支持）
- **来源：** E01:PALUCH22；E01:EKE16；E01:PAG18

---

## 8.5 减脂：做什么、能期待什么

**[fatloss.plan.structure]**

- **规则：** 目标为减脂时：每周 ≥150 分钟中等当量有氧 + 每周 2–3 次力量训练；耐受良好时在约 12 周内把有氧逐步加到 200–300 分钟（每周增幅仍受 `aerobic.progression.ramp` 约束）；永不生成只有有氧的减脂计划；计划页固定附带饮食提示，不暗示单靠运动就能大幅减重。
- **理由：** 每周 150–250 分钟主要防止体重增加、减重有限；>250 分钟与有临床意义的减重相关；减重 >5% 或长期维持可能需要 >300 分钟。力量训练本身就能减少体脂和内脏脂肪，并保护瘦体重；有氧量主导能量缺口。证据库给出 8–12 周的递增期，取 12 周。
- **证据等级：** A
- **来源：** E01:DONN09；E01:PAG18；E01:JAYEDI24；E01:WEW22；E01:WILLIS12
- **例外/注意：** 补偿性进食和日常活动减少会抵消部分效果；个体差异很大。

**[fatloss.expectation.copy]**

- **规则：** 预期效果只用平均值描述：
  - 中文：「在只增加有氧运动的研究里，平均每周多做 30 分钟，体重约多减 0.5 kg、腰围约少 0.5 cm；每周 150 分钟平均约减 2.8 kg，300 分钟约减 4.2 kg。饮食对减重的作用更大，每个人差别也很大。即使体重没变，运动对健康的好处依然存在。」
  - 英文："In studies that added aerobic exercise alone, each extra 30 minutes a week led to about 0.5 kg more weight loss and about 0.5 cm off the waist on average; 150 minutes a week averaged about 2.8 kg and 300 minutes about 4.2 kg. Diet plays a bigger role, and results vary a lot between people. Even if your weight doesn't change, exercise still benefits your health."
- **理由：** 剂量—反应荟萃分析（116 项随机对照试验）给出的平均效果；明确“饮食是主力”和“没有减重也有健康获益”，避免不切实际的期待。
- **证据等级：** B
- **来源：** E01:JAYEDI24；E01:DONN09
- **例外/注意：** 不对单个用户做“你将减掉 X kg”的个人化预测。

**[fatloss.spot_reduction.ban]**

- **规则：** 动作名称、标签、推荐理由和推送文案中禁止出现“局部减脂”含义的措辞（如“瘦肚子”“燃烧腹部脂肪”“练大腿减大腿肉”）；用户选择“想减某个部位”时，显示 `fatloss.copy.spot_reduction`，并按全身减脂计划生成。
- **理由：** 荟萃分析（13 项对照研究、1,158 人）发现训练某个部位并不会优先减少该部位的脂肪（效应量约为 0）。
- **证据等级：** B
- **来源：** E01:RC21

**[fatloss.copy.spot_reduction]**

- **规则：** 显示：
  - 中文：「脂肪从哪里减少，我们没法自己选。练核心能让你更有力量；全身活动量加上饮食调整，才会让脂肪减少。」
  - 英文："You can't choose where fat comes off. Core training builds strength; overall activity plus your eating habits is what reduces fat."
- **理由：** 纠正局部减脂误区，同时说明部位训练的真正价值。
- **证据等级：** B
- **来源：** E01:RC21

**[fatloss.hiit.optional]**

- **规则：** 减脂目标下，HIIT 是可选的省时方案：通过 `hiit.gate.unlock` 后，可用 HIIT 替代每周有氧的一部分（按 `hiit.credit.minutes` 计分），但不作为默认，也不宣传“HIIT 燃脂更多”。
- **理由：** 间歇训练的总脂肪量下降略多于中等持续训练，但体脂百分比没有差别，各研究异质性大；HIIT 是选项而不是必需。
- **证据等级：** B
- **来源：** E01:VIANA19；E01:COCH26

---

## 8.6 久坐与日常活动

**[sedentary.break.nudge]**

- **规则：** 在入门时提供可选的“久坐提醒”，默认关闭；用户开启后默认每 60 分钟提醒一次（可调 30–60 分钟），夜间与用户设定的勿扰时段不提醒；提醒内容为 1–3 分钟的站立、走动或轻松活动。
- **理由：** 指南建议减少久坐，用任何强度（包括轻度）的活动替代，但没有给出时间间隔；提醒间隔是产品选择。
- **证据等级：** C（工程选择，待教练审核）
- **来源：** E01:WHO20；E01:PAG18；E01:UKCMO

**[sedentary.high_sitting.target]**

- **规则：** 用户报告每天坐着 >8 小时时：在目标页显示 300 分钟进阶目标，并提示「每天坐得多，更需要多活动：研究中，每天约 60–75 分钟中等强度活动与抵消久坐的不良影响相关」；不改变当前周目标的递增速度。
- **理由：** WHO 建议久坐多的人争取超过中高强度活动目标；超过 100 万成人的合并分析显示，每天约 60–75 分钟中等强度活动似乎能抵消每天坐 >8 小时带来的额外死亡风险（看电视 ≥3 小时 / 天时只能减轻）。
- **证据等级：** B
- **来源：** E01:WHO20；E01:EKE16
- **例外/注意：** 该数字来自观察性研究；没有公认的久坐时长上限。

---

## 本章证据与取舍说明

| 主题 | 处理 |
|---|---|
| 起步有氧量 | 证据库给出 60–90 分钟 / 周，取 60。 |
| 每周增幅 10% | 从业者惯例，证据库未核实，标 C。 |
| %HRmax 区间 | 证据库未核实，功能默认关闭；只保留 Tanaka 公式。 |
| HIIT 准入 4 周、组数上限 10 | 产品经验值 / 工程选择，待教练审核。 |
| 步数递增 | 证据库给出每 1–2 周 +1,000–2,000 步，取每 2 周 +1,000。 |
| 减脂递增期 | 证据库给出 8–12 周，取 12 周。 |
| Ding 2025 | 细节来自大学新闻稿，DOI 未在期刊网站核实，引用具体数字前需核对。 |

## 本章来源

- **E01:WHO20** — Bull FC, Al-Ansari SS, Biddle S, et al. 2020. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462. DOI 10.1136/bjsports-2020-102955.
- **E01:PAG18** — Piercy KL, Troiano RP, Ballard RM, et al. 2018. The Physical Activity Guidelines for Americans. *JAMA* 320(19):2020–2028. DOI 10.1001/jama.2018.14854；US DHHS. 2018. *Physical Activity Guidelines for Americans*, 2nd ed.
- **E01:UKCMO** — UK Chief Medical Officers. 2019（页面更新于 2026）. UK Chief Medical Officers' Physical Activity Guidelines.
- **E01:EKE16** — Ekelund U, Steene-Johannessen J, Brown WJ, et al. 2016. Does physical activity attenuate, or even eliminate, the detrimental association of sitting time with mortality? *Lancet* 388(10051):1302–1310. DOI 10.1016/S0140-6736(16)30370-1.
- **E01:STAM22** — Stamatakis E, Ahmadi MN, Gill JMR, et al. 2022. Association of wearable device-measured vigorous intermittent lifestyle physical activity with mortality. *Nat Med*. DOI 10.1038/s41591-022-02100-x.（观察性研究）
- **E01:DONN09** — Donnelly JE, Blair SN, Jakicic JM, Manore MM, Rankin JW, Smith BK. 2009. Appropriate physical activity intervention strategies for weight loss and prevention of weight regain for adults (ACSM Position Stand). *Med Sci Sports Exerc* 41(2):459–471. DOI 10.1249/MSS.0b013e3181949333.
- **E01:JAYEDI24** — Jayedi A, Soltani S, Emadi A, Zargar MS, Najafi A. 2024. Aerobic exercise and weight loss in adults: a systematic review and dose-response meta-analysis. *JAMA Netw Open* 7(12):e2452185. DOI 10.1001/jamanetworkopen.2024.52185.
- **E01:WEW22**（DOI 未确认）— Wewege MA, Desai I, Honey C, et al. 2022. The effect of resistance training in healthy adults on body fat percentage, fat mass and visceral fat. *Sports Med* 52(2):287–300. PMID 34536199.
- **E01:WILLIS12**（DOI 未确认）— Willis LH, Slentz CA, Bateman LA, et al. 2012. Effects of aerobic and/or resistance training on body mass and fat mass in overweight or obese adults. *J Appl Physiol* 113(12):1831–1837. PMID 23019316.
- **E01:VIANA19** — Viana RB, Naves JPA, Coswig VS, et al. 2019. Is interval training the magic bullet for fat loss? *Br J Sports Med* 53(10):655–664. DOI 10.1136/bjsports-2018-099928.
- **E01:RC21** — Ramirez-Campillo R, Andrade D, Clemente F, et al. 2021/2022. A proposed model to test the hypothesis of exercise-induced localized fat reduction (spot reduction). *Human Movement* 23(3):1–14. DOI 10.5114/hm.2022.110373.
- **E01:PALUCH22** — Paluch AE, Bajpai S, Bassett DR, et al. 2022. Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. *Lancet Public Health* 7(3):e219–e228. DOI 10.1016/S2468-2667(21)00302-9.
- **E01:DING25**（待核实）— Ding D, Owen K, et al. 2025. Daily steps and health outcomes in adults: a systematic review and dose-response meta-analysis. *Lancet Public Health*. DOI 10.1016/S2468-2667(25)00164-1（仅见大学新闻稿，DOI 未在期刊网站核实）。
- **E01:CDC-INT** — CDC. How to Measure Physical Activity Intensity.
- **E01:CDC-HR**（待核实）— CDC. Target Heart Rate and Estimated Maximum Heart Rate（页面未能打开，%HRmax 区间未确认）。
- **E01:BOK22** — Bok D, Rakovac M, Foster C. 2022. An examination and critique of subjective methods to determine exercise intensity. *Sports Med* 52(9):2085–2109. DOI 10.1007/s40279-022-01690-3.
- **E01:TANAKA01** — Tanaka H, Monahan KD, Seals DR. 2001. Age-predicted maximal heart rate revisited. *J Am Coll Cardiol* 37(1):153–156. DOI 10.1016/s0735-1097(00)01054-8.
- **E01:COCH26** — Strauss JA, Kirwan R, Ranasinghe C, et al. 2026. High-intensity interval training for reducing cardiometabolic syndrome in healthy but sedentary populations. *Cochrane Database Syst Rev* Issue 3. DOI 10.1002/14651858.CD013617.pub2.
- **E01:MART20** — Martland R, Mondelli V, Gaughran F, Stubbs B. 2020. Can high-intensity interval training improve physical and mental health outcomes? A meta-review of 33 systematic reviews. *J Sports Sci* 38(4):430–469. DOI 10.1080/02640414.2019.1706829.
- **E01:ROG12**（待核实，作者与 DOI 未确认）— Rognmo Ø, et al. 2012. Cardiovascular risk of high- versus moderate-intensity aerobic exercise in coronary heart disease patients. *Circulation*.
- **E01:WEW18**（待核实，作者与 DOI 未确认）— Wewege MA, et al. 2018. High-intensity interval training for patients with cardiovascular disease: is it safe? *J Am Heart Assoc*.
- **E01:FRANK20** — Franklin BA, Thompson PD, Al-Zaiti SS, et al. 2020. AHA Scientific Statement. *Circulation* 141:e705–e736. DOI 10.1161/CIR.0000000000000749.
- **E01:PARQ23** — Warburton D, Jamnik V, Bredin SSD, Shephard RJ, Gledhill N. 2023. The 2023 PAR-Q+ and ePARmed-X+. *Health & Fitness Journal of Canada* 16(1):46–49. DOI 10.14288/hfjc.v16i1.839.
- **E03:Rodriguez-2026** — Rodríguez MÁ, Quintana-Cepedal M, Cheval B, Thøgersen-Ntoumani C, Crespo I, Olmedillas H. 2026. Effect of exercise snacks on fitness and cardiometabolic health in physically inactive individuals: systematic review and meta-analysis. *Br J Sports Med* 60(2):133–141. DOI 10.1136/bjsports-2025-110027.
