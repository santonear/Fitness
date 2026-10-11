# 后台重构执行记录（唯一实施计划）

基线 main 2607ea0；集成分支 codex/admin-integration。唯一规范 docs/uiux/UIUX20261008.md 第1部分13节。源交接文档与原型保留入库；后续规范只改唯一入口。

## 文件所有权
- ① 统筹：src/ui/admin/shell/**、src/ui/admin/users/**、src/ui/admin/todos/**、src/ui/admin/shared/**、src/backend/admin/core/**、src/backend/admin/users/**、management-auth.ts、fitness-worker.ts、ManagementPage.tsx；后台路由与导航；tests/admin/core*、users*；migrations/admin/1_*；docs。
- ② 开关发布：src/backend/admin/releases/**、src/ui/admin/releases/**、tests/admin/releases*、migrations/admin/2_*；需要改 feature-config、提示词选择等共享入口时提供补丁说明给统筹。
- ③ 费用配置：src/backend/admin/finance/**、src/ui/admin/finance/**、tests/admin/finance*、migrations/admin/3_*；运行配置进入业务准入及公告前台入口由统筹接线。
- ④ 质量提醒：src/backend/admin/quality/**、src/ui/admin/quality/**、tests/admin/quality*、migrations/admin/4_*、public/admin-*；错误上报与业务统计共享入口由统筹接线。
- 各线可新增自己目录的中英 copy.ts、route-entries.ts。不得直接修改全局路由、共享接口或其他线文件；共享变动由统筹合入。

## 共享边界
四条线分别在独立 worktree / branch；统筹承担①以满足运行时最多4个Agent的上限。①先交付外壳/令牌/对话框/提示条/服务端新鲜Access/重验前端/待办注册小PR，其余线先后端。
共同管理入口 /api/v1/management/console/{users|releases|finance|quality}/...；外层验证Access身份、CSRF、freshness和幂等。各线导出 handleX(request, context): Promise<Response | undefined>，context包含 env、actor、now、fresh、requestId。契约初版由①提供。
管理新表使用独立管理库（ADMIN_DB），不修改既有CONTROL_DB表；读取旧控制数据仅通过显式脱敏projection。预览独立资源，生产关闭adminConsole。操作必须真实持久化；缺后端/权限显示不可用，不模拟成功。
统一 registerTodoSource({id,evaluate})；各线返回纯数据来源；汇总页不各自拼待办。

## 顺序与验收
1. 文档入库，唯一规范合并，原型浏览器检查。
2. ①共享小PR；②③④并行后端。每线添加迁移、隐私/鉴权/幂等契约测试。
3. 小PR CI全绿合入集成；所有线接前端。整合消费者并保留旧后台功能对照。
4. 全套类型/单元/必要浏览器、隔离预览；390/320/1440/1024八页面截图、可访问性。
5. 通知用户验收；禁止未批准合并main/生产部署。真实Access重验及推送必须与模拟证据分开。

## 待审决定
- 现行无限额计划准入保留；待核算待办仅在实际paused时说调用暂停，不能恢复已取消的全局阻塞。
- 同日规范沿用V8.0.8，合并当日版本记录；不每天多升版本。
- 回滚只允许预登记且数据兼容的上一版本；当前上一部署DB兼容情况必须校验，不能把旧客户端直接回退给DB11用户。
- 默认不上传错误；本轮开发收集器，生产敏感开关需再授权。

## 当前进度
四条线的首版后端和页面已合入本地集成分支，正在做消费者接线、安全回归和远程 CI 修复。共享外壳 PR 为 #53，尚未宣称全部完成或预览验收通过。

## 已确认的验收安排（2026-10-11）
- 用户确认先完成开发，真实手机添加主屏幕、订阅和收到测试推送的验收稍后进行；模拟及浏览器结果不替代真机结果。
- 用户确认回滚先验证完整模拟流程，专用 Cloudflare 凭据和真实版本回滚验收保留待办。本轮不把本机登录凭据放入应用，也不执行生产回滚。
