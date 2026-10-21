# 训练计划升级设计稿（2026-10-21，Bo 已定版）

来源：Claude 设计画布 https://claude.ai/artifact/Enx8Q8Q1gRuvZoTMCwwmVh （Bo 2026-10-21 确认“使用这套设计稿”）。
本目录是画布源文件快照，作为参照，不是规范；规则以 `docs/uiux/UIUX20261008.md` 的 V9.14 为准。

| 文件 | 内容 |
|---|---|
| `AnatomyMap.dc.html` | 全肌群人体图：男 / 女、正背面、15 组肌群、主练发光、编号连线、按身高体重变化轮廓 |
| `Panel.dc.html` | 共享面板：首页三种样式 `hero`（大数字，默认）/ `ring`（肌群环）/ `twin`（双表盘），`map`（今天练这里），`body`（我的山路 · 体型变化） |
| `Theme*.dc.html` | 五主题 × 三种首页样式 |
| `Map*.dc.html` | 五主题 × 男 / 女“今天练这里”页 |
| `Body*.dc.html`、`BodyCompare.dc.html` | 五主题“我的山路 · 体型变化”与同身高不同体重对比 |
| `yaya-wording-v5.md` | Bo 批准的芽芽话术 v5（第 19 节身体变化） |

- 画布中 `/_blob/…` 芽芽头像即仓库 `public/yaya/<pose>-<theme>.webp`。
- 画布里的颜色写在设计稿内；实现时一律换成 `var(--…)` 变量，新增变量写进令牌 JSON 后再生成 `tokens.css`。
