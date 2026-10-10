# 旧版界面生成的迁移样本

这些是自动化通过旧版真实界面输入的合成资料，不是真实用户备份。没有直接写数据库，也没有手写备份 JSON。`generate.mjs` 使用 Playwright 点击“设置 → 备份与恢复 → 导出 JSON”，在全新浏览器上下文通过恢复向导导入，再次从界面导出。

来源：V5 PR19 `dc76b50`、V6.2 PR21 `e94c59f`、V7.1 PR24 `9d2a212`。完整提交号、浏览器版本、文件 SHA256 见 `manifest.json`。截图记录导出界面；`*-pre-restore.json` 是恢复向导要求下载的空库安全副本。

当前覆盖引导资料、旧版恢复再导出、过去及未来日期的手动计划（保留动作备注与组时序）、体重，以及计划两组全部完成和只完成一组的训练事实及组备注，另保留一个未来未开始的计划。旧版这两种训练的状态均为 `completed`，部分完成以实际组数和原始目标体现，并非旧版具有 `partial` 状态。V6.2/V7.1 另通过界面修改提醒设置并刷新核对；提醒按规范仅保存在设备表，不进入导出 JSON。提醒迁移应通过设备数据库升级验收，该升级验收尚未执行。本批不能作为完整迁移验收。

运行前，在主仓库 `.worktrees` 下创建 `fitness-v8-legacy-v5`、`fitness-v8-legacy-v62`、`fitness-v8-legacy-v71`，分别检出上述提交，准备对应依赖。V7.1 还需运行目录素材构建或复用该相同提交已验证的生成素材。脚本自行在 5291–5293 启动及关闭服务。

从 B 工作树运行：`node tests/fixtures/legacy-backups/generate.mjs`。Windows 如浏览器缓存路径受沙箱影响，设置 `PLAYWRIGHT_BROWSERS_PATH` 为本机已安装浏览器目录。生成过程拦截所有 `/api/` 请求为不可用，没有模型调用，也没有模拟生成计划。重新生成会产生新的 UUID 和时间戳，并更新文件哈希。

完成后追加备注：旧版无此数据，这是 V8 新增功能，不属于旧版样本缺口。样本中的动作备注及实际组备注均在完成前通过界面输入，不能当作完成后追加备注；V8 新增功能的验收另行执行。

V7.1 芽芽计划使用独立生成模式：`node tests/fixtures/legacy-backups/generate-coach.mjs`，不会重写原来的九份主要样本。该模式通过界面输入成年资料，展开并确认训练时间，使用脚本中固定的本地模拟“理解目标 / 生成计划”响应，核对候选、修改计划名称并明确确认保存，最后从设置页导出 `v71-coach-plan.json`。`coach-manifest.json` 保存来源、哈希和模拟调用说明，`v71-coach-confirmed.png` 记录已保存界面。所有非本地服务的请求均被阻断，没有真实模型调用；这验证旧版界面保存及导出链路，不验证模型质量或真实供应商服务。模拟响应不直接写数据库，JSON 文件来自浏览器实际下载。

验证：`node node_modules/vitest/vitest.mjs run tests/unit/v8-legacy-ui-backups.test.ts`。

芽芽样本验证：`node node_modules/vitest/vitest.mjs run tests/unit/v8-legacy-coach-backup.test.ts`。
