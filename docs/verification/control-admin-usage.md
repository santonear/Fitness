# 控制服务管理与核算

管理工具使用 Node 24+，复用受保护的控制接口，不提供训练账号、云同步或公开管理页面。运行前由安全终端环境注入 `CONTROL_ADMIN_SECRET`；不要把密钥放入命令参数、脚本、版本库或日志。服务器仍要求管理鉴权及允许的 origin。

```powershell
node scripts/control-admin.mjs --help
node scripts/control-admin.mjs report --origin https://your-approved-origin
```

`--origin` 必须是已部署且获准操作的完整 HTTPS origin，没有路径、查询或内嵌凭据。文档中的占位 origin 不能直接使用。本轮只通过模拟接口验证工具，没有操作实际远端控制数据。

报告仅包含资格身份及期限、预算已用与预留整数分、次数、请求状态和恢复标识。报告不包含邀请码、session、管理密钥、输入摘要、目标、训练或候选正文。`pending` 不是已结算费用；报告中的金额来自控制账本，不替代供应商账单。

## 邀请和资格

发码、补发仅允许在交互终端显式使用 `--show-code`；邀请码只显示一次，不自动保存到文件。补发继承原期限和次数，不重置待核算占用。

```powershell
node scripts/control-admin.mjs issue --origin https://your-approved-origin --show-code
node scripts/control-admin.mjs revoke-invite --origin https://your-approved-origin --invite-id <inviteId>
node scripts/control-admin.mjs revoke --origin https://your-approved-origin --subject-id <subjectId>
node scripts/control-admin.mjs reissue --origin https://your-approved-origin --subject-id <subjectId> --show-code
```

尖括号参数必须替换；不要把含邀请码的终端输出重定向到共享日志。撤销后的新授权拒绝，不承诺撤回已发送请求或免计费。

## 核算和账本恢复

结算前必须取得并独立核对供应商账单证据。token 计数、模型价格估算和未经关联证明的余额差都不能自动填写 `actualCost`。CLI 的证据确认表示负责人已完成核对，工具本身不会验证供应商账单真伪。

```powershell
node scripts/control-admin.mjs settle --origin https://your-approved-origin --subject-id <subjectId> --request-id <requestId> --actual-cost-fen <verifiedIntegerFen> --evidence-ref <billReference> --confirm-provider-bill
node scripts/control-admin.mjs recovery --origin https://your-approved-origin --confirm-recovery
node scripts/control-admin.mjs reconciled --origin https://your-approved-origin --evidence-file <localEvidenceJson> --evidence-ref <billReference> --confirm-provider-bill
```

`actual-cost-fen` 是已核验的非负整数人民币分，不是占位的零。证据引用不打印、不外发；需要在负责人独立证据记录中保留账单对应关系。恢复证据 JSON 只含 `budgets` 和 `usages`，按既有服务契约提供各月份已用金额及各资格月份次数；不得包含密钥、训练或结果正文。

账本恢复先暂停模型调用并将未决请求保留待核算，逐项核算、补齐完整对账证据后确认。对账不会减少已知费用或次数，也不会自动启用模型。恢复后的启用仍由负责人通过既有受保护配置流程明确执行，CLI 本期不增加启用命令。

请求不跟随重定向、不自动重试。超时、网络中断、坏响应或回复丢失时，修改可能已生效；先读取报告核对，不能直接重复发码、补发或结算。成功响应丢失不代表可安全重复操作。

## 验证

`tests/backend/admin-report.test.ts` 覆盖报告白名单及纯读取；`tests/backend/admin-http.test.ts` 覆盖鉴权、同源、无缓存和不写账本；`tests/unit/control-admin.test.ts` 覆盖命令参数、账单确认、未知结果、无重试及敏感输出保护。具体整合结果见 `ai-pending-delivery-2026-10-06.md`。
