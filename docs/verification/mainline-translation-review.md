# 主线动作中文指导抽查

2026-10-11；动作线分支 codex/polish-catalog。范围为目录数据与公共 API，浏览器集成由主线验证。

## 覆盖范围

固定 RepDB 免费包包含 637 个动作、1126 张 flat WebP；SHA256 为 `8f0ffe22025df4d9e915a5cbd5577479f240559c7e2c62203d7298be82df20c6`。
`tools/catalog/guides-zh.mjs` 为 150 个明确 slug 提供 2 条要点、3 条步骤（独立变式起始姿势 + 动作族过程）、常见错误和注意事项，覆盖 23.55% 的供应商动作。范围优先徒手、哑铃、杠铃、常见固定器械。内容是面向应用的中文编辑指导，并非逐句翻译，也未经过运动医学专业审查。

共用动作族仅用于动作机制一致的变式；每个变式明确器械、姿势或支撑差异。未计入覆盖的 487 个供应商动作提供中文名称、动作图及通用安全要点，不能称为完整中文指导。原英文占位提示已从生成器删除。四个历史动作前缀和 ID 保持不变。

## 20 条内容抽查

对照固定包英文步骤，检查器械、初始姿势、运动方向和变式差异；以下为内容审阅，不等同真人动作验证。

| slug | 核对结果 |
|---|---|
| bodyweight-squat | 双脚肩宽、屈髋屈膝、站起；深度改为可控范围 |
| goblet-squat | 壶铃靠近胸前；历史哑铃版仍沿用自身说明 |
| db-sumo-squat | 抽查修正为双手各持哑铃在体侧，与供应商一致 |
| reverse-lunge | 抽查补齐双手持哑铃，与徒手后弓步区分 |
| bulgarian-split-squat | 抽查补齐双手哑铃、后脚上凳 |
| romanian-deadlift | 杠铃沿腿下放、髋后移、臀腿伸髋 |
| db-kickstand-deadlift | 前脚承重、后脚点地、单只哑铃 |
| deadlift | 杠在脚中部、屈髋屈膝、蹬地站直 |
| glute-bridge | 仰卧屈膝、骨盆抬起、控制回落 |
| hip-thrust | 上背靠凳、杠铃髋前、避免腰椎代偿 |
| bench-press | 平凳、握距略宽、胸部附近下放与推起 |
| dumbbell-floor-press | 地面仰卧，上臂轻触地面限制下降 |
| wall-push-ups | 抽查修正双手为肩高，身体保持直线 |
| single-arm-db-row | 同侧手膝支凳，另一手向腰侧划船 |
| lat-pulldown | 大腿压垫、胸前下拉、受控还原 |
| hammer-curl | 掌心相对、肘固定、受控屈伸 |
| cable-lateral-raise | 远侧手握低位滑轮、侧向抬至肩高 |
| tricep-pushdown | 高位绳索、肘在体侧、伸肘下压 |
| leg-curl | 俯卧器械、屈膝勾起、控制回落 |
| dead-bug | 仰卧髋膝约直角、对侧手脚交替向地面伸展 |

## 筛选与提示边界

场地、器械、部位、目标的多选同组 OR，跨组 AND。场地来自器械可携带性，是可用性提示；并不保证用户实际拥有全部支撑器械。康复目标仅接受保守低强度名单，不作康复处方。注意部位只影响同相关性结果的顺序，不隐藏动作；支持 knee/shoulder/wrist 等单数档案键。器械 `gym-machine` 为通用机器别名，`yoga-mat` 视为徒手筛选。搜索保留旧三参数签名，中英文名称、别名、空格/连字符规范化及小范围编辑距离匹配；相近建议只返回有限距离内候选。

## 许可在线核验

2026-10-11 实际打开官方 [LICENSE-DATA.md](https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md) 和 [ATTRIBUTION.md](https://github.com/RepDB/exercise-dataset/blob/main/ATTRIBUTION.md)。免费 flat 图及数据允许应用内个人和商业使用，须保留用户可见 RepDB 链接。不得重发原始或衍生数据集/API，不得把图像用作生成模型输入。当前官网补充 paid-tier preview 动画仅限评估；此构建仅提取固定包 flat WebP，未提取动画或 premium-samples。不提交批量原始资源，不调用付费翻译模型。该结论说明应用实现如何遵循来源条款，不是法律意见。

## 验证

`node tools/catalog/build.mjs`：637 / 1126，固定哈希通过。
`npx tsc --noEmit`：通过。
`npx vitest run tests/catalog/exercise-guide.test.ts tests/domain/catalog.test.ts`：2 文件、39 项通过。覆盖 150 指导结构及真实 ID、中文回退、旧前缀、结果克隆、别名/容错、组合过滤、康复名单、注意部位不隐藏及旧调用签名。
