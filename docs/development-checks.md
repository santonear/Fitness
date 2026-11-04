# 开发命令与检查

本文记录当前主线（`origin/main`）的本地开发命令。页面与 E2E 的对应关系、独立配置见
[页面与 E2E 测试对照](testing/page-tests.md)。

## 环境与安装

- Node.js 必须为 24 或更新版本：`package.json` 的 `engines.node` 为 `>=24`，README 也要求 Node.js 24+。
- 使用已提交的 `package-lock.json` 安装锁定依赖：

```sh
npm ci
```

## 先准备生成文件

首次开发或直接运行 `test:unit`、`test:diagnostic`、E2E、引擎检查前，依次执行：

```sh
npm run catalog:prepare
npm run engine:prepare
```

- `catalog:prepare` 从 RepDB 官方 CDN 下载约 27 MB、由 SHA-256 固定并校验的 Free Tier 素材包，缓存在
  `.cache/repdb/`，生成 `src/catalog/generated/` 等运行资源。
- `engine:prepare` 依赖上述目录中的动作数据，编译标注并写入
  `src/engine/generated/exercise-index.json`。
- 下载缓存和两步生成的输出均被 Git 忽略，不应提交。
- npm 的 `predev`、`pretypecheck`、`prebuild`、`pretest` 会自动依次运行这两步。因此 `npm run dev`、
  `npm run typecheck`、`npm run build` 和 `npm test` 会自动准备生成文件。
- 没有 `pretest:unit`、`pretest:diagnostic` 或 `pretest:e2e` 钩子。直接运行这些测试或引擎检查前，先完成上述准备；通过 `npm test` 运行则会自动准备。

## 类型检查

```sh
npm run typecheck
```

该命令执行 `tsc --noEmit`。它的 `pretypecheck` 会先准备目录和引擎生成文件。

## Vitest：单元测试与完整诊断

| 命令                      | 范围                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `npm run test:unit`       | 运行 Vitest，但排除 `tests/training-engine/diagnostic.test.ts` |
| `npm run test:diagnostic` | 只运行 `tests/training-engine/diagnostic.test.ts`              |
| `npm test`                | 先运行 `test:unit`，再运行 `test:diagnostic`                   |

完整诊断会审计 2000 个固定种子 profile 和 200 个极端 profile，可能需要数分钟。证据缓存在
`.cache/engine-full-evidence.json`；来源、输入或种子不匹配时会重新生成。

CI 的 `checks` 任务在测试上只运行 `npm run test:unit`。完整诊断只在 `tools/ci-scope.mjs` 判定为 `full` 范围时、
由 `engine-audit` 任务执行：先运行 `npm run engine:full` 生成证据，再运行 `npm run test:diagnostic`。

## Playwright E2E

先安装浏览器，再运行默认配置：

```sh
npx playwright install chromium webkit
npm run catalog:prepare
npm run engine:prepare
npm run test:e2e
```

Linux CI 安装浏览器及系统依赖时使用：

```sh
npx playwright install --with-deps chromium webkit
```

`npm run test:e2e` 等于 `playwright test`，使用 `playwright.config.ts`。该配置自行启动开发服务器，监听
`127.0.0.1:5291`；可用 `V8_TEST_PORT` 覆盖端口。运行前必须确保所用端口空闲。

其他测试套件使用各自的 Playwright 配置，选择方法见[页面与 E2E 测试对照](testing/page-tests.md)。CI 的 PR
运行只覆盖 Chromium；每日定时和手动运行还覆盖 WebKit。带 `@screens` 标签的测试在 PR 运行中跳过，只在
每日定时和手动运行中执行。

## Lint 与 CI 额外检查

```sh
npm run lint
```

该命令只依次执行：

```sh
node tools/v8/check.mjs
node tools/check-layers.mjs
```

CI 的 `checks` 任务还会额外执行以下命令；它们不属于 `npm run lint`，也不属于 `npm run check`：

```sh
node --test tools/v8/check.test.mjs
node tools/check-coach-client-boundary.mjs
npm run engine:check
```

## 格式化

```sh
npm run format:check
npm run format
```

- `format:check` 执行 `prettier --check .`，只检查，不改文件。
- `format` 执行 `prettier --write .`，会写入格式化结果；`AGENTS.md` 要求提交前运行它。
- `.prettierignore` 将范围限制为 `src/`、`tests/`、`tools/` 中的代码，因此仓库级 Prettier 检查不覆盖
  `docs/`。

## 聚合检查 `npm run check`

```sh
npm run check
```

它依次运行类型检查、`npm test`（单元测试和完整诊断）以及生产构建。构建输出写入被 Git 忽略的 `dist/`。

`npm run check` **不包含** `lint`、`format:check`、`test:e2e`、`engine:check`、`engine:full` 或 coach 客户端边界
检查命令。但完整诊断在缓存证据缺失或失效时，会自动执行 `tools/training-engine/fast.mjs --full`，与 `engine:full` 使用同一脚本，因此 `check` 仍可能运行完整的 2,200 画像评测，并非轻量检查。其余未包含的检查需要分别执行，CI 也会按任务范围补充。
