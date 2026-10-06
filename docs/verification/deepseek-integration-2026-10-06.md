# DeepSeek接入整合验收（2026-10-06）

基线502ab1c23884b98e7e33105f22ffa60a24901711；工作区D:/Project/xxgospel/Fitness/.worktrees/fitness-gemini，包含既有未提交供应商适配。实施计划docs/superpowers/plans/2026-10-06-deepseek-integration.md。

## 已完成

服务端：新增deepseek-worker.ts与5项测试，显式选择deepseek、独立DEEPSEEK_API_KEY，固定官方HTTPS地址，拒绝目的地覆盖/错误供应商。默认disabled/control-only不调用模型。鉴权、origin、账本启用及未知费用保留有模拟证据；默认部署入口未改。

客户端：client.ts新增成功响应身份与validateCandidate校验、手动重定向拒绝、错误清洗、无自动重试；7项边界测试覆盖实际ControlService成功响应兼容（context/accounting附加字段被投影丢弃，不误拒合法响应）。相关单元21/21通过。独立针对性审查无阻断问题。

整合npm run check：198/198单元、31测试文件，类型检查及构建通过。git diff --check通过。DeepSeek显式入口wrangler deploy --dry-run成功，仅本地打包。5220隔离端口Chromium/WebKit22/22通过（19.7秒），覆盖显式本地演示、发送确认、候选编辑/本地保存、资格未知、兑换、待核算/全局预算/结果丢失及无自动重试。

浏览器首轮未执行用例：隔离配置服务cwd错误，修正后缺少Playwright浏览器。补齐项目.cache/playwright中的Chromium/WebKit后完成上述通过结果。未将环境启动失败计为产品缺陷，未用桌面WebKit代替真机。

## 费用与结果交付评审

DeepSeek usage可用于估算；缓存、峰谷价格、时段锚点与扣费精度须分别核实。created未明确为计费时段锚点，余额查询不提供请求关联账单；并发、充值/赠送变化会影响余额差，不能直接结算单请求。

资料：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ 、https://api-docs.deepseek.com/api/create-chat-completion/ 、https://api-docs.deepseek.com/api/get-user-balance/ 。费用公式可按(hit*hitRate+miss*missRate+output*outputRate)/1000000估算，但不可作为已核验actualCost。

当前codec不返回actualCost，控制链路必进入ACCOUNTING_PENDING。这一点由新增服务端测试证明，不宣称完整真实AI前后端闭环已完成。

待决定方案：有效候选通过校验后可返回accounting=pending；账本完整保留预留/次数/去重，取消先发生则不交付，pending继续阻止新请求；候选正文不落后端库。界面明确待核算，本地可编辑保存。需要修改ControlService、公共响应、客户端及提示行为，并测试取消并发、畸形费用/候选、重复请求、状态刷新失败不丢候选。此方案本轮仅具体评审，尚未实现，不以余额上限变更取消生产预算规则。

## 状态与证据边界

本轮无真实供应商新增调用、资源创建、控制库变更、Git提交推送合并或部署。现有公网AI关闭状态不变。真实手机、供应商实际账单、内容质量及完整浏览器回归未新增验收。既有DeepSeek四项合成通过证据见deepseek-validation-2026-10-06.md，不能代替正常控制链路的费用门禁。
