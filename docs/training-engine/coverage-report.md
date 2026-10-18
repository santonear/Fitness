# 训练引擎动作覆盖报告

由 `node tools/training-engine/coverage.ts` 生成。逐项使用完整器械及替代品、主要动作模式和机器规则排除条件。没有自动假定墙、椅子、桌子、门扣或固定点可用。瑜伽垫为可选项。

来源动作 637；本地动作 3；原创补充 41；总计 681。规则版本 0eb41eb1857629347a5a49a5ade127bb60472613e5dc48bbad0317cc5d641629。

## 徒手

器械：none。下表保留主要模式原始数量。

| 模式 | 无限制 | 膝注意 | 腰注意 | 肩注意 | 腕注意 | 安静 | 孕中期20周 | 新手难度≤2 |
|---|---|---|---|---|---|---|---|---|
| squat | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 5 |
| lunge | 9 | 6 | 9 | 9 | 9 | 9 | 9 | 2 |
| hinge | 13 | 13 | 13 | 13 | 9 | 13 | 7 | 9 |
| push_horizontal | 9 | 7 | 9 | 9 | 2 | 9 | 9 | 4 |
| push_vertical | 4 | 4 | 4 | 3 | 2 | 4 | 3 | 2 |
| pull_horizontal | 3 | 3 | 2 | 2 | 2 | 3 | 3 | 3 |
| pull_vertical | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| anti_extension | 12 | 12 | 12 | 11 | 8 | 12 | 5 | 10 |
| anti_rotation | 4 | 2 | 4 | 4 | 4 | 4 | 4 | 4 |
| anti_lateral_flexion | 6 | 5 | 6 | 6 | 5 | 6 | 6 | 2 |
| carry | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| balance | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 2 |
| cardio_cyclic | 11 | 6 | 6 | 11 | 9 | 5 | 6 | 10 |

已批准 carry_or_ground 闸门数量：{"unrestricted":4,"knee":3,"back":4,"shoulder":4,"wrist":2,"quiet":4,"pregnancy":4,"beginner":3}。只合计主要模式 carry 与 locomotion_ground，不计抗侧屈等其他模式。

## 徒手+弹力带

器械：none、resistance-band、loop-band。下表保留主要模式原始数量。

| 模式 | 无限制 | 膝注意 | 腰注意 | 肩注意 | 腕注意 | 安静 | 孕中期20周 | 新手难度≤2 |
|---|---|---|---|---|---|---|---|---|
| squat | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 6 |
| lunge | 9 | 6 | 9 | 9 | 9 | 9 | 9 | 2 |
| hinge | 17 | 16 | 17 | 17 | 13 | 17 | 10 | 13 |
| push_horizontal | 9 | 7 | 9 | 9 | 2 | 9 | 9 | 4 |
| push_vertical | 4 | 4 | 4 | 3 | 2 | 4 | 3 | 2 |
| pull_horizontal | 5 | 5 | 4 | 4 | 4 | 5 | 5 | 5 |
| pull_vertical | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| anti_extension | 12 | 12 | 12 | 11 | 8 | 12 | 5 | 10 |
| anti_rotation | 4 | 2 | 4 | 4 | 4 | 4 | 4 | 4 |
| anti_lateral_flexion | 6 | 5 | 6 | 6 | 5 | 6 | 6 | 2 |
| carry | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| balance | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 2 |
| cardio_cyclic | 11 | 6 | 6 | 11 | 9 | 5 | 6 | 10 |

已批准 carry_or_ground 闸门数量：{"unrestricted":4,"knee":3,"back":4,"shoulder":4,"wrist":2,"quiet":4,"pregnancy":4,"beginner":3}。只合计主要模式 carry 与 locomotion_ground，不计抗侧屈等其他模式。

## 居家哑铃+弹力带+凳

器械：none、dumbbell、resistance-band、loop-band、flat-bench。下表保留主要模式原始数量。

| 模式 | 无限制 | 膝注意 | 腰注意 | 肩注意 | 腕注意 | 安静 | 孕中期20周 | 新手难度≤2 |
|---|---|---|---|---|---|---|---|---|
| squat | 13 | 8 | 12 | 13 | 13 | 8 | 13 | 10 |
| lunge | 13 | 8 | 13 | 13 | 13 | 9 | 13 | 3 |
| hinge | 27 | 26 | 26 | 27 | 23 | 19 | 17 | 17 |
| push_horizontal | 16 | 14 | 16 | 15 | 6 | 12 | 12 | 8 |
| push_vertical | 12 | 12 | 12 | 3 | 10 | 4 | 11 | 4 |
| pull_horizontal | 10 | 9 | 9 | 9 | 9 | 7 | 10 | 9 |
| pull_vertical | 4 | 4 | 4 | 3 | 4 | 3 | 3 | 4 |
| anti_extension | 13 | 13 | 13 | 12 | 9 | 13 | 5 | 10 |
| anti_rotation | 4 | 2 | 4 | 4 | 4 | 4 | 4 | 4 |
| anti_lateral_flexion | 7 | 6 | 7 | 7 | 6 | 7 | 7 | 3 |
| carry | 5 | 5 | 5 | 3 | 5 | 3 | 5 | 2 |
| balance | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 2 |
| cardio_cyclic | 11 | 6 | 6 | 11 | 9 | 5 | 6 | 10 |

已批准 carry_or_ground 闸门数量：{"unrestricted":9,"knee":8,"back":9,"shoulder":7,"wrist":7,"quiet":7,"pregnancy":9,"beginner":5}。只合计主要模式 carry 与 locomotion_ground，不计抗侧屈等其他模式。

## 闸门结果

原始计数低于 2 的非豁免格子 16 个。按用户批准的 carry_or_ground 等效口径，闸门 通过；不足格子 0 个。其余模式仍严格使用原始数量。肩注意的过头推按原任务豁免。
