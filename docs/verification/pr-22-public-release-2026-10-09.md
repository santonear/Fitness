# PR #22 公网发布验收 — 2026-10-09

- PR：https://github.com/santonear/Fitness/pull/22，已合并。
- 合并提交：`ac130faae82d16f43cd7fabacb1be5f9b764aab6`。
- CI 验证提交：`b26f04b221589c17a7697e34cf4eb0bbacb95570`；合并后 Git tree 无差异。
- 公网站点：https://fitness.initdevl.workers.dev/exercises
- Cloudflare 版本：`65863e31-c7d8-4aee-92ab-a8156806ba68`。
- 发布开始：2026-10-09 17:04:40（Asia/Shanghai）。
- 回滚参考版本：`8ecc2589-cf21-42d4-8379-50abb1e1888e`，本次未执行回滚。

## 发布内容

全部 637 个 RepDB Free 动作及 1,126 张 WebP 图已集成。保留原有动作定义；合并 walking/plank 对应身份后，共 639 个目录条目。中文名称和搜索别名可用，动作说明保留英文并明确标注。

图片卡片、动作详情及 Settings → About & credits 均通过共享组件显示可点击的 **Exercise data by RepDB**。公开 Git 不含原始数据包、生成的批量 JSON 或批量图像；应用仅提供所用静态资源，无原始数据集下载接口。许可证与来源说明见 `third_party/repdb`。

## 验证证据

[最终 GitHub CI](https://github.com/santonear/Fitness/actions/runs/37906729292) 全部通过：

- 类型检查、457 项单元测试（61 文件）及生产构建。
- 窄屏 WebKit 预检 3 项。
- 主浏览器回归 356 项。
- AI 传输流程 30 项，试用资格 34 项，V3.1 回归 96 项。
- 合计 519 次浏览器检查；包含单独执行的预检，不声称全部为独立用例。

本地补验：拆分后的视觉矩阵 14 项、训练记录 8 项、Onboarding 两浏览器各五轮共 20 项、V3.1 全组 96 项通过。重复验证用于定位 CI 时序问题，不重复计入 CI 总数。

公网部署后验证：

- 26 项页面、API 和管理权限边界检查通过。
- 19 个关键静态资源与本地产物字节一致，包括 5 张代表性 WebP、应用包及来源/许可证文件。未声称逐一下载验证全部 1,126 张图片。
- 产物清点确认 1,126 张 WebP，无 premium、原始 ZIP 或 free.json。
- Chromium / WebKit × Atlas / Serene / Orbit × 390 / 1440px，共 12 组显示检查通过。
- 在线目录 639 条、搜索、单图/双图加载、详情署名和 Settings 来源链接通过；移动 Orbit 截图已目视检查。
- 发布前后所有既有非资源绑定、密钥绑定及 CONTROL_POLICY 保持一致；数据库账本 revision 和 state 均不变。
- 真实 AI 请求为 0；浏览器验收主动拦截模型接口。

截图：`outputs/repdb-public/{chromium,webkit}-{atlas,serene,orbit}-{390,1440}.png`。
脱敏结果：`.superpowers/repdb22-public-release-result.json`、`.superpowers/repdb22-public-browser-result.json`。这些是本机发布证据；包含生产配置/账本的其他私有文件不得提交或公开。

## CI 修复与限制

Node 24 直接加载生成 JSON 时必须声明 JSON import attribute。大型多页面/语言/尺寸用例拆成独立场景并保留所有断言；训练记录长流程给予独立时间预算。整条流水线的 20 分钟上限曾中止最后一组，调整为 30 分钟。WebKit 的受控复选框改为点击后等待已提交的选中状态，避免即时 check 校验时序竞争。分支 push 不再与 PR 重复触发整套 CI，main push 和 PR 门禁保留。

这是桌面 Chromium/WebKit 的响应式验证，并非真机验收。未进行付费模型生成、专业动作审校或完整中文说明翻译。未修改既有价格有效期配置；本次结果不证明 AI 供应商当前可用。未加载的图片与说明仍需要网络。
