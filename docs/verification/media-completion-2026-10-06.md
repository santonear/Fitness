# 动作媒体来源核验 — 2026-10-06

四个既有动作保留本地原创示意图与文字步骤。视频仅在用户点击后加载 YouTube 隐私增强域名；不下载、托管视频或远端缩略图，不上传训练记录，不增加动作。

## 来源证据

| 动作 | 视频 ID | 核验依据 | 范围 |
| --- | --- | --- | --- |
| Goblet squat | `nfX7IFK9UNI` | [NASM 动作库](https://www.nasm.org/resource-center/exercise-library/goblet-squat)直接链接该视频；YouTube oEmbed 返回标题 `How to do a Goblet Squat \| Proper Form & Technique \| NASM`、频道 `National Academy of Sports Medicine (NASM)` | 杯式深蹲；文字资料涉及胸前持重、屈髋屈膝及受控起身，与既有步骤方向一致。 |
| Walking | `4PR9GedBrZY` | [Leicestershire Partnership NHS Trust 步态资料](https://www.leicspart.nhs.uk/wp-content/uploads/2019/02/660-Advice-on-gait-A4-folded-to-A5.pdf)第 1 页直接链接，明确包含步态示范，制作方为 LLR Falls Prevention Group | 综合防跌倒视频，含其他练习及跌倒后起身；界面明确仅参考步行部分，不将全部内容列为训练建议。[NHS Walking for health](https://www.nhs.uk/live-well/exercise/walking-for-health/)继续作为步行文字背景来源。 |
| Bodyweight squat | `m0GcZ24pK6k` | [YouTube 视频](https://www.youtube.com/watch?v=m0GcZ24pK6k) oEmbed 返回标题 `How to do a body weight squat \| Bupa Health`、频道 `Bupa Health` | 标题与动作匹配；来源状态为出版者元数据，未声称 Bupa 当前网页直接关联该视频。 |
| Plank | `P3FR4GUl2QM` | [Catalyst Athletics 动作库](https://www.catalystathletics.com/exercise/448/Plank/) HTML 的 iframe 指向此 ID | 前臂与脚趾支撑、稳定躯干，与既有步骤方向一致；资料提及的负重变式未加入目录。 |

步行视频的 YouTube oEmbed 精确标题为 `Preventing falls – exercises to reduce your risk of a fall`，频道为 `Leicestershire County Council`（https://www.youtube.com/@LeicestershireCC）；NHS 文档所述 LLR Falls Prevention Group 是制作方，不能与频道名称混同。Plank 的精确标题为 `Plank | Olympic Weightlifting Exercise Library`，频道为 `Catalyst Athletics`（https://www.youtube.com/@CatalystAthletics）。

出版者链接和元数据只证明来源关联、标题及频道信息，不等于视频内容完整审核、真实播放或专业动作审核。步行视频仅有限覆盖步态参考，普通健身步行教学仍未完整补齐，界面明确此限制。步态资料标注 2026 年 1 月复审日期；未确认该资料已有新版本。

## 播放与回退

[YouTube 官方嵌入说明](https://support.google.com/youtube/answer/171780)要求嵌入请求具有 HTTP Referer；缺失时可能出现错误 153。iframe 使用 `strict-origin-when-cross-origin`，向 HTTPS YouTube 仅发送站点 origin，不发送页面路径；来源外链继续 `no-referrer`。不自动播放，也不自动重试。加载失败后可手动重试、关闭或继续阅读本地步骤。

四条视频均保留 `content: not-reviewed`、`playback: not-verified`、`reuseLicense: not-verified`。地区可用性也未验证。网络响应、oEmbed 和 iframe 创建不能证明已真实播放；阻断网络的浏览器测试仅验证应用交互与回退。未取得完整播放证据，因此媒体验收为部分完成。

原创 SVG 的权利声明和未专业审核状态保持不变；参见 [NOTICE](../../public/media/NOTICE.md)。

## 针对性验证

单元测试覆盖四条固定视频映射、来源状态与权利/审核状态分离、冻结的来源元数据、未知身份及任意 URL 拒绝、初始无 iframe 或第三方缩略图。浏览器测试覆盖显式键盘加载、失败/重试/关闭、双语提示、Walking/Plank 精确资源 ID、320px 文字与播放器回退。

首次必要回归执行被 Vite 临时配置写入 `EPERM` 阻断，不能算行为失败复现。最终针对性运行结果由集成检查记录；本文件不声称全套检查或远端播放通过。

最终本地软件验证补录：本轮完整单元测试246/246通过，其中媒体相关8项；Chromium/WebKit媒体两spec共8项通过，覆盖320px、固定资源ID、双语故障/重试/关闭和文字回退。使用拦截网络的浏览器测试，不能作为真实YouTube播放证据。
