# AI 候选交付与核算验证

实现基线：61c91c99b0610281e07c3277037ec26a6bb4050a。
工作区：D:/Project/xxgospel/Fitness/.worktrees/fitness-pending。
分支：codex/ai-pending-delivery。

## 验收范围

- A：未知费用且有效候选返回 pending；完整预留、次数及去重保持。非法成本、未知成本下非法候选、供应商失败不交付正文。取消后不交付，独立结算不回退。
- B：校验响应身份、恢复代次、发送确认与核算状态；中英文展示候选、费用与资格状态，状态查询失败保留候选。演示与后端内容来源区分。
- C：受保护元数据报告和命令行管理；复用邀请码、撤销、补发、结算、恢复与对账接口，无自动重试或密钥文件。
- D：本地合成控制链路联合验证，覆盖中英文、四种指标、人工核算前后的请求门禁及元数据隐私；不把 mock 视为真实供应商质量或平台性能证据。

## 证据位置

| 行为 | 证据 |
|---|---|
| pending 候选、取消、成本非法、并发结算、全局门禁 | tests/backend/pending-delivery.test.ts |
| 显式供应商入口、鉴权、默认关闭、无正文存库 | tests/backend/deepseek-worker.test.ts |
| Worker→HTTP 客户端→workflow、中英文四指标及人工核算 | tests/backend/pending-flow.test.ts |
| 管理报告白名单及接口保护 | tests/backend/admin-report.test.ts、admin-http.test.ts |
| 命令参数、独立账单确认、重定向、未知结果和凭据保护 | tests/unit/control-admin.test.ts |
| 客户端成功契约与响应生命周期 | tests/unit/ai-client-boundary.test.ts、ai-workflow.test.ts |
| 浏览器待核算候选与本地保存 | tests/e2e/ai-pending.spec.ts |
| 既有资格、演示、计划保真与训练反馈回归 | tests/e2e/ai-control-status.spec.ts、ai-public-flow.spec.ts、fidelity.spec.ts、feedback.spec.ts |

## 执行环境与状态

Windows、Node 24.14.0；复用锁定依赖，不新增依赖。浏览器使用独立 5224 端口、320px 视口及 Chromium/WebKit，未占用共享 5173 服务。只使用隔离合成数据，没有访问真实训练库。

首次浏览器运行 44 项：40 项通过、4 项发现目标输入门禁回归，保留原断言并修复。独立审查发现切换模式后的内容来源问题，已增加各内容的来源和收到时核算标识，复审未发现阻断。

最终 `npm.cmd run check`：36 文件、226/226 单元测试，类型检查及构建通过。新增后端 pending 回归在修改前证明 3 项失败，修改后通过；管理报告在实现前证明缺失模块，不能把缺失模块当业务行为红证据。

最终受影响 AI 浏览器回归 30/30 通过（33.5 秒）；另 18 项计划保真与训练反馈在首次运行通过，相关代码未变化，复用其有效证据。总计 48 个不同用例有通过证据，不宣称本轮重跑全部浏览器套件。

执行命令：

```powershell
npm.cmd run check
$env:PLAYWRIGHT_BROWSERS_PATH='D:/Project/xxgospel/Fitness/.cache/playwright'
node node_modules/@playwright/test/cli.js test --config .superpowers/playwright.pending.config.ts tests/e2e/ai-pending.spec.ts tests/e2e/ai-public-flow.spec.ts tests/e2e/ai-control-status.spec.ts --workers 2
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config .superpowers/wrangler.pending.jsonc
git diff --check
```

DeepSeek 显式入口 dry-run 通过（disabled 配置，无数据库绑定）；不会创建远端资源或调用供应商。管理报告/接口/CLI 12 项针对性验证及 CLI help 通过。所有 checks 均为本地 Windows 证据，不等于 Linux CI。

## 尚未验证与发布边界

没有本轮真实模型调用、实际账单核对、远端 D1 新事务验证或 production 启用。真正手机仍暂缓；桌面 WebKit 不替代 iPhone Safari。训练内容质量、真实延迟、供应商保留与平台生产容量未由本轮 mock 证明。默认 AI 关闭，K=1，浏览器本地保存和备份规则不变。

收到理解结果后仍需负责人先依据独立账单核算，才可继续计划生成。候选本地保存不结算费用，也不产生完成事实。结算命令中的确认是负责人操作前置，不是自动证明供应商账单真实性。
