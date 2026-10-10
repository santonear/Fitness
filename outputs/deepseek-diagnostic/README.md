# DeepSeek 线上连接诊断（2026-10-11）

## 已确认

- V8.0.8线上CONTROL_MODE=external，SUPPLIER_PROVIDER=deepseek，秘密绑定存在，账本AI开关开启。
- 最新一次ONBOARD_PLAN请求的账本状态为pending，错误SUPPLIER_UNCERTAIN。这是聚合错误，无法反推出HTTP、超时、JSON解析或候选校验的具体失败点。
- 经用户批准，使用Cloudflare临时隔离预览继承现有生产密钥，执行一次合成请求；没有复制/输出密钥，没有绑定生产数据库，也没有新增公网入口。
- HTTP200，decode和validateCandidate通过，3045ms。请求输出上限2000token，发送前按UTF-8字节上界+协议余量计算保守成本8分，低于批准10分。调用1次，无重试。结果见one-call-result.json。
- 实测证明现有生产密钥和供应商链路可以工作，不证明原失败已根治。该合成请求使用生产相同codec/候选验证，降低输出上限以遵守费用限制；不是使用用户原始资料重放。

## 发现与边界

- 生产pricingVerifiedUntil为2026-10-08T00:00:00Z，已过期。计划生成的预算限制已按用户旧决定关闭，因此不能将这个过期值直接认定为此次生成失败原因。
- 生产policy未配置summary额度和请求预留，因此AI回顾另有配置缺口；未擅自修改政策。
- 官方价格本次核验：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ （2026-10-11读取）：Flash高峰输入2元/百万、输出8元/百万；保守费用按高峰计算，不表示最终账单。

## 最小诊断补丁

- 新增可选环境变量FITNESS_SUPPLIER_DIAGNOSTICS=errors；未设置时不输出。
- 仅记录supplier_failure、枚举stage和合法HTTP状态码；禁止内容、URL、密钥、请求/用户标识。
- 区分encode/network/http/decode/timeout/candidate；保持原ACCOUNTING_PENDING响应和预留处理，不自动重试、不释放费用。
- 本地15项定向测试、213项后端测试通过（29项原有skip）；类型检查通过。
- 只增加实时诊断，不开启通用遥测或健康数据采集；生产日志是否可追溯仍取决于当前监听，不声称已恢复原请求响应。
