# Cloudflare 免费发布

用户于 2026-10-03 确认采用 Cloudflare 免费方案。当前仅部署本地数据 MVP；不创建 D1/R2、不调用 AI、不升级付费方案。

## 发布内容与路由

Worker 名称为 `fitness`，实际稳定地址为 https://fitness.initdevl.workers.dev 。用户于2026-10-03确认旧网址无须保留数据，并在官方控制台将账号子域名改为initdevl；统筹已核对账号配置并部署。旧fitness-local Worker保留，不再作为正式入口。仅上传生产构建 `dist`。`wrangler.jsonc` 配置 SPA 回退，支持 `/plans`、`/settings` 等页面直接打开和刷新。无需修改现有根路径 BrowserRouter。

## 首次登录与本地发布

在产品工作区运行 `npx wrangler login`，在 Cloudflare 官方授权页完成登录；不要把密码、OAuth 令牌或 API Token 粘贴到聊天。`npx wrangler whoami` 用于确认账号；多账号时应确认目标账号再部署。

发布前执行 `npm run check` 和完整浏览器测试，再执行 `npm run deploy:dry-run`。审查通过后 `npm run deploy:cloudflare` 发布已验证的 dist；该命令不隐式构建，避免替换刚验证过的产物。Workers Free 配额适用，不授权升级；当前没有动态 Worker 脚本。

## GitHub 发布流程（2026-10-12 起）

三个工作流，正式环境的发布与回滚都要 Bo 在 GitHub 上批准：

| 工作流 | 触发 | 审批 | 步骤 |
| --- | --- | --- | --- |
| `deploy-preview.yml`（Publish a Fitness preview） | 任意分支手动运行，选择预览目标 | 无 | 检查配置不含正式 Worker/D1/KV → `npm run check` → 部署预览 |
| `deploy-cloudflare.yml`（Publish Fitness to Cloudflare） | 只能从 `main` 手动运行 | `cloudflare-production` 环境审批 | 快检查（规则检查、类型检查、单元测试、打包；完整浏览器测试已在 PR 上跑过，Bo 2026-10-22）→ 审批 → 记录当前线上版本 → D1 迁移（`ADMIN_DB`）→ 部署 → 冒烟测试 |
| `rollback-production.yml`（Roll back Fitness production） | 只能从 `main` 手动运行，可填版本号和原因 | `cloudflare-production` 环境审批 | 审批 → `wrangler rollback` → 冒烟测试 |

两个正式工作流第一步都会检查 `cloudflare-production` 环境是否设置了必需审批人；没有设置就直接失败，不会进入测试或部署。

回滚只回退 Worker 代码，不回退 D1 迁移；迁移必须保持向后兼容，旧版本代码要能读新表结构。每次正式发布的运行摘要里记录发布前的线上版本号，回滚时可直接填写。

冒烟测试（`tools/release/smoke.mjs`）只读：`/api/v1/health`、首页、`/api/v1/features`、未登录访问 `/admin` 不返回 200；不登录、不写数据、不调用模型。

版本登记：正式发布工作流在部署前读取线上版本（`wrangler deployments status/versions view --json`），由 `tools/release/registry.mjs` 生成 `ADMIN_RELEASE_REGISTRY`（本次提交、PR、发布时间、上一版本及其数据版本），随 `--var` 与 `--message release=… data=… sha=… pr=…` 一起部署；后台“开关与发布”与回滚检查读取它。手动部署不带登记时，后台只显示线上版本号，回滚按钮禁用并写明原因。数据版本见 `src/domain/release-data-version.ts`，迁移使旧代码不兼容时才递增。

健康检查地址统一以 `src/domain/health-paths.ts` 为准，冒烟脚本与后台“实际发布与检查”共用：`/api/v1/health`、`/api/v1/features`、`/`、`/admin`（管理入口保护检查为 `/api/v1/management/console/releases`）。根路径 `/health`、`/features` 是应用页面路由，返回 HTML，不能用于监控。

GitHub 环境配置：

- `cloudflare-production`：Required reviewers 设为 Bo；Deployment branches 限定 `main`；Secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
- `cloudflare-preview`：不设审批；Secrets 同名，建议使用只能部署预览 Worker 的独立 Token。

Token 按 Cloudflare 官方 Workers 部署权限创建，只授予目标账号所需权限；凭据不写入代码或 Vite 环境变量。

## 线上验证与数据迁移

部署成功后记录实际 URL、Git SHA、Worker 版本与部署时间。在独立浏览器用合成数据检查：五个导航、各页面直接打开与刷新、320px 布局、中英文、训练保存、JSON 下载与恢复。外网与 localhost 数据库独立，用户在本地 Settings 导出 JSON，再在外网导入；不将备份上传到仓库或托管目录。

保留前一个 Worker 版本用于回退；应用回退不等于浏览器数据库回退，不以清空用户数据解决发布问题。首次发布仍有真实手机、原生 Safari/Firefox、屏幕阅读器以及 Dashboard 大历史交互性能的既有验证缺口。

官方参考：[静态资源](https://developers.cloudflare.com/workers/static-assets/)、[SPA 路由](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)、[GitHub Actions 授权](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)。
