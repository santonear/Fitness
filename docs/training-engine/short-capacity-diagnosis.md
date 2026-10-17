# PR #61 补时容量只读诊断（2026-10-18）

范围：上一轮真实分布 2,000 个合成画像中的 274 个短课画像；未改写用户数据，未调用模型。诊断在20分钟内完成。

A 真耗尽：0。B 算法没加：274。每个 B 画像均有实际补时见证，通过完整硬规则（仅暂不要求填满时长）与独立外部检查；不以生成端短课标记作为依据。热身／冷身加组见证另核对目录组数范围及真实块预算。

最低训练单实际／目标时长：37.0833%；低于50%的画像：94。上述数字是修复前结果。

|类别|人群|水平|器械组合|目标分钟|数量|
|---|---|---|---|---:|---:|
|B|孕期|其他|dumbbell+none|45|17|
|B|普通|其他|none|30|41|
|B|普通|其他|dumbbell+none|45|70|
|B|普通|新手前4周|none|30|2|
|B|产后|其他|dumbbell+none|45|9|
|B|老年|其他|adjustable-bench+anchor-point+barbell+cable+chair+dumbbell+flat-bench+kettlebell+lat-pulldown-machine+leg-curl+leg-extension+leg-press+none+pull-up-bar+squat-rack+wall|60|12|
|B|产后|其他|adjustable-bench+anchor-point+barbell+cable+chair+dumbbell+flat-bench+kettlebell+lat-pulldown-machine+leg-curl+leg-extension+leg-press+none+pull-up-bar+squat-rack+wall|60|5|
|B|产后|新手前4周|loop-band+none+resistance-band|40|1|
|B|普通|其他|adjustable-bench+anchor-point+barbell+cable+chair+dumbbell+flat-bench+kettlebell+lat-pulldown-machine+leg-curl+leg-extension+leg-press+none+pull-up-bar+squat-rack+wall|60|42|
|B|普通|其他|loop-band+none+resistance-band|40|18|
|B|产后|其他|none|30|2|
|B|普通|新手前4周|dumbbell+none|45|7|
|B|普通|新手前4周|adjustable-bench+anchor-point+barbell+cable+chair+dumbbell+flat-bench+kettlebell+lat-pulldown-machine+leg-curl+leg-extension+leg-press+none+pull-up-bar+squat-rack+wall|60|3|
|B|老年|其他|none|30|6|
|B|孕期|其他|loop-band+none+resistance-band|40|9|
|B|老年|其他|dumbbell+none|45|11|
|B|孕期|新手前4周|dumbbell+none|45|5|
|B|孕期|其他|none|30|5|
|B|普通|新手前4周|loop-band+none+resistance-band|40|2|
|B|老年|其他|loop-band+none+resistance-band|40|2|
|B|产后|其他|loop-band+none+resistance-band|40|2|
|B|老年|新手前4周|adjustable-bench+anchor-point+barbell+cable+chair+dumbbell+flat-bench+kettlebell+lat-pulldown-machine+leg-curl+leg-extension+leg-press+none+pull-up-bar+squat-rack+wall|60|1|
|B|孕期|新手前4周|loop-band+none+resistance-band|40|2|

器械组合保留原始稳定键用于复现，不是用户界面标签。完整274行合成画像和实际见证保存在本机 `.cache/short-capacity-readonly-final.json`。A类为空，不能把目录中未搜索到的内容误报为资源确实耗尽。
