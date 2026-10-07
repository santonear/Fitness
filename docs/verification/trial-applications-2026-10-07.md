# 试用申请与管理后台：本地实施及验收

日期：2026-10-07。基线：9395395d896ad149cadf49324f2e1460992ee2ea。
工作区：D:/Project/xxgospel/Fitness/.worktrees/fitness-guided。
分支：codex/trial-applications。本记录对应未提交本地实现，不是公网发布记录。

## 已实现

- 首次 onboarding 先查询 AI 资格；有效资格继续引导，无资格可申请、兑换或进入本地面板。
- /trial 提供申请、凭证查询、私密领取链接、领取、延期及补发入口；设置和 AI 页提供链接。
- /admin 提供申请审批、资格撤销、预算和待核算查看、人工核算、最近操作记录及保留期清理。
- 新资格领取后 30 天有效；批准后领取窗口 7 天。延期从 max(原到期日, 批准时刻) 延长 30 天；补发保留原期限。两者均保持主体、个人用量及费用记录。
- 同一申请和领取幂等。领取响应丢失后可恢复同一会话；被撤销的会话不能通过旧领取链接复活。
- 申请只接收称呼与可选说明，不收邮箱、训练资料或模型正文；随机凭证只在客户端保管，服务器保存带用途前缀的 HMAC。
- Cloudflare Access 签名、issuer、audience、期限与单管理员邮箱校验；Turnstile 服务端校验 hostname/action。缺失配置时拒绝访问或新申请。
- 管理页与管理接口均经过 Worker，静态资产优先级包含 /admin 和 /admin/*。管理密钥仅由服务端转接内部受保护接口。

## 事务与数据边界

为保证审批、发码、兑换和延期全成全败，申请元数据使用既有账本 CAS 事务中的可选 applications 字段。旧账本无需初始化该字段，旧费用和请求字段不改写。未新增训练数据库、账号同步或备份字段。

初始工程保护为最多 200 条申请记录，同一私密凭证 24 小时最多一条新申请；重复同 ID 的相同请求不占新记录。超过容量明确拒绝，不提高账本字节上限或裁剪费用记录。更大规模的独立申请表、跨表事务与实际公网防滥用能力仍需平台验证；不能将这一上限称为正式容量承诺。

未获批申请关闭后 30 天可清理；获批申请在资格结束、未决费用处理完毕后 30 天可清理。后续人工核算会记录申请相关费用处理时间，避免费用刚核清就提前删除申请资料。清理仅删除申请资料，保留资格、用量、账本和必要操作记录；首期由管理员执行保留期清理，未创建定时任务。

## 验证

- npm run check：类型、357 项单元测试、生产前端构建通过。
- 新后端 16 项测试：并发审批/领取、HTTP 申请至资格查询、续期和补发保真、并发延期、撤销、7 天失效、费用未决保留及结清后 30 天清理；JWT、白名单、伪造头、跨源管理请求、Turnstile 校验与失败关闭。
- 新浏览器 10 项：中英文申请/待审核/刷新/领取/引导、服务不可用时进入本地面板、管理审核；Chromium/WebKit。申请与管理界面检查 320/375/390/430/768/1024/1280/1440px。界面 HTTP 和 Turnstile 为隔离模拟。
- 现有 AI HTTP 传输 UI 26 项通过：资格、预算错误、待核算候选、确认保存及状态未知。
- Worker production 配置 dry-run 通过；未部署，未连接或修改远端 D1。
- 原 onboarding/生命周期/完整备份的 36 项浏览器回归：首轮 35 项通过，一项 WebKit 中文步骤切换超时；未修改该用例或原引导行为，单独复跑该项通过（26.8 秒）。间歇性原因未确定，不声称已修复。共 36 个不同用例具有通过证据，不表示首轮全绿。
- 新界面补充响应结构校验后，新浏览器 10/10 复验通过（19.7 秒）。新增类型约束中的可选字段差异已修正，随后类型检查通过。

新浏览器命令：node node_modules/@playwright/test/cli.js test --config playwright.trial.config.ts。
既有 AI 回归命令：node node_modules/@playwright/test/cli.js test --config playwright.guided-live.config.ts。
本地原引导回归配置位于 .superpowers/trial-regression.config.mjs，隔离 5242 端口；新流程使用 5240，既有 AI 传输使用 5231。未改动原 5173/5230 服务。
Windows 使用项目现有浏览器缓存 D:/Project/xxgospel/Fitness/.cache/playwright。CI 已加入新配置，但本轮尚未运行 Linux CI。

## 复用与依赖

## 发布前针对性复核补充

2026-10-07：新增三项后端边界验证，申请队列达到 200 条后拒绝新记录但仍可恢复同 ID 结果；账本字节超限时申请与审计条目整体回滚；其他凭证无法查询、领取或恢复已经批准的申请。申请和认证相关 19 项测试通过。本轮容量验证为本地 SQLite 隔离数据，不替代真实 D1 资源测量。

复核发现管理页费用输入仅以 requestId 区分，而服务端账本使用 subjectId 与 requestId 的组合。两位用户使用同一 requestId 时，一个输入会同步到另一个核算项。新增 Chromium 用例先复现失败，再将输入状态按组合身份区分；测试还核对提交的 subjectId、requestId 和金额，不只检查展示。没有更改预留、核算或费用释放规则。

上线前仍需完成独立审查、真实 Access 登录与 Turnstile challenge、隔离真实 D1 并发/容量验证及公网提交频率控制。已有每凭证每天一条申请与总 200 条记录上限，不等于跨凭证防滥用已验证。

## 复用与依赖

继续复用现有 ControlService、D1/SQLite CAS、资格 cookie、预算核算和项目视觉变量。新增 jose 精确版本 6.2.12，MIT；用于标准 JWT 验签和 JWKS 获取，不自行实现 JWT。依赖锁文件仅新增该包，生产依赖 audit 为 0 个已报告漏洞；这不是全面安全证明。

完整依赖审计报告既有 wrangler → miniflare → sharp 链的 3 个 high 条目，关联 GHSA-wq5f-xc86-pv6w。该链版本未由本轮修改；不执行 audit 建议的破坏性降级，需单独评估开发工具升级。

## 正式接入前置

1. 唯一管理员邮箱、ADMIN_ACCESS_ISSUER、ADMIN_ACCESS_AUD 和 TURNSTILE_SITE_KEY 已写入本地配置，并补齐到正式 Worker；远端回读四项一致。后台不提供输入管理密钥的界面。管理员实际登录仍待验证。
2. 配置 Cloudflare Access，保护 /admin、/admin/* 以及 /api/v1/management/*；验证真实登录、退出、未授权、过期和直接 API 请求。不要把整个普通训练站点设为管理员专用。
3. 配置 Turnstile，绑定正确站点 hostname；TURNSTILE_SITE_KEY 为公钥，TURNSTILE_SECRET_KEY 仅服务端 Secret。验证实际 challenge、hostname/action、重放与异常网络；补充公网提交频率控制。
4. 在隔离环境验证真实 D1 并发与新增元数据容量、Workers CPU，以及不同 origin 和预览/正式配置隔离。管理页当前展示控制数据，不将开关开启或 HTTP200 当作模型可用证明。
5. 独立确认部署配置与版本，保留生产费用和撤销记录。wrangler.production.jsonc 仍默认 disabled，不得覆盖当前运行配置后误称 AI 已启用。

尚未验证真实管理员登录、Turnstile challenge 提交闭环、真实 D1 本轮新流程、手机、Linux CI 或供应商连接。代码尚未提交、推送、合并或发布；没有新增模型调用或数据库写入。后续配置核对见下节。

## 正式接入配置核对

2026-10-07：Access 应用和 Turnstile widget 已在控制台创建。正式 Worker 原有 TURNSTILE_SECRET_KEY 加密绑定存在；仅补齐四项公开参数，回读确认原有绑定保持一致，包括模型运行模式、预算配置、D1、资产和 Secret 绑定元数据。未读取 Secret 明文，未上传新版代码。

- Turnstile 管理 API 返回 200：Managed，唯一域名 fitness.initdevl.workers.dev，no_clearance。
- 公开首页返回 200 HTML；未登录访问 /admin 和 /api/v1/management/applications 均返回 302，跳转 tiny-firefly-ed38.cloudflareaccess.com。
- /api/v1/trial/application-config 返回 404 JSON：现网仍未发布新版申请接口，不能据配置成功宣称申请或后台已可用。
- 配置变更及回读证据：本地 .superpowers/trial-config-evidence.json，仅记录非密钥配置及检查结果。

本地截图已核对：申请页保留暖色纸面、黄色标签与橙色主操作；管理页使用独立侧栏、预算摘要和审核列表。截图来自合成数据，不代表正式环境记录。

官方依据：
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

## 管理员恢复额度：本地验证

2026-10-07 用户确认恢复本月剩余次数至默认上限，当前目标理解 8 次、计划生成 4 次。后台新增原因、确认、同次操作重试和恢复记录。累计用量不清零，费用账本及资格不改变。

- 首先运行 5 项新测试，全部因 restoreQuota 未实现失败；实现后通过。
- 后端回归 154 项通过；随后新增边界测试，最终额度恢复与管理认证两组 13 项通过，覆盖有限额度、用户隔离、重复操作、修改输入冲突、预算耗尽、权限、严格请求格式、Shanghai 跨月和未核算预留保持不变。
- Chromium / WebKit 14 项申请和管理页测试通过，其中恢复操作验证确认取消、默认次数提示及失败后携带同一操作 ID 重试。
- 类型检查、前端构建及差异格式检查通过。新增后台代码为本地未提交版本；未发布，未修改正式数据库，未调用真实模型。上述合成测试不替代真实 Access 登录、Turnstile 与 D1 的上线验证。
