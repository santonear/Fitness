# CAL 首期执行记录

用户已明确批准执行 D:/Project/xxgospel/Fitness/docs/superpowers/plans/2026-10-04-fitness-cal-first-release.md。独立工作区 D:/Project/xxgospel/Fitness/.worktrees/fitness-cal；分支 codex/fitness-cal；父基线7ac773c7904275918b9ff6400b030fde36cbc321；未提交。用户5173服务和公网不修改。

已实现：显式date-day版本union、不伪造周字段；Dexie4/metadata4、新JSON3与旧JSON2兼容；稳定day task身份/内容版本；日期占用/hidden/skipped释放/completed+hidden占用；资料时区及最大民用日重叠纯映射、DST/跨日/平局/跳日夹具；旧操作碰撞预览及事务内依赖复检；全部有效日期训练入口；月历点击/拖选、逐日编辑/保存、受控动作目标及备注；新旧完整备忘与真实文件往返。

RED→GREEN：新日期schema缺失→3测试通过；投影模块缺失→5测试通过；日服务缺失→2浏览器通过；legacy确认模块缺失→2浏览器通过；多日期查询仅返回1→应返回2修复；日UI区域缺失→双语4通过；伪造双新日占用可导入→新备份拒绝修复。

类型/75单元/构建通过。第一轮完整122浏览器：115通过、7失败。已定位：WebKit文件预检时profile未初始化；新Date plans列表旧命名包含Schedule导致模糊选择器重复；故障注入Dexie4现在为现有版本，未实际升级。修复分别为资料就绪后才渲染BackupPanel、改新列表名称、故障注入upgraded.verno+1，断言保留。

Ruling: 逐日编辑仅接入一个日期的保存，用户已确认B=1首期；多选不自动套用/自动保存。不实现多日原子保存或P0扩容。
Ruling: 新版本使用现有tables与显式union，metadata4/JSON3；旧周事实不迁移，旧JSON只规范化运行元数据。回退需兼容构建/升级前备份，不向下迁移真实库。
Ruling: 日计划内容修改更新稳定task到新version，历史旧day版本可没有当前日程；旧session依然固定旧version；completed后不改内容。名称变化不生成版本。
Ruling: 已有日槽遇legacy兼容碰撞，编辑现有内容不会创建新槽；新创建/新改期仍拒占用。

收尾：新增并发/失败/恢复代次与歧义作用域安全测试、手势/Escape/键盘/触摸/草稿/四屏宽/HTTP阻断验证及真实旧本地库升级夹具；今日页/训练周历统一资料时区，新日反馈双语。类型/75单元/构建和完整134浏览器通过，git diff --check通过；一次只读审查未发现新增阻断。实际旧Dexie3能重新打开4，但不兼容新模型，界面和主计划已纠正旧假设。最终证据cal-first-release.md。5190独立预览PID50300已实测200和真实界面截图；5173仍PID34132，原工作区未改。两台真机未连接，发布另批。没有提交/推送/合并/云资源/模型/付费/发布。
