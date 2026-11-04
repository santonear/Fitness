# ESA 维护约定

2026-11-02 用户要求：Fitness 后续使用专门分支维护 ESA。

- 专用分支：`codex/esa-maintenance`。
- 每次工作先同步最新 `origin/main`，保留尚未合入的工作，不以旧实现作为新基线。
- 范围：ESA 回源、缓存、证书与域名接入，以及应用对 ESA 代理入口的兼容。
- 改动通过 PR 合入 `main`；生产部署及安全边界变更仍遵守项目审批规则。
- 不替换或关闭原 `fitness.initdevl.workers.dev` 入口。
- 当前测试入口为 `https://test.yafit.asia`，回源到生产 Worker；测试域名不代表独立数据库或独立生产配置。
- `CONTROL_ORIGINS` 中的代理来源和回源来源必须精确匹配；不通过伪造转发头绕过校验。
- 每次发布记录提交、CI、上一生产版本、原站及代理入口验证结果；HTTP 通畅不等于大陆实际访问速度或付费 AI 全流程通过。
