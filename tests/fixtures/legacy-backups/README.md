# 旧版界面生成的迁移样本

这些是自动化通过旧版真实界面输入的合成资料，不是真实用户备份。没有直接写数据库，也没有手写备份 JSON。`generate.mjs` 使用 Playwright 点击“设置 → 备份与恢复 → 导出 JSON”，在全新浏览器上下文通过恢复向导导入，再次从界面导出。

来源：V5 PR19 `dc76b50`、V6.2 PR21 `e94c59f`、V7.1 PR24 `9d2a212`。完整提交号、浏览器版本、文件 SHA256 见 `manifest.json`。截图记录导出界面；`*-pre-restore.json` 是恢复向导要求下载的空库安全副本。

当前覆盖仅为引导资料、旧版恢复再导出。计划、训练、提醒、教练计划、体重及追加备注尚未覆盖；本批不能作为完整迁移验收。

运行前，在主仓库 `.worktrees` 下创建 `fitness-v8-legacy-v5`、`fitness-v8-legacy-v62`、`fitness-v8-legacy-v71`，分别检出上述提交，准备对应依赖。V7.1 还需运行目录素材构建或复用该相同提交已验证的生成素材。脚本自行在 5291–5293 启动及关闭服务。

从 B 工作树运行：`node tests/fixtures/legacy-backups/generate.mjs`。Windows 如浏览器缓存路径受沙箱影响，设置 `PLAYWRIGHT_BROWSERS_PATH` 为本机已安装浏览器目录。生成过程拦截所有 `/api/` 请求为不可用，没有模型调用，也没有模拟生成计划。重新生成会产生新的 UUID 和时间戳，并更新文件哈希。

验证：`node node_modules/vitest/vitest.mjs run tests/unit/v8-legacy-ui-backups.test.ts`。
