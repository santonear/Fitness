# 旧版界面生成的迁移样本

这些是自动化通过旧版真实界面输入的合成资料，不是真实用户备份。没有直接写数据库，也没有手写备份 JSON。`generate.mjs` 使用 Playwright 点击“设置 → 备份与恢复 → 导出 JSON”，在全新浏览器上下文通过恢复向导导入，再次从界面导出。

来源：V5 PR19 `dc76b50`、V6.2 PR21 `e94c59f`、V7.1 PR24 `9d2a212`。完整提交号、浏览器版本、文件 SHA256 见 `manifest.json`。截图记录导出界面；`*-pre-restore.json` 是恢复向导要求下载的空库安全副本。

当前覆盖引导资料、旧版恢复再导出、过去及未来日期的手动计划（保留动作备注与组时序）、体重，以及计划两组全部完成和只完成一组的训练事实及组备注，另保留一个未来未开始的计划。旧版这两种训练的状态均为 `completed`，部分完成以实际组数和原始目标体现，并非旧版具有 `partial` 状态。V6.2/V7.1 另通过界面修改提醒设置并刷新核对；提醒按规范仅保存在设备表，不进入导出 JSON。提醒迁移应通过设备数据库升级验收，设备升级现已由 `tests/e2e/v8-database-migration.spec.ts` 验证（包含 reminderPreserved、幂等、失败回滚与旧/V8恢复）；集成提交 `327b18a` 的 CI `38064609136` 全部通过。本批仍不是外部真实用户数据验收。

运行前，在主仓库 `.worktrees` 下创建 `fitness-v8-legacy-v5`、`fitness-v8-legacy-v62`、`fitness-v8-legacy-v71`，分别检出上述提交，准备对应依赖。V7.1 还需运行目录素材构建或复用该相同提交已验证的生成素材。脚本自行在 5291–5293 启动及关闭服务。

从 B 工作树运行：`node tests/fixtures/legacy-backups/generate.mjs`。Windows 如浏览器缓存路径受沙箱影响，设置 `PLAYWRIGHT_BROWSERS_PATH` 为本机已安装浏览器目录。生成过程拦截所有 `/api/` 请求为不可用，没有模型调用，也没有模拟生成计划。重新生成会产生新的 UUID 和时间戳，并更新文件哈希。

完成后追加备注：旧版无此数据，这是 V8 新增功能，不属于旧版样本缺口。样本中的动作备注及实际组备注均在完成前通过界面输入，不能当作完成后追加备注；V8 新增功能的验收另行执行。

V7.1 芽芽计划使用独立生成模式：`node tests/fixtures/legacy-backups/generate-coach.mjs`，不会重写原来的九份主要样本。该模式通过界面输入成年资料，展开并确认训练时间，使用脚本中固定的本地模拟“理解目标 / 生成计划”响应，核对候选、修改计划名称并明确确认保存，最后从设置页导出 `v71-coach-plan.json`。`coach-manifest.json` 保存来源、哈希和模拟调用说明，`v71-coach-confirmed.png` 记录已保存界面。所有非本地服务的请求均被阻断，没有真实模型调用；这验证旧版界面保存及导出链路，不验证模型质量或真实供应商服务。模拟响应不直接写数据库，JSON 文件来自浏览器实际下载。

验证：`node node_modules/vitest/vitest.mjs run tests/unit/v8-legacy-ui-backups.test.ts`。

芽芽样本验证：`node node_modules/vitest/vitest.mjs run tests/unit/v8-legacy-coach-backup.test.ts`。

## V8.0.7 上一发布版样本

`generate-v807.mjs` 在隔离检出 `492b9f7d762b319edd1e3e59350c9fb10b8ee6c3` 的实际界面中完成成年引导、基础计划确认、一组训练及部分完成反馈，然后经设置导出。`v807-mainline.json` 是实际下载结果，`v807-manifest.json` 保存来源、哈希和覆盖范围；没有直接写数据库、手写备份或模型调用。

## Training Engine 之前的正式 main 样本

`v8-main-pre-engine.json` 来自正式 main `0165768d37bcee81492c62f8b9ed0a573dd11521` 的隔离检出。`generate-v8-main-pre-engine.mjs` 在 5420 端口的真实界面填写合成身体资料、采用本地计划、完成一组训练并结束、追加体重，再经设置下载 JSON。没有直接写数据库、手写备份内容或模型请求；来源、浏览器和下载文件哈希见同名 manifest。

生成前需启动该固定检出的 Vite 服务，准备相同提交的目录生成素材与本地 Chromium。再从测试工作树执行 `node tests/fixtures/legacy-backups/generate-v8-main-pre-engine.mjs`。脚本拒绝其他基线提交，拦截全部 API 并阻断外部来源；模型费用为零。重新生成会产生新的 UUID 和文件哈希。

`verify-legacy-engine-backups.mjs` 对新版 5421 服务执行真实恢复：每份独立浏览器上下文，通过文件预检、下载现库及双重确认写入 IndexedDB，然后通过界面重新导出。17 份样本全部通过；原有计划、组、日程、体重和已有 V8 训练事实逐项核对，数据库版本 17、备份版本 15，临时自查表为空且不进入备份。`v8-main-pre-engine.restore-manifest.json` 固定本次来源提交、17 个输入与重导出哈希。此证据是合成本地桌面 Chromium 恢复验证，不是手机性能、真实用户数据或模型质量验收。
