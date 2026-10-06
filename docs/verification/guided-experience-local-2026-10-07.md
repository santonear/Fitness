# 引导体验本地验证

日期：2026-10-07。基线：9a8ca5335d5977d0ed8500975d0870def89144f3。
实现工作区：D:/Project/xxgospel/Fitness/.worktrees/fitness-guided；分支：codex/guided-experience。变更尚未提交、推送或发布。

## 实现与边界

| 范围 | 本地结果 | 保留边界 |
|---|---|---|
| A 数据契约 | guidedStates 单集合；数据库5、完整JSON4；严格身份、候选及阶段引用 | 保留旧库/旧合法JSON；旧应用不能默认读取新备份 |
| B 引导 | 单题、数值滚轮/键盘、明确确认、跳过未知、返回/刷新/重启、先看面板 | 示例不自动保存，资料不自动生成体重历史 |
| C 生命周期 | 原子启用/替换、立即暂停、二次确认取消、本地恢复；正在训练独立保留；暂停计时、邀请 | 不自动完成、不补排、不启动第二场；过期不延长 |
| D 对话 | 新严格协议、理解/追问/候选/修订、发送预览、可选有界历史、响应和用户文本留存、纯保存重试 | DEV固定合成样本；真实后端/供应商新协议、阶段容量、配额、取消费用及生产闭环尚未交付 |
| E 备份 | 引导/候选/对话/阶段/事件/测量/邀请完整下载、校验、隔离恢复；旧JSON兼容 | 原16MiB有限上限；不删减事实、不跳过恢复前备份；真机容量未验证 |
| F 面板与回顾 | 今日动作、时间与训练进度分开、阶段事件、完整训练历史入口 | 不以时间100%推定训练完成；历史统计不重算 |
| G 指标及动作 | 体重复用；腰围/体脂可选、来源记录；目标/安全主层、步骤展开 | 腰围/体脂参考；目录指导不冒充历史事实或个体化处方 |
| H 入口与视觉 | 移除手动自定义创建/编辑、保留旧课表只读与训练；北欧极简主题、窄屏与双语 | 正式AI关闭；旧公开版本未由本轮发布替换 |
| UX-23 主题限制 | 服务端固定职责、严格主题决策/拒绝契约、有效related判定与预算门禁、DEV注入拒绝保留内容 | 没有真实语义分类器或生产路由接线；不承诺绝不越界或拒绝必免费 |

允许与当前健身目标相关的一般饮食、睡眠和恢复；无关娱乐、编程、投资拒绝，不提供诊断、处方或治疗。具体限流阈值和真实识别效果仍待验证。

## 验证证据

环境：Windows；本地Chromium/WebKit，320px起；独立5230服务及合成IndexedDB库。不是iPhone/Android真机、原生Safari或Linux CI证据。没有真实供应商调用或外部数据库操作。

- `npm.cmd run typecheck`：通过。
- `npm.cmd test -- --configLoader runner`：44文件、312项通过。
- `npm.cmd run build -- --configLoader runner`：通过，生产包不启用合成对话。
- `git diff --check`：通过（Git提示LF/CRLF转换，不是差异错误）。
- 新生命周期/备份/界面/有界历史共24项浏览器断言通过：Chromium/WebKit各12项。生命周期/备份整批16项正常exit0；新增编辑保护2项及历史2项另行正常exit0；UI最终6项正常exit0。编辑保护是原16项中的受影响复跑，不重复计数。
- 旧关键回归58个不同浏览器用例均有有效通过证据：首轮52项通过，6项因旧测试版本号/已移除手动入口假设失败；更新fixture后补跑。相关训练文件8项通过，CAL备份最终6项通过；未更改业务断言或放宽备份校验。

合计82个不同浏览器用例，证据来自分次验证，不能表述为一次完整浏览器套件82/82。当前全仓库浏览器套件含旧手动计划流程，尚未全部适配/重跑；不能宣称全套浏览器测试通过。

关键测试文件：

- tests/e2e/guided-lifecycle.spec.ts：输入依赖、暂停、事务回滚、原训练保真、阶段替换、子计划保护、恢复代次、外来占用、有界只读历史。
- tests/e2e/guided-backup.spec.ts：真实下载、完整新实体、现库备份、隔离恢复、失败及并发保护。
- tests/e2e/guided-ui.spec.ts：欢迎示例/刷新/重启、双语320px、确认前不生效、主题拒绝保留输入与候选、暂停、离线恢复和逐组记录。
- tests/unit/guided-ai-contracts.test.ts、tests/backend/guided-topic-policy.test.ts：严格身份/日期/容量/确认、主题决策、不可信system输入、拒绝无候选、预算失败不重试。
- tests/unit/guided-backup.test.ts：完整引用、旧格式、错误与篡改拒绝。

UI截图：本工作区 test-results-guided/guided-ui-* 下的 welcome-zh/en-320.png、candidate-zh/en-320.png、dashboard-zh/en-320.png。Chromium/WebKit各保存双语画面，所检范围无横向溢出。

## 复跑

先在独立终端启动本地合成服务：

```powershell
$env:VITE_GUIDED_DEMO='1'
node node_modules/vite/bin/vite.js --config vite.guided.config.ts --configLoader runner --host 127.0.0.1 --port 5230 --strictPort
```

另一个终端：

```powershell
$env:GUIDED_EXTERNAL_SERVER='1'
node node_modules/@playwright/test/cli.js test --config playwright.guided.config.ts --workers 1
node node_modules/@playwright/test/cli.js test --config playwright.guided-regression.config.ts --workers 2
```

Windows自动管理Vite子进程曾在测试全部输出ok后阻塞退出；独立服务器模式已取得exit0。node_modules链接的配置缓存写入权限问题通过runner和工作区独立缓存解决，不据此改变依赖或生产支持范围。

## 继续开发与发布前条件

新协议供应商适配、真实语义识别及多日质量、费用/去重/取消/待核算需继续实现和验证。K/B/阶段范围、token和费用预留、对话配额/支持资源不能把合成7日期/31天/4动作/4组限额直接当生产承诺。模型/真实测试和正式上线遵循单独的资源及发布边界。

真机继续暂缓；未知容量与供应商数据留存明确保留未验证状态。完整JSON4可由新应用读取旧合法文件；回退至只支持JSON2/3的旧应用无法读取新文件，发布/回退必须保留数据出口说明。
