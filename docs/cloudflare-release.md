# Cloudflare 免费发布

用户于 2026-10-03 确认采用 Cloudflare 免费方案。当前仅部署本地数据 MVP；不创建 D1/R2、不调用 AI、不升级付费方案。

## 发布内容与路由

Worker 名称为 `fitness-local`，使用账号的稳定 workers.dev 子域名；实际地址在成功部署后记录。仅上传生产构建 `dist`。`wrangler.jsonc` 配置 SPA 回退，支持 `/plans`、`/settings` 等页面直接打开和刷新。无需修改现有根路径 BrowserRouter。

## 首次登录与本地发布

在产品工作区运行 `npx wrangler login`，在 Cloudflare 官方授权页完成登录；不要把密码、OAuth 令牌或 API Token 粘贴到聊天。`npx wrangler whoami` 用于确认账号；多账号时应确认目标账号再部署。

发布前执行 `npm run check` 和完整浏览器测试，再执行 `npm run deploy:dry-run`。审查通过后 `npm run deploy:cloudflare` 发布已验证的 dist；该命令不隐式构建，避免替换刚验证过的产物。Workers Free 配额适用，不授权升级；当前没有动态 Worker 脚本。

## GitHub 手动发布

`.github/workflows/deploy-cloudflare.yml` 仅允许从受信任集成分支 `codex/fitness-implementation` 手动触发，不因 UI/UX PR 或普通推送自动发布。作业重新安装锁定依赖，运行类型检查、单元测试、构建和完整浏览器测试，成功后发布同一产物。并发部署串行执行。

GitHub 环境 `cloudflare-production` 配置 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。Token 按 Cloudflare 官方 Workers 部署权限创建，只授予目标账号所需权限；凭据不写入代码或 Vite 环境变量。工作流需先进入仓库默认分支，才会显示手动运行入口；修改默认分支或整合集成分支由统筹统一处理。

## 线上验证与数据迁移

部署成功后记录实际 URL、Git SHA、Worker 版本与部署时间。在独立浏览器用合成数据检查：五个导航、各页面直接打开与刷新、320px 布局、中英文、训练保存、JSON 下载与恢复。外网与 localhost 数据库独立，用户在本地 Settings 导出 JSON，再在外网导入；不将备份上传到仓库或托管目录。

保留前一个 Worker 版本用于回退；应用回退不等于浏览器数据库回退，不以清空用户数据解决发布问题。首次发布仍有真实手机、原生 Safari/Firefox、屏幕阅读器以及 Dashboard 大历史交互性能的既有验证缺口。

官方参考：[静态资源](https://developers.cloudflare.com/workers/static-assets/)、[SPA 路由](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)、[GitHub Actions 授权](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)。
