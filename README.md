# Fitness

手机优先的本地健身 Web 应用，支持中文/英文、公制、力量/有氧/徒手训练。第一阶段无需登录：手动计划、逐组记录、计时、完成前核对、只读历史和趋势、可选训练资料、体重观察、全量训练备忘及 JSON 备份恢复已实现。

## 在线使用

[Fitness 在线版](https://fitness-local.xxgospel.workers.dev) 已发布至 Cloudflare Workers 静态托管。训练数据仍保存在访问者的浏览器中；本地数据迁移时，在本地“设置”导出 JSON，再在在线版导入。后续优先保持此网址稳定。

发布流程与验证记录见 [Cloudflare 发布说明](docs/cloudflare-release.md) 和 [首次发布验证](docs/verification/cloudflare-release.md)。

## 本地运行

需要 Node.js 24 或更新版本。依赖由 `package-lock.json` 锁定。

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

打开终端显示的本地地址。浏览器以来源（协议、主机、端口）隔离数据，`localhost` 与 `127.0.0.1` 的数据不共享。始终使用同一个地址；换地址前先导出备份。

```sh
npm run check
npx playwright install chromium webkit
npm run test:e2e
```

`check` 顺序执行 TypeScript 检查、全部单元测试及生产构建。浏览器测试启动独占的 `127.0.0.1:5173` 开发服务器；运行前确保该端口空闲。Linux CI 使用 `npx playwright install --with-deps chromium webkit` 安装浏览器及系统依赖。`npm run build` 的输出位于 `dist/`。

## 数据与使用

数据保存在当前浏览器 IndexedDB，没有账号或云端同步。训练偏好全部可选；未填写也可创建手动计划或临时训练。最多一个当前计划及一个进行中训练。每组主动记录后保存；完成前核对实际值，完成记录只读。编辑计划创建新版本，历史版本保留原始起始日期和日程时区。

已打开并加载完成的应用可在断网后使用 SPA 导航、记录训练、查询历史、读写备忘、导出与恢复本地 JSON。关闭后离线重新打开或离线刷新尚未实现；没有 service worker。恢复在当前页面重新读取本地数据，不依赖网络刷新。

浏览器清理、隐私模式或存储不足可能影响本地数据。在“设置”中导出 JSON，并把文件保管到浏览器以外。恢复前校验文件，下载并保管当前备份，然后明确确认整库替换；失败不会部分覆盖。文件上限10 MB，备忘从事实重新建立，AI 备注保留但不改变训练事实。

当前首个 JSON 合约使用 envelope `schemaVersion: 2`，其内部数据库 metadata `schemaVersion: 3`。每个 PlanVersion（包括备忘中的快照）必须包含原始 `startDate` 和 `scheduleTimeZone`。两种版本号管理不同层次。

项目尚未发布过旧 JSON 格式。缺少上述溯源字段的开发备份会明确拒绝，不能准确推造原始日历。数据库 v1 的资料/体重可原子升级至 v3；已有开发 v2 数据库如存在缺失原始日历的计划版本，升级原子中止并显示 `CALENDAR_PROVENANCE_MISSING`，原数据保留。不要通过删除数据库来处理这个错误；应在原开发版本导出保留事实后，人工核实缺失溯源。

## 范围与验证

当前已部署静态前端，不调用 AI、不提供未经审核的图片或视频。AI 理解/计划/总结、邀请码、账号/云同步和媒体为后续工作；设计中的预算和延迟是待验证目标，不是本地版本保证。

- [实际验收与平台限制](docs/verification/local-mvp.md)
- [软件设计文档](docs/software-design.md)
- [技术与部署选型（推荐方案与预算测算）](docs/technology-deployment.md)
- [初始项目启动准备（历史记录）](docs/project-kickoff.md)
