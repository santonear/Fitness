# 预览环境本地准备

在项目根目录运行。这里的脚本只准备本地预览文件，不会调用 AI 或修改云端环境。

1. 将现有预览密钥文件保存在 `.secrets/assistant-preview-secrets.json`。脚本在文件缺失时会停止，避免重新生成并覆盖正在使用的密钥。如果该文件没有 `DEEPSEEK_API_KEY`，可将评测用密钥放在 `.secrets/deepseek-eval.env`；不要提交这两个文件。
2. 运行 `node tools/preview/prepare-assistant-preview.cjs`。初始化 SQL、测试会话和邀请码只写入被忽略的 `.secrets/`。
3. 如需生成本地评测配置 SQL，运行 `node tools/preview/prepare-eval-config.cjs`。它生成 `.secrets/assistant-eval-config.sql`，不会执行该 SQL；目前预览每日消息上限配置为 100。

`.cache/` 中的同名脚本仅供旧本地流程兼容；以 `tools/preview/` 为维护入口。不要把 `.secrets/` 中的文件加入 Git 或 PR。
