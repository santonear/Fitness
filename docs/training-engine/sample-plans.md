# 固定画像训练计划抽查样本

种子：20261015；规则：c7ce150248baefb44d7b1bce37291c4834c3b5d59a769305898810bf332fcacb；画像及输出指纹：15e00f28。

从完整80画像（包含健康阻断及受限结果）按实际质量分升序、原画像索引为同分次序，选取排名 round(i×79/11)，i=0…11。分数不是安全认证；阻断样本不冒充可执行计划。

## 样本 1：画像 2（排序 1/80）

- 画像：70岁；intermediate；目标 muscle；每周 2 天，每次 30 分钟；场地 home；空间 mat；人群 older_adult。
- 器械：none；注意部位：无已登记项。
- 完整合成画像：{"goal":"muscle","level":"intermediate","trainingAgeWeeks":49,"daysPerWeek":2,"sessionMinutes":30,"equipment":["none"],"place":"home","constraints":{"noJump":false,"quiet":false,"space":"mat"},"cautions":[],"population":{"kind":"older_adult","fallsAnswers":[false,false,false,false],"balanceCautious":false},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":true,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"inactive","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z"},"preferences":{"excludedExerciseIds":[],"cannotDo":["walking_carry","jumping","overhead","kneeling"]},"birthYearMonth":"1956-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.00000000；状态：unavailable；安全门：safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；safety.clearance.hard_stop=blocked；safety.unlock.vigorous=restricted；safety.age45.vigorous_advisory=restricted；hiit.gate.unlock=restricted。
- 每周结构：没有可执行训练单。

失分最多的3条规则：

- older.template.balance_required：满足度 0.000000，权重 5，加权失分 5.000000。
- duration.fit.tolerance：满足度 0.000000，权重 4，加权失分 4.000000。
- dose.sets_week.intermediate：满足度 0.000000，权重 3，加权失分 3.000000。

用户提示：

- 根据你的回答，开始（或加大）运动前，建议先咨询医生或合格的运动专业人员。这不代表你不能运动——大多数人在专业人士确认后都可以安全地动起来。确认后回到这里，我们会为你安排合适的计划。
- 接下来的训练强度较高。如果你 45 岁以上、平时很少做这么累的运动，建议先咨询医生或合格的运动专业人员。确认没问题后再继续；感觉不对随时停下。
- 有几个部位本周练得偏少。时间允许的话，加一天或每次多练 10 分钟会更均衡。

## 样本 2：画像 33（排序 8/80）

- 画像：35岁；intermediate；目标 start_moving；每周 1 天，每次 30 分钟；场地 home；空间 small；人群 general。
- 器械：none；注意部位：back、shoulder、wrist。
- 完整合成画像：{"goal":"start_moving","level":"intermediate","trainingAgeWeeks":100,"daysPerWeek":1,"sessionMinutes":30,"equipment":["none"],"place":"home","constraints":{"noJump":true,"quiet":false,"space":"small"},"cautions":["back","shoulder","wrist"],"population":{"kind":"general"},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":true,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"active","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["back","shoulder","wrist"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb","numbness_groin_or_buttocks","new_bladder_or_bowel_problem","progressive_leg_weakness","back_pain_with_fever_or_unwell","back_pain_with_cancer_history","unexplained_weight_loss","back_pain_after_significant_trauma","severe_constant_pain_unrelated_to_movement","shoulder_pain_with_chest_pain","shoulder_pain_with_breathlessness","sudden_loss_of_arm_movement_after_injury"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false,"numbness_groin_or_buttocks":false,"new_bladder_or_bowel_problem":false,"progressive_leg_weakness":false,"back_pain_with_fever_or_unwell":false,"back_pain_with_cancer_history":false,"unexplained_weight_loss":false,"back_pain_after_significant_trauma":false,"severe_constant_pain_unrelated_to_movement":false,"shoulder_pain_with_chest_pain":false,"shoulder_pain_with_breathlessness":false,"sudden_loss_of_arm_movement_after_injury":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":["walking_carry","floor_work","kneeling"]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.00000000；状态：unavailable；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；safety.clearance.hard_stop=blocked；hiit.gate.unlock=restricted。
- 每周结构：没有可执行训练单。

失分最多的3条规则：

- duration.fit.tolerance：满足度 0.000000，权重 4，加权失分 4.000000。
- dose.sets_week.intermediate：满足度 0.000000，权重 3，加权失分 3.000000。
- goal.params.start_moving：满足度 0.000000，权重 3，加权失分 3.000000。

用户提示：

- 根据你的回答，开始（或加大）运动前，建议先咨询医生或合格的运动专业人员。这不代表你不能运动——大多数人在专业人士确认后都可以安全地动起来。确认后回到这里，我们会为你安排合适的计划。
- 有几个部位本周练得偏少。时间允许的话，加一天或每次多练 10 分钟会更均衡。
- 本周的有氧时间还不够。平时多走走也算数，每次 10 分钟就有帮助。

## 样本 3：画像 58（排序 15/80）

- 画像：35岁；beginner；目标 health；每周 5 天，每次 10 分钟；场地 home；空间 small；人群 general。
- 器械：none、dumbbell、resistance-band、loop-band、flat-bench；注意部位：back。
- 完整合成画像：{"goal":"health","level":"beginner","trainingAgeWeeks":30,"daysPerWeek":5,"sessionMinutes":10,"equipment":["none","dumbbell","resistance-band","loop-band","flat-bench"],"place":"home","constraints":{"noJump":true,"quiet":true,"space":"small"},"cautions":["back"],"population":{"kind":"general"},"screening":{"parqAllNo":false,"parqAnswers":[false,true,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"active","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["back"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb","numbness_groin_or_buttocks","new_bladder_or_bowel_problem","progressive_leg_weakness","back_pain_with_fever_or_unwell","back_pain_with_cancer_history","unexplained_weight_loss","back_pain_after_significant_trauma","severe_constant_pain_unrelated_to_movement"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false,"numbness_groin_or_buttocks":false,"new_bladder_or_bowel_problem":false,"progressive_leg_weakness":false,"back_pain_with_fever_or_unwell":false,"back_pain_with_cancer_history":false,"unexplained_weight_loss":false,"back_pain_after_significant_trauma":false,"severe_constant_pain_unrelated_to_movement":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":["walking_carry","floor_work","overhead"]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.00000000；状态：unavailable；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；safety.clearance.hard_stop=blocked；hiit.gate.unlock=restricted。
- 每周结构：没有可执行训练单。

失分最多的3条规则：

- duration.fit.tolerance：满足度 0.000000，权重 4，加权失分 4.000000。
- dose.sets_week.beginner：满足度 0.000000，权重 3，加权失分 3.000000。
- goal.params.health：满足度 0.000000，权重 3，加权失分 3.000000。

用户提示：

- 根据你的回答，开始（或加大）运动前，建议先咨询医生或合格的运动专业人员。这不代表你不能运动——大多数人在专业人士确认后都可以安全地动起来。确认后回到这里，我们会为你安排合适的计划。
- 有几个部位本周练得偏少。时间允许的话，加一天或每次多练 10 分钟会更均衡。
- 本周的有氧时间还不够。平时多走走也算数，每次 10 分钟就有帮助。

## 样本 4：画像 50（排序 23/80）

- 画像：35岁；beginner；目标 health；每周 1 天，每次 20 分钟；场地 home；空间 medium；人群 general。
- 器械：none；注意部位：knee。
- 完整合成画像：{"goal":"health","level":"beginner","trainingAgeWeeks":64,"daysPerWeek":1,"sessionMinutes":20,"equipment":["none"],"place":"home","constraints":{"noJump":false,"quiet":true,"space":"medium"},"cautions":["knee"],"population":{"kind":"general"},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"active","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["knee"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":["overhead","kneeling"]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.55351038；状态：limited；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；hiit.gate.unlock=restricted。
- 每周结构：1. 训练（目标20分钟，实际21.45分钟）。

失分最多的3条规则：

- goal.params.health：满足度 0.317460，权重 3，加权失分 2.047619。
- balance.week.hinge_knee：满足度 0.000000，权重 2，加权失分 2.000000。
- dose.sets_week.beginner：满足度 0.472222，权重 3，加权失分 1.583333。

用户提示：

- 有几个部位本周练得偏少。时间允许的话，加一天或每次多练 10 分钟会更均衡。
- 本周的有氧时间还不够。平时多走走也算数，每次 10 分钟就有帮助。

### 第 1 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 箱式深蹲 (3378068b-6d09-5a6f-85ae-5cbf6b5a3d8b) | main | 2 | 8次 | 105 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 3 | 8次 | 105 | 0秒 |
| 下斜俯卧撑 (9c6c200d-920e-5832-8944-8225090898b1) | main | 1 | 8次 | 105 | 0秒 |
| 自阻力单臂前推 (3488272c-79af-5b0e-8bd9-eb58e0fbc453) | main | 2 | 8次 | 105 | 0秒 |
| 普拉提前撑抬腿 (1c7ba8db-ee7a-5a84-8890-ea58cc0b71ac) | accessory | 2 | 8次 | 105 | 0秒 |

## 样本 5：画像 53（排序 30/80）

- 画像：35岁；intermediate；目标 start_moving；每周 1 天，每次 30 分钟；场地 home；空间 medium；人群 general。
- 器械：none；注意部位：无已登记项。
- 完整合成画像：{"goal":"start_moving","level":"intermediate","trainingAgeWeeks":44,"daysPerWeek":1,"sessionMinutes":30,"equipment":["none"],"place":"home","constraints":{"noJump":true,"quiet":false,"space":"medium"},"cautions":[],"population":{"kind":"general"},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"inactive","restingBp":"unknown","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z"},"preferences":{"excludedExerciseIds":[],"cannotDo":["walking_carry","jumping","floor_work","overhead","kneeling"]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.63229118；状态：limited；安全门：safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；safety.clearance.restricted_mode=restricted；safety.unlock.vigorous=restricted；hiit.gate.unlock=restricted。
- 每周结构：1. 训练（目标30分钟，实际27.17分钟）。

失分最多的3条规则：

- dose.sets_week.intermediate：满足度 0.000000，权重 3，加权失分 3.000000。
- goal.params.start_moving：满足度 0.424301，权重 3，加权失分 1.727096。
- aerobic.target.weekly：满足度 0.000000，权重 1，加权失分 1.000000。

用户提示：

- 根据你的回答，开始（或加大）运动前，建议先咨询医生或合格的运动专业人员。这不代表你不能运动——大多数人在专业人士确认后都可以安全地动起来。确认后回到这里，我们会为你安排合适的计划。
- 有几个部位本周练得偏少。时间允许的话，加一天或每次多练 10 分钟会更均衡。
- 本周的有氧时间还不够。平时多走走也算数，每次 10 分钟就有帮助。

### 第 1 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 后踢腿跑 (3e92f9f9-9844-52ab-8a4e-102d420cd45d) | warmup | 2 | 30秒 | 105 | 0秒 |
| 腿摆动前置接背部 (65e2ea16-50ef-5f66-8f78-1acc38466c10) | warmup | 1 | 30秒 | 105 | 0秒 |
| 扭转椅子式 (c587f444-e7d6-5e0d-88f9-f451d05da067) | warmup | 1 | 30秒 | 45 | 0秒 |
| 坐站起立 (4cfe1b0c-271a-5b9d-8635-7f87630ae44a) | main | 2 | 10次 | 105 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 2 | 10次 | 105 | 0秒 |
| 上斜俯卧撑 (9fe7ba83-3ee6-5c7b-8fc9-9523dcdfafde) | main | 2 | 10次 | 105 | 0秒 |
| 单腿罗马尼亚硬拉静态保持 (4001ed34-a416-534c-8fbe-900cdd0cc7df) | accessory | 2 | 30秒 | 45 | 0秒 |
| 站姿前推抗伸展保持 (3af7d9a0-edf4-5f27-8b2d-10066ef4b693) | accessory | 2 | 30秒 | 45 | 0秒 |
| 站姿股四头肌拉伸 (fe202858-3bc6-5f6e-8ecf-b0335ccd9619) | cooldown | 2 | 30秒 | 105 | 0秒 |

## 样本 6：画像 13（排序 37/80）

- 画像：70岁；intermediate；目标 muscle；每周 1 天，每次 30 分钟；场地 home；空间 small；人群 older_adult。
- 器械：none；注意部位：shoulder、wrist。
- 完整合成画像：{"goal":"muscle","level":"intermediate","trainingAgeWeeks":2,"daysPerWeek":1,"sessionMinutes":30,"equipment":["none"],"place":"home","constraints":{"noJump":true,"quiet":false,"space":"small"},"cautions":["shoulder","wrist"],"population":{"kind":"older_adult","fallsAnswers":[false,false,false,false],"balanceCautious":false},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"active","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["shoulder","wrist"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb","shoulder_pain_with_chest_pain","shoulder_pain_with_breathlessness","sudden_loss_of_arm_movement_after_injury"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false,"shoulder_pain_with_chest_pain":false,"shoulder_pain_with_breathlessness":false,"sudden_loss_of_arm_movement_after_injury":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":["floor_work"]},"birthYearMonth":"1956-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.73159277；状态：limited；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；safety.age45.vigorous_advisory=restricted；hiit.gate.unlock=restricted。
- 每周结构：1. 训练（目标30分钟，实际30.17分钟）。

失分最多的3条规则：

- goal.params.muscle：满足度 0.420428，权重 3，加权失分 1.738715。
- goal.floor.all：满足度 0.550000，权重 3，加权失分 1.350000。
- aerobic.target.weekly：满足度 0.000000，权重 1，加权失分 1.000000。

用户提示：

- 接下来的训练强度较高。如果你 45 岁以上、平时很少做这么累的运动，建议先咨询医生或合格的运动专业人员。确认没问题后再继续；感觉不对随时停下。
- 有几个部位本周练得偏少。时间允许的话，加一天或每次多练 10 分钟会更均衡。
- 本周的有氧时间还不够。平时多走走也算数，每次 10 分钟就有帮助。

### 第 1 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 高抬腿 (b9bb5b78-59d5-5605-8969-91334db716c7) | warmup | 1 | 60秒 | 105 | 0秒 |
| 腿摆动前置接背部 (65e2ea16-50ef-5f66-8f78-1acc38466c10) | warmup | 1 | 35秒 | 105 | 0秒 |
| 扭转椅子式 (c587f444-e7d6-5e0d-88f9-f451d05da067) | warmup | 1 | 30秒 | 45 | 0秒 |
| 坐站起立 (4cfe1b0c-271a-5b9d-8635-7f87630ae44a) | main | 2 | 10次 | 105 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 3 | 10次 | 105 | 0秒 |
| 前臂撑墙推 (56692b0e-64cb-5fe4-8a49-6d57c6ccc437) | main | 2 | 10次 | 105 | 0秒 |
| 战士三式 (a7cca67b-384d-55a8-856f-d7a72a25f50b) | accessory | 2 | 30秒 | 45 | 0秒 |
| 站姿前推抗伸展保持 (3af7d9a0-edf4-5f27-8b2d-10066ef4b693) | accessory | 1 | 30秒 | 45 | 0秒 |
| 扶稳固支撑物宽站距静态站立 (47562b7f-d0ad-54a9-8383-b83547a80282) | balance | 1 | 30秒 | 45 | 0秒 |
| 站姿股四头肌拉伸 (fe202858-3bc6-5f6e-8ecf-b0335ccd9619) | cooldown | 2 | 30秒 | 105 | 0秒 |

## 样本 7：画像 71（排序 44/80）

- 画像：35岁；beginner；目标 mobility；每周 1 天，每次 30 分钟；场地 home；空间 small；人群 general。
- 器械：none；注意部位：back。
- 完整合成画像：{"goal":"mobility","level":"beginner","trainingAgeWeeks":68,"daysPerWeek":1,"sessionMinutes":30,"equipment":["none"],"place":"home","constraints":{"noJump":false,"quiet":false,"space":"small"},"cautions":["back"],"population":{"kind":"general"},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"active","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["back"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb","numbness_groin_or_buttocks","new_bladder_or_bowel_problem","progressive_leg_weakness","back_pain_with_fever_or_unwell","back_pain_with_cancer_history","unexplained_weight_loss","back_pain_after_significant_trauma","severe_constant_pain_unrelated_to_movement"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false,"numbness_groin_or_buttocks":false,"new_bladder_or_bowel_problem":false,"progressive_leg_weakness":false,"back_pain_with_fever_or_unwell":false,"back_pain_with_cancer_history":false,"unexplained_weight_loss":false,"back_pain_after_significant_trauma":false,"severe_constant_pain_unrelated_to_movement":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":["walking_carry","jumping"]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.76761013；状态：limited；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；hiit.gate.unlock=restricted。
- 每周结构：1. 训练（目标30分钟，实际27.35分钟）。

失分最多的3条规则：

- goal.params.mobility：满足度 0.450723，权重 3，加权失分 1.647832。
- goal.floor.all：满足度 0.562500，权重 3，加权失分 1.312500。
- aerobic.target.weekly：满足度 0.000000，权重 1，加权失分 1.000000。

用户提示：

- 有几个部位本周练得偏少。时间允许的话，加一天或每次多练 10 分钟会更均衡。
- 本周的有氧时间还不够。平时多走走也算数，每次 10 分钟就有帮助。
- 时间有限，这次优先拉伸主项肌群，部分肌群未达到默认拉伸目标。

### 第 1 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 安静原地踏步 (9ab4007b-4404-5576-8bed-9f0641cdbecf) | warmup | 2 | 42秒 | 105 | 0秒 |
| 腿摆动前置接背部 (65e2ea16-50ef-5f66-8f78-1acc38466c10) | warmup | 1 | 30秒 | 105 | 0秒 |
| 坐站起立 (4cfe1b0c-271a-5b9d-8635-7f87630ae44a) | main | 2 | 8次 | 105 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 3 | 8次 | 105 | 0秒 |
| 弓箭手式俯卧撑 (775b7331-0fb6-5037-8fa8-8e9fd13f450a) | main | 3 | 8次 | 105 | 0秒 |
| 单腿罗马尼亚硬拉静态保持 (4001ed34-a416-534c-8fbe-900cdd0cc7df) | accessory | 2 | 15秒 | 45 | 0秒 |
| 熊式平板支撑静态保持 (0e1da082-9ee0-57ae-808e-de1bec5c1e1d) | accessory | 2 | 15秒 | 45 | 0秒 |
| 站姿上背拉伸 (894c5044-1af6-596e-8628-2fa8b7522f0f) | cooldown | 1 | 30秒 | 105 | 0秒 |

## 样本 8：画像 69（排序 51/80）

- 画像：35岁；intermediate；目标 start_moving；每周 2 天，每次 60 分钟；场地 home；空间 mat；人群 general。
- 器械：none、dumbbell、kettlebell、barbell、flat-bench、adjustable-bench、cable、lat-pulldown-machine、leg-curl、leg-extension、leg-press、squat-rack、pull-up-bar、chair、wall、anchor-point；注意部位：knee、wrist。
- 完整合成画像：{"goal":"start_moving","level":"intermediate","trainingAgeWeeks":39,"daysPerWeek":2,"sessionMinutes":60,"equipment":["none","dumbbell","kettlebell","barbell","flat-bench","adjustable-bench","cable","lat-pulldown-machine","leg-curl","leg-extension","leg-press","squat-rack","pull-up-bar","chair","wall","anchor-point"],"place":"home","constraints":{"noJump":false,"quiet":true,"space":"mat"},"cautions":["knee","wrist"],"population":{"kind":"general"},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"inactive","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["knee","wrist"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":[]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.78362103；状态：limited；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；safety.unlock.vigorous=restricted；hiit.gate.unlock=restricted。
- 每周结构：1. 训练（目标60分钟，实际58.08分钟）；2. 训练（目标60分钟，实际54.33分钟）。

失分最多的3条规则：

- dose.sets_week.intermediate：满足度 0.445833，权重 3，加权失分 1.662500。
- goal.params.start_moving：满足度 0.618056，权重 3，加权失分 1.145833。
- aerobic.target.weekly：满足度 0.000000，权重 1，加权失分 1.000000。

用户提示：

- 本周的有氧时间还不够。平时多走走也算数，每次 10 分钟就有帮助。
- 时间有限，这次优先拉伸主项肌群，部分肌群未达到默认拉伸目标。

### 第 1 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 站姿轻空拳 (9f2b36bf-e604-5671-8113-573d74a04132) | warmup | 2 | 60秒 | 105 | 0秒 |
| 普拉提逐节下卷 (a4f69ee4-54a4-5f38-8dee-15a859e57ef7) | warmup | 1 | 30秒 | 105 | 0秒 |
| 扭转椅子式 (c587f444-e7d6-5e0d-88f9-f451d05da067) | warmup | 1 | 58秒 | 45 | 0秒 |
| 坐站起立 (4cfe1b0c-271a-5b9d-8635-7f87630ae44a) | main | 4 | 10次 | 105 | 0秒 |
| 单臂壶铃地板推举 (0d568b96-0ab6-5c3c-8b6f-f8e606465e34) | main | 1 | 10次 | 105 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 2 | 10次 | 105 | 0秒 |
| 浅幅分腿蹲 (dc4bab89-e5e8-58dc-8315-f845cc62d5ac) | main | 2 | 10次 | 105 | 0秒 |
| 地板壶铃直臂上拉 (b805995b-f058-599b-8ada-9a8660b2d083) | accessory | 2 | 12次 | 75 | 0秒 |
| 站姿脚跟后拉保持 (10820d67-fcdf-529a-8206-48ef97954658) | accessory | 2 | 45秒 | 45 | 0秒 |
| 蝗虫式 (9f0efc8d-da00-539f-8ddf-089374c688ae) | accessory | 2 | 45秒 | 45 | 0秒 |
| 普拉提前撑抬腿 (1c7ba8db-ee7a-5a84-8890-ea58cc0b71ac) | accessory | 2 | 10次 | 105 | 0秒 |
| 交替打腿 (b15e6289-c68a-566e-8abc-096b4d7f8bc4) | conditioning | 4 | 10次 | 105 | 0秒 |
| 深蹲小幅脉冲 (a5d0d11b-6017-56ea-86e1-ffd418c4dd8f) | conditioning | 4 | 10次 | 105 | 0秒 |
| 坐姿分腿拉伸 (9ab0d29f-9494-52b3-8430-31f1f4f42b5f) | cooldown | 1 | 30秒 | 105 | 0秒 |

### 第 2 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 安静原地踏步 (9ab4007b-4404-5576-8bed-9f0641cdbecf) | warmup | 1 | 40秒 | 105 | 0秒 |
| 普拉提锯式 (519d21de-a1d7-5ee8-850f-5220a41faf3f) | warmup | 1 | 30秒 | 105 | 0秒 |
| 单腿臀桥静态保持 (1a33dc4f-2152-5612-8a5f-d7c6b3f0f990) | warmup | 1 | 45秒 | 45 | 0秒 |
| 单臂壶铃地板推举 (0d568b96-0ab6-5c3c-8b6f-f8e606465e34) | main | 2 | 10次 | 105 | 0秒 |
| 自阻力单臂上推 (b3469727-3bd6-5826-85f9-28d5efc1a2ca) | main | 2 | 10次 | 105 | 0秒 |
| 自阻力下拉保持 (5f49f6d0-7fc0-544a-844d-8f1f00d243cf) | main | 2 | 45秒 | 45 | 0秒 |
| 浅幅分腿蹲 (dc4bab89-e5e8-58dc-8315-f845cc62d5ac) | main | 2 | 10次 | 105 | 0秒 |
| 蝗虫式 (9f0efc8d-da00-539f-8ddf-089374c688ae) | accessory | 2 | 45秒 | 45 | 0秒 |
| 臀桥静态保持 (74a5d4c8-0a72-5e0e-82d3-3c738bbad4a8) | accessory | 2 | 45秒 | 45 | 0秒 |
| 站姿脚跟后拉保持 (10820d67-fcdf-529a-8206-48ef97954658) | accessory | 2 | 45秒 | 45 | 0秒 |
| 侧向扶墙抗旋推 (e0970209-6057-56dc-8193-06cf29e1a520) | accessory | 2 | 45秒 | 45 | 0秒 |
| 剪刀腿 (5552d253-5693-5588-8336-46e70ee4c35b) | conditioning | 4 | 10次 | 105 | 0秒 |
| 交替打腿 (b15e6289-c68a-566e-8abc-096b4d7f8bc4) | conditioning | 4 | 10次 | 105 | 0秒 |
| 站姿股四头肌拉伸 (fe202858-3bc6-5f6e-8ecf-b0335ccd9619) | cooldown | 1 | 30秒 | 105 | 0秒 |

## 样本 9：画像 61（排序 58/80）

- 画像：35岁；intermediate；目标 muscle；每周 4 天，每次 30 分钟；场地 home；空间 large；人群 general。
- 器械：none；注意部位：knee、back、shoulder、wrist。
- 完整合成画像：{"goal":"muscle","level":"intermediate","trainingAgeWeeks":59,"daysPerWeek":4,"sessionMinutes":30,"equipment":["none"],"place":"home","constraints":{"noJump":false,"quiet":false,"space":"large"},"cautions":["knee","back","shoulder","wrist"],"population":{"kind":"general"},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"active","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["knee","back","shoulder","wrist"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb","numbness_groin_or_buttocks","new_bladder_or_bowel_problem","progressive_leg_weakness","back_pain_with_fever_or_unwell","back_pain_with_cancer_history","unexplained_weight_loss","back_pain_after_significant_trauma","severe_constant_pain_unrelated_to_movement","shoulder_pain_with_chest_pain","shoulder_pain_with_breathlessness","sudden_loss_of_arm_movement_after_injury"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false,"numbness_groin_or_buttocks":false,"new_bladder_or_bowel_problem":false,"progressive_leg_weakness":false,"back_pain_with_fever_or_unwell":false,"back_pain_with_cancer_history":false,"unexplained_weight_loss":false,"back_pain_after_significant_trauma":false,"severe_constant_pain_unrelated_to_movement":false,"shoulder_pain_with_chest_pain":false,"shoulder_pain_with_breathlessness":false,"sudden_loss_of_arm_movement_after_injury":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":[]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.80654747；状态：limited；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；hiit.gate.unlock=restricted。
- 每周结构：1. 训练（目标30分钟，实际29.30分钟）；2. 训练（目标30分钟，实际30.12分钟）；3. 训练（目标30分钟，实际29.65分钟）；4. 训练（目标30分钟，实际28.18分钟）。

失分最多的3条规则：

- goal.params.muscle：满足度 0.588325，权重 3，加权失分 1.235025。
- aerobic.target.weekly：满足度 0.000000，权重 1，加权失分 1.000000。
- goal.aerobic.baseline：满足度 0.000000，权重 1，加权失分 1.000000。

用户提示：

- 本周的有氧时间还不够。平时多走走也算数，每次 10 分钟就有帮助。
- 时间有限，这次优先拉伸主项肌群，部分肌群未达到默认拉伸目标。
- 有几个部位本周练得偏少。时间允许的话，加一天或每次多练 10 分钟会更均衡。

### 第 1 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 箱式深蹲 (3378068b-6d09-5a6f-85ae-5cbf6b5a3d8b) | main | 4 | 6次 | 105 | 0秒 |
| 前臂撑墙推 (56692b0e-64cb-5fe4-8a49-6d57c6ccc437) | main | 4 | 6次 | 105 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 3 | 6次 | 105 | 0秒 |
| 单腿臀桥 (3b6b0c4c-c0d9-5e66-8db9-d8365d8e51c0) | accessory | 2 | 6次 | 105 | 0秒 |
| 低位抬腿保持 (e92ea037-0ebe-563b-8fca-6f12df802cfe) | accessory | 1 | 47秒 | 45 | 0秒 |

### 第 2 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 扶墙浅幅后撤步 (6b35deb1-017a-5956-8d42-2cc52c465546) | main | 3 | 6次 | 105 | 0秒 |
| 坐姿自阻力上推 (0941a9bd-2bb8-58a1-8ead-4431daba8952) | main | 2 | 6次 | 105 | 0秒 |
| 自阻力单臂下拉 (7c1ac9d8-2327-56d0-8809-bedb89052062) | main | 3 | 6次 | 105 | 0秒 |
| 徒手早安式 (80910204-15ee-5125-8dca-6af97eba9341) | accessory | 4 | 6次 | 105 | 0秒 |
| 站姿交叉推压抗旋 (e0951491-94bd-5e4b-8cdf-5abc67d9bee2) | accessory | 2 | 6次 | 105 | 0秒 |

### 第 3 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 高抬腿 (b9bb5b78-59d5-5605-8969-91334db716c7) | warmup | 1 | 60秒 | 105 | 0秒 |
| 普拉提逐节下卷 (a4f69ee4-54a4-5f38-8dee-15a859e57ef7) | warmup | 1 | 30秒 | 105 | 0秒 |
| 徒手深蹲 (fe06a323-6426-5771-893c-b99a2ca1978d) | warmup | 1 | 6次 | 105 | 0秒 |
| 坐站起立 (4cfe1b0c-271a-5b9d-8635-7f87630ae44a) | main | 3 | 6次 | 105 | 0秒 |
| 自阻力单臂前推 (3488272c-79af-5b0e-8bd9-eb58e0fbc453) | main | 2 | 6次 | 105 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 3 | 6次 | 105 | 0秒 |
| 单腿臀桥 (3b6b0c4c-c0d9-5e66-8db9-d8365d8e51c0) | accessory | 4 | 6次 | 105 | 0秒 |
| 门框胸部拉伸 (4eafa853-c94f-5ab4-89eb-fcee8ef06ec9) | cooldown | 1 | 30秒 | 105 | 0秒 |

### 第 4 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 高抬腿 (b9bb5b78-59d5-5605-8969-91334db716c7) | warmup | 1 | 60秒 | 105 | 0秒 |
| 普拉提逐节下卷 (a4f69ee4-54a4-5f38-8dee-15a859e57ef7) | warmup | 1 | 30秒 | 105 | 0秒 |
| 臀桥 (87247362-0cd9-5122-8ab5-f876180163de) | warmup | 1 | 6次 | 105 | 0秒 |
| 站姿扶墙侧向保持 (5e763766-ee3e-56b0-8b68-69bed38b8381) | main | 4 | 37秒 | 45 | 0秒 |
| 自阻力单臂上推 (b3469727-3bd6-5826-85f9-28d5efc1a2ca) | main | 2 | 6次 | 105 | 0秒 |
| 自阻力单臂下拉 (7c1ac9d8-2327-56d0-8809-bedb89052062) | main | 3 | 6次 | 105 | 0秒 |
| 扭转新月式弓步 (e1185069-bef2-5b34-84be-8ec50e1d5a74) | accessory | 4 | 30秒 | 45 | 0秒 |
| 站姿上背拉伸 (894c5044-1af6-596e-8628-2fa8b7522f0f) | cooldown | 1 | 30秒 | 105 | 0秒 |

## 样本 10：画像 5（排序 66/80）

- 画像：35岁；beginner；目标 muscle；每周 3 天，每次 45 分钟；场地 home；空间 medium；人群 pregnant。
- 器械：none、dumbbell；注意部位：knee、back、shoulder、wrist。
- 完整合成画像：{"goal":"muscle","level":"beginner","trainingAgeWeeks":20,"daysPerWeek":3,"sessionMinutes":45,"equipment":["none","dumbbell"],"place":"home","constraints":{"noJump":false,"quiet":true,"space":"medium"},"cautions":["knee","back","shoulder","wrist"],"population":{"kind":"pregnant","week":17,"providerCleared":true,"contraindicationsConfirmedNone":true,"lastScreenedWeek":17},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"inactive","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["knee","back","shoulder","wrist"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb","numbness_groin_or_buttocks","new_bladder_or_bowel_problem","progressive_leg_weakness","back_pain_with_fever_or_unwell","back_pain_with_cancer_history","unexplained_weight_loss","back_pain_after_significant_trauma","severe_constant_pain_unrelated_to_movement","shoulder_pain_with_chest_pain","shoulder_pain_with_breathlessness","sudden_loss_of_arm_movement_after_injury"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false,"numbness_groin_or_buttocks":false,"new_bladder_or_bowel_problem":false,"progressive_leg_weakness":false,"back_pain_with_fever_or_unwell":false,"back_pain_with_cancer_history":false,"unexplained_weight_loss":false,"back_pain_after_significant_trauma":false,"severe_constant_pain_unrelated_to_movement":false,"shoulder_pain_with_chest_pain":false,"shoulder_pain_with_breathlessness":false,"sudden_loss_of_arm_movement_after_injury":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":["kneeling"]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.82160990；状态：limited；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；safety.unlock.vigorous=restricted；hiit.gate.unlock=restricted。
- 每周结构：1. 训练（目标45分钟，实际42.50分钟）；2. 训练（目标45分钟，实际43.63分钟）；3. 训练（目标45分钟，实际45.17分钟）。

失分最多的3条规则：

- session.cooldown.stretch：满足度 0.077381，权重 1，加权失分 0.922619。
- dose.sets_week.beginner：满足度 0.729167，权重 3，加权失分 0.812500。
- safety.session.warmup_cooldown：满足度 0.275000，权重 1，加权失分 0.725000。

用户提示：

- 今天别忘了做盆底肌练习。如果还不确定怎么做，可以请产检医生、助产士或盆底物理治疗师教你。
- 请现在停止运动，并联系你的产检医生或助产士，如果你出现：阴道出血、有液体流出、规律的疼痛宫缩、胸痛、休息后仍不缓解的头晕或要晕倒、运动前就呼吸费力或休息后仍气喘、头痛、小腿疼痛或肿胀、腹痛，或者腿没力气、站不稳。
- 时间有限，这次优先拉伸主项肌群，部分肌群未达到默认拉伸目标。

### 第 1 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 安静原地踏步 (9ab4007b-4404-5576-8bed-9f0641cdbecf) | warmup | 1 | 20秒 | 105 | 0秒 |
| 躯干转体 (eb725ac0-00dc-5fe5-80f1-ac3c82c4a6b7) | warmup | 1 | 18秒 | 105 | 0秒 |
| 箱式深蹲 (3378068b-6d09-5a6f-85ae-5cbf6b5a3d8b) | main | 3 | 10次 | 105 | 0秒 |
| 前臂撑墙推 (56692b0e-64cb-5fe4-8a49-6d57c6ccc437) | main | 2 | 10次 | 105 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 3 | 10次 | 105 | 0秒 |
| 单腿罗马尼亚硬拉静态保持 (4001ed34-a416-534c-8fbe-900cdd0cc7df) | main | 3 | 23秒 | 45 | 0秒 |
| 自阻力单臂下拉 (7c1ac9d8-2327-56d0-8809-bedb89052062) | accessory | 2 | 10次 | 105 | 0秒 |
| 站姿前推抗伸展保持 (3af7d9a0-edf4-5f27-8b2d-10066ef4b693) | accessory | 3 | 23秒 | 45 | 0秒 |
| 单哑铃斯文式推举 (79f6049a-16a9-5cca-8c91-4076c416a18b) | accessory | 3 | 12次 | 75 | 0秒 |
| 站姿股四头肌拉伸 (fe202858-3bc6-5f6e-8ecf-b0335ccd9619) | cooldown | 1 | 30秒 | 105 | 0秒 |

### 第 2 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 坐姿踏步 (bf4bc395-9395-57dd-8a5f-188ad063d783) | warmup | 2 | 60秒 | 105 | 0秒 |
| 躯干转体 (eb725ac0-00dc-5fe5-80f1-ac3c82c4a6b7) | warmup | 1 | 30秒 | 105 | 0秒 |
| 徒手早安式 (80910204-15ee-5125-8dca-6af97eba9341) | warmup | 1 | 10次 | 105 | 0秒 |
| 坐姿自阻力上推 (0941a9bd-2bb8-58a1-8ead-4431daba8952) | main | 2 | 10次 | 105 | 0秒 |
| 自阻力单臂上推 (b3469727-3bd6-5826-85f9-28d5efc1a2ca) | main | 2 | 10次 | 105 | 0秒 |
| 自阻力单臂下拉 (7c1ac9d8-2327-56d0-8809-bedb89052062) | main | 3 | 10次 | 105 | 0秒 |
| 浅幅分腿蹲 (dc4bab89-e5e8-58dc-8315-f845cc62d5ac) | main | 3 | 8次 | 105 | 0秒 |
| 战士三式 (a7cca67b-384d-55a8-856f-d7a72a25f50b) | accessory | 3 | 24秒 | 45 | 0秒 |
| 站姿交叉推压抗旋 (e0951491-94bd-5e4b-8cdf-5abc67d9bee2) | accessory | 1 | 10次 | 105 | 0秒 |
| 哑铃斯文式推举 (8b8b7079-572f-58f2-8278-1425944a1f3c) | accessory | 3 | 12次 | 75 | 0秒 |
| 站姿上背拉伸 (894c5044-1af6-596e-8628-2fa8b7522f0f) | cooldown | 1 | 30秒 | 105 | 0秒 |

### 第 3 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 坐姿踏步 (bf4bc395-9395-57dd-8a5f-188ad063d783) | warmup | 2 | 40秒 | 105 | 0秒 |
| 无跳跃踏步开合 (e4e81141-14e6-5f72-8b8f-5e19e3cb709a) | conditioning | 1 | 80秒 | 105 | 0秒 |
| 安静原地踏步 (9ab4007b-4404-5576-8bed-9f0641cdbecf) | conditioning | 1 | 2465秒 | 105 | 0秒 |
| 卧凳腘绳肌拉伸 (67fc429a-9d8a-52cb-8772-0b0a01b2d862) | cooldown | 1 | 30秒 | 105 | 0秒 |

## 样本 11：画像 46（排序 73/80）

- 画像：35岁；intermediate；目标 strength；每周 4 天，每次 20 分钟；场地 home；空间 small；人群 general。
- 器械：none、dumbbell；注意部位：shoulder、wrist。
- 完整合成画像：{"goal":"strength","level":"intermediate","trainingAgeWeeks":95,"daysPerWeek":4,"sessionMinutes":20,"equipment":["none","dumbbell"],"place":"home","constraints":{"noJump":true,"quiet":true,"space":"small"},"cautions":["shoulder","wrist"],"population":{"kind":"general"},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"active","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["shoulder","wrist"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb","shoulder_pain_with_chest_pain","shoulder_pain_with_breathlessness","sudden_loss_of_arm_movement_after_injury"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false,"shoulder_pain_with_chest_pain":false,"shoulder_pain_with_breathlessness":false,"sudden_loss_of_arm_movement_after_injury":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":[]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.85347801；状态：limited；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；hiit.gate.unlock=restricted。
- 每周结构：1. 训练（目标20分钟，实际20.00分钟）；2. 训练（目标20分钟，实际18.90分钟）；3. 训练（目标20分钟，实际20.20分钟）；4. 训练（目标20分钟，实际19.90分钟）。

失分最多的3条规则：

- aerobic.target.weekly：满足度 0.000000，权重 1，加权失分 1.000000。
- goal.aerobic.baseline：满足度 0.000000，权重 1，加权失分 1.000000。
- session.warmup.dynamic：满足度 0.000000，权重 1，加权失分 1.000000。

用户提示：

- 本周的有氧时间还不够。平时多走走也算数，每次 10 分钟就有帮助。
- 有几个部位本周练得偏少。时间允许的话，加一天或每次多练 10 分钟会更均衡。

### 第 1 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 高位靠墙静蹲 (76e886a9-6094-5673-8837-283f854121a6) | main | 2 | 35秒 | 150 | 0秒 |
| 自阻力单臂前推 (3488272c-79af-5b0e-8bd9-eb58e0fbc453) | main | 2 | 5次 | 150 | 0秒 |
| 站姿自阻力划船保持 (56a14f4c-839d-598a-8c37-8d52f01e17a8) | main | 2 | 30秒 | 45 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 2 | 8次 | 105 | 0秒 |
| 普拉提前撑抬腿 (1c7ba8db-ee7a-5a84-8890-ea58cc0b71ac) | accessory | 1 | 8次 | 105 | 0秒 |

### 第 2 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 浅幅分腿蹲 (dc4bab89-e5e8-58dc-8315-f845cc62d5ac) | main | 1 | 5次 | 150 | 0秒 |
| 坐姿自阻力上推 (0941a9bd-2bb8-58a1-8ead-4431daba8952) | main | 2 | 5次 | 150 | 0秒 |
| 徒手反向弓步 (2bc539d7-0817-5f22-8309-7cb1406ef2fa) | main | 1 | 8次 | 105 | 0秒 |
| 自阻力单臂下拉 (7c1ac9d8-2327-56d0-8809-bedb89052062) | main | 2 | 8次 | 105 | 0秒 |
| 徒手早安式 (80910204-15ee-5125-8dca-6af97eba9341) | accessory | 3 | 8次 | 105 | 0秒 |

### 第 3 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 箱式深蹲 (3378068b-6d09-5a6f-85ae-5cbf6b5a3d8b) | main | 3 | 5次 | 150 | 0秒 |
| 前臂撑墙推 (56692b0e-64cb-5fe4-8a49-6d57c6ccc437) | main | 2 | 5次 | 150 | 0秒 |
| 站姿自阻力划船 (e309250b-5101-53ca-8b66-6a72adacff34) | main | 2 | 8次 | 105 | 0秒 |
| 站姿自阻力划船保持 (56a14f4c-839d-598a-8c37-8d52f01e17a8) | main | 2 | 30秒 | 45 | 0秒 |

### 第 4 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 跪姿侧桥 (63dd8ff9-5994-5916-8fa6-3f347b3898b0) | main | 2 | 58秒 | 150 | 0秒 |
| 坐姿自阻力上推 (0941a9bd-2bb8-58a1-8ead-4431daba8952) | main | 2 | 5次 | 150 | 0秒 |
| 杰斐逊式弯举 (586c0f89-b0ea-5d97-868f-df268e86213d) | main | 2 | 8次 | 105 | 0秒 |
| 自阻力单臂下拉 (7c1ac9d8-2327-56d0-8809-bedb89052062) | main | 2 | 8次 | 105 | 0秒 |

## 样本 12：画像 24（排序 80/80）

- 画像：35岁；intermediate；目标 health；每周 6 天，每次 45 分钟；场地 home；空间 medium；人群 pregnant。
- 器械：none、dumbbell；注意部位：knee、back、shoulder。
- 完整合成画像：{"goal":"health","level":"intermediate","trainingAgeWeeks":2,"daysPerWeek":6,"sessionMinutes":45,"equipment":["none","dumbbell"],"place":"home","constraints":{"noJump":true,"quiet":false,"space":"medium"},"cautions":["knee","back","shoulder"],"population":{"kind":"pregnant","week":36,"providerCleared":true,"contraindicationsConfirmedNone":true,"lastScreenedWeek":36},"screening":{"parqAllNo":true,"parqAnswers":[false,false,false,false,false,false,false],"knownCondition":false,"knownCmrDisease":false,"symptoms":false,"cmrSymptoms":{"chest_neck_jaw_arm_pain_or_discomfort":false,"dyspnea_at_rest_or_mild_exertion":false,"dizziness_or_syncope":false,"orthopnea_or_nocturnal_dyspnea":false,"ankle_edema":false,"palpitations_or_tachycardia":false,"intermittent_claudication":false,"known_heart_murmur":false,"unusual_fatigue_or_breathlessness_usual_activity":false},"activityStatus":"active","restingBp":"known_below_threshold","acuteIllness":false,"completedAt":"2026-10-01T00:00:00.000Z","lastScreenedAt":"2026-10-01T00:00:00.000Z","redFlagReview":{"requiredAt":"2026-10-01T00:00:00.000Z","answeredAt":"2026-10-01T00:00:00.000Z","areas":["knee","back","shoulder"],"questionKeys":["pain_after_fall_or_impact","cannot_bear_weight_or_use_limb","joint_hot_red_swollen_or_with_fever","locking_or_giving_way","unexplained_night_or_rest_pain","visible_deformity","numbness_tingling_or_weakness_spreading_into_limb","numbness_groin_or_buttocks","new_bladder_or_bowel_problem","progressive_leg_weakness","back_pain_with_fever_or_unwell","back_pain_with_cancer_history","unexplained_weight_loss","back_pain_after_significant_trauma","severe_constant_pain_unrelated_to_movement","shoulder_pain_with_chest_pain","shoulder_pain_with_breathlessness","sudden_loss_of_arm_movement_after_injury"],"answers":{"pain_after_fall_or_impact":false,"cannot_bear_weight_or_use_limb":false,"joint_hot_red_swollen_or_with_fever":false,"locking_or_giving_way":false,"unexplained_night_or_rest_pain":false,"visible_deformity":false,"numbness_tingling_or_weakness_spreading_into_limb":false,"numbness_groin_or_buttocks":false,"new_bladder_or_bowel_problem":false,"progressive_leg_weakness":false,"back_pain_with_fever_or_unwell":false,"back_pain_with_cancer_history":false,"unexplained_weight_loss":false,"back_pain_after_significant_trauma":false,"severe_constant_pain_unrelated_to_movement":false,"shoulder_pain_with_chest_pain":false,"shoulder_pain_with_breathlessness":false,"sudden_loss_of_arm_movement_after_injury":false}}},"preferences":{"excludedExerciseIds":[],"cannotDo":["walking_carry","jumping","kneeling"]},"birthYearMonth":"1991-06","asOfDate":"2026-10-15","locale":"zh"}
- 质量分：0.89453691；状态：limited；安全门：redflag.screen=pass；safety.scope.age_min=pass；safety.screen.parq=pass；safety.screen.cmr_symptoms=pass；hiit.gate.unlock=restricted。
- 每周结构：1. 训练（目标45分钟，实际44.98分钟）；2. 训练（目标45分钟，实际45.58分钟）；3. 训练（目标45分钟，实际45.17分钟）；4. 训练（目标45分钟，实际45.00分钟）；5. 训练（目标45分钟，实际45.00分钟）；6. 训练（目标45分钟，实际45.00分钟）。

失分最多的3条规则：

- session.warmup.general：满足度 0.472222，权重 2，加权失分 1.055556。
- session.cooldown.stretch：满足度 0.071429，权重 1，加权失分 0.928571。
- safety.session.warmup_cooldown：满足度 0.122917，权重 1，加权失分 0.877083。

用户提示：

- 今天别忘了做盆底肌练习。如果还不确定怎么做，可以请产检医生、助产士或盆底物理治疗师教你。
- 请现在停止运动，并联系你的产检医生或助产士，如果你出现：阴道出血、有液体流出、规律的疼痛宫缩、胸痛、休息后仍不缓解的头晕或要晕倒、运动前就呼吸费力或休息后仍气喘、头痛、小腿疼痛或肿胀、腹痛，或者腿没力气、站不稳。
- 时间有限，这次优先拉伸主项肌群，部分肌群未达到默认拉伸目标。

### 第 1 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 登山跑 (c95d05eb-d0e8-5557-84cf-0b1fc11e3e48) | warmup | 1 | 60秒 | 105 | 0秒 |
| 腿摆动前置接背部 (65e2ea16-50ef-5f66-8f78-1acc38466c10) | warmup | 1 | 30秒 | 105 | 0秒 |
| 徒手深蹲 (fe06a323-6426-5771-893c-b99a2ca1978d) | main | 3 | 10次 | 105 | 25秒 |
| 弓箭手式俯卧撑 (775b7331-0fb6-5037-8fa8-8e9fd13f450a) | main | 3 | 10次 | 105 | 0秒 |
| 站姿自阻力划船保持 (56a14f4c-839d-598a-8c37-8d52f01e17a8) | main | 2 | 51秒 | 45 | 0秒 |
| 单臂哑铃摆动 (4301a64d-b29f-5016-8d20-6651b7001fb2) | main | 3 | 4次 | 150 | 0秒 |
| 自阻力单臂下拉 (7c1ac9d8-2327-56d0-8809-bedb89052062) | accessory | 1 | 10次 | 105 | 0秒 |
| 平板支撑收膝 (0fd0172d-6578-58aa-8d3c-628a9eca1caa) | accessory | 1 | 10次 | 105 | 0秒 |
| 叛逆者划船 (41310470-2356-5167-8872-fc03893513e9) | conditioning | 3 | 10次 | 105 | 0秒 |
| 慢速熊式小步移动 (b8f89f42-2607-557f-8e2f-4be56f0f65a7) | conditioning | 3 | 23秒 | 105 | 0秒 |
| 坐姿分腿拉伸 (9ab0d29f-9494-52b3-8430-31f1f4f42b5f) | cooldown | 1 | 30秒 | 105 | 0秒 |

### 第 2 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 后踢腿跑 (3e92f9f9-9844-52ab-8a4e-102d420cd45d) | warmup | 1 | 60秒 | 105 | 0秒 |
| 侧向腿摆动 (86d096ca-ee52-5326-85e1-f32536062941) | warmup | 1 | 30秒 | 105 | 0秒 |
| 反向桌式静态保持 (65f14faa-bf0c-5fde-8542-0ad712df230a) | warmup | 1 | 60秒 | 45 | 0秒 |
| 哑铃硬拉 (37d40ea9-75bd-5ea1-8b65-c7f20a20d45e) | main | 3 | 10次 | 105 | 0秒 |
| 自阻力单臂上推 (b3469727-3bd6-5826-85f9-28d5efc1a2ca) | main | 2 | 10次 | 105 | 0秒 |
| 自阻力单臂下拉 (7c1ac9d8-2327-56d0-8809-bedb89052062) | main | 2 | 10次 | 105 | 0秒 |
| 反向弓步 (b1d137e4-a798-53ae-8ed7-8a9aa817047d) | main | 2 | 10次 | 105 | 0秒 |
| 叛逆者划船 (41310470-2356-5167-8872-fc03893513e9) | accessory | 1 | 10次 | 105 | 0秒 |
| 站姿交叉推压抗旋 (e0951491-94bd-5e4b-8cdf-5abc67d9bee2) | accessory | 1 | 10次 | 105 | 0秒 |
| 前臂支撑小步移动 (28641172-b3f1-5895-8864-d2af61cbebfd) | conditioning | 3 | 29秒 | 105 | 0秒 |
| 单臂哑铃摆动 (4301a64d-b29f-5016-8d20-6651b7001fb2) | conditioning | 4 | 4次 | 150 | 0秒 |
| 交叉躯干肩部拉伸 (8a4b7d62-194a-5220-8643-0976baa9697b) | cooldown | 1 | 30秒 | 105 | 0秒 |

### 第 3 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 登山跑 (c95d05eb-d0e8-5557-84cf-0b1fc11e3e48) | warmup | 2 | 45秒 | 105 | 0秒 |
| 后踢腿跑 (3e92f9f9-9844-52ab-8a4e-102d420cd45d) | conditioning | 1 | 135秒 | 105 | 0秒 |
| 安静原地踏步 (9ab4007b-4404-5576-8bed-9f0641cdbecf) | conditioning | 1 | 2400秒 | 105 | 0秒 |
| 卧凳小腿拉伸 (554c6a5f-e271-5147-8e24-9b17fe008d98) | cooldown | 1 | 30秒 | 105 | 0秒 |

### 第 4 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 坐姿分腿拉伸 (9ab0d29f-9494-52b3-8430-31f1f4f42b5f) | mobility | 3 | 30秒 | 105 | 0秒 |
| 门框胸部拉伸 (4eafa853-c94f-5ab4-89eb-fcee8ef06ec9) | mobility | 2 | 30秒 | 105 | 0秒 |
| 普拉提锯式 (519d21de-a1d7-5ee8-850f-5220a41faf3f) | mobility | 2 | 30秒 | 105 | 0秒 |
| 后踢腿跑 (3e92f9f9-9844-52ab-8a4e-102d420cd45d) | conditioning | 1 | 2455秒 | 105 | 0秒 |

### 第 5 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 后踢腿跑 (3e92f9f9-9844-52ab-8a4e-102d420cd45d) | warmup | 1 | 45秒 | 105 | 0秒 |
| 登山跑 (c95d05eb-d0e8-5557-84cf-0b1fc11e3e48) | conditioning | 1 | 180秒 | 105 | 0秒 |
| 安静原地踏步 (9ab4007b-4404-5576-8bed-9f0641cdbecf) | conditioning | 1 | 2400秒 | 105 | 0秒 |
| 过顶肱三头肌拉伸 (19c3da88-8c6a-5e27-8660-6d396e39d3d6) | cooldown | 1 | 30秒 | 105 | 0秒 |

### 第 6 次：训练

| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |
|---|---|---:|---|---|---|
| 坐姿分腿拉伸 (9ab0d29f-9494-52b3-8430-31f1f4f42b5f) | mobility | 3 | 30秒 | 105 | 0秒 |
| 门框胸部拉伸 (4eafa853-c94f-5ab4-89eb-fcee8ef06ec9) | mobility | 2 | 30秒 | 105 | 0秒 |
| 普拉提逐节下卷 (a4f69ee4-54a4-5f38-8dee-15a859e57ef7) | mobility | 2 | 30秒 | 105 | 0秒 |
| 后踢腿跑 (3e92f9f9-9844-52ab-8a4e-102d420cd45d) | conditioning | 1 | 2455秒 | 105 | 0秒 |

