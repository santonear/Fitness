# 本地 MVP 验证记录

日期：2026-10-03。自动化浏览器、Windows主机性能和真实设备手测分开记录，不能相互替代。

运行版本：Node 24.14.0、npm 11.9.0、Playwright 1.63.0；实际浏览器启动读取Chromium 153.0.8010.12、WebKit 26.6。WebKit版本为自动化引擎版本，不等于已测某台设备的Safari版本。

## 命令与证据

| 命令 | 观察结果 |
| --- | --- |
| `npm run check`（添加脚本前） | exit1，Missing script: check；真实工具 RED |
| `npm test -- tests/domain/repository.test.ts`（修复前） | 1失败；排队旧代次写入错误地成功 |
| 同一单元命令（修复后） | exit0，1/1通过 |
| `npm run check`（2026-10-03 15:56 Asia/Shanghai） | exit0；typecheck、53/53单元测试及build通过 |
| `npm run check`（16:00，补文件读取错误回归后） | exit0；typecheck、54/54单元测试及build通过 |
| `npm run check`（16:09，补语言写入代次回归后） | exit0；typecheck、55/55单元测试及build通过 |
| `npm ci --cache .npm-cache`（控制器） | exit0，干净安装68个包 |
| `npm run check`（16:13） | exit0；typecheck、55/55单元测试及build通过 |
| `npm run test:e2e`（最终审查修复前） | exit0，66/66通过，3.2分钟 |
| 新增 `workout-backup.spec.ts --project chromium`（修复前） | 3/3失败，真实复现孤立计时器、重复动作排序及跳过后完成导致备份拒绝 |
| 训练、计划、备份和新增回归（修复后） | exit0，Chromium/WebKit共26/26通过，25.2秒 |
| `npm run check`（16:22，最终审查修复后） | exit0；typecheck、55/55单元测试及build通过 |
| 最终 `npm run test:e2e`（含新增回归） | exit0，72/72通过，3.1分钟 |

首次综合浏览器 RED 期间源文件修改触发 HMR，离线结果受到污染，不作为完整流程的有效行为证据。日历回归独立显示旧版本到期计数从1变成0，原始日期/时区缺失。冻结后的英文离线 RED：Chromium在恢复时刷新、节点脱离，无法继续读备忘；WebKit在真实下载文件上传后报JSON读取失败，需以文件诊断定位。既有手动计划、逐组记录等能力无需制造RED。

WebKit诊断：Node读取实际下载文件并JSON.parse成功；context.setOffline(true)下原生上传和[Playwright官方FilePayload](https://github.com/microsoft/playwright/blob/main/docs/src/input.md)上传同一文件的完整字节，Blob.text和FileReader均报NotReadableError。没有用修改备份或暂时联网绕过。这个Windows自动化离线模拟限制不能推断为真实Safari行为。

最终网络隔离分别采用：Chromium context.setOffline(true)；WebKit context.route对全部HTTP(S)请求abort，并断言同源fetch探针失败。WebKit用例只证明HTTP请求被阻断时本地流程可用，不能等同于真实设备断网和文件选择器验证。原生文件选择器在真实手机上的离线读取仍待手测。

## 数据与离线约束

版本拥有不可变日历快照；当前计划日期/时区变更不会重写旧版本截止时间。导入使用每个版本自己的日期/时区校验全部原日程，包含历史版本。DB v3升级遇缺失溯源原子中止、显示错误并保留v2事实。资料/体重v1正常升级。未发布的envelope schema2内部metadata为3，不提供对缺失事实的虚假迁移。

恢复维持整库原子替换、单调递增本地restoreGeneration、dataRevision和备忘一致性。恢复事件先移除旧表单，再采用新代次、语言并重新挂载页面；排队旧写入在事务中核对调用时代次。跨标签页通过IndexedDB/广播/存储事件更新。

综合流程覆盖zh/en手动计划→计划训练→逐组记录→完成前核对→只读历史及趋势→全量备忘→实际JSON下载/上传→确认恢复。断网在首次资源加载后，随后仅应用导航；恢复也在断网状态完成。覆盖320px横向溢出与现有键盘/语义检查。离线刷新、关闭后离线重开不在承诺范围。

## 平台与性能

| 平台 | 验证状态 |
| --- | --- |
| Windows Playwright Chromium | 最终完整回归通过，36/36 |
| Windows Playwright WebKit | 最终完整回归通过，36/36；不能代替Safari |
| 真实iPhone Safari | 未验证，无可用设备/版本记录 |
| 真实Android Chrome | 未验证，无可用设备/版本记录 |
| 桌面Chrome / Edge / Safari手测 | 未验证，无版本及手测结果记录 |

性能目标是在指定参考手机、一万条记录下逐组提交反馈p95<300ms。Windows真实IndexedDB测量使用100个完成训练×100组（10,000条组记录）、全量备忘及随后50次逐组保存，包含事实、metadata及备忘提交；最终10,050组，查询返回100个已完成训练。

| 自动化引擎 | 50次保存p95 / 最大 | 全量历史查询 | 观察范围 |
| --- | --- | --- | --- |
| Chromium | 41.6 / 42.6ms | 73.3ms | Windows服务事务；工程目标通过 |
| WebKit | 233 / 236ms | 108ms | Windows服务事务；工程目标通过 |

66项并行完整回归中再次测得：Chromium p95 154.1ms、最大162.4ms、历史查询201.8ms；WebKit p95 232ms、最大234ms、历史查询110ms。两轮环境负载不同，保留分别实测结果，不能只选择最小数值作为保证。

最终72项回归实测：Chromium p95 154.8ms、最大205.2ms、历史查询184.1ms；WebKit p95 230ms、最大234ms、历史查询106ms。每个引擎同样100个训练、起始10,000组、50次保存及最终10,050组。

WebKit包含播种及清理的完整性能用例耗时约2.8分钟，不能将单次保存p95当成完整运行耗时。手机端到端UI反馈仍待验证，桌面服务事务耗时不能作为手机保证；没有在取得证据前作性能优化。

## 构建与CI

生产构建以eager shared chunks分组React及存储/校验依赖，功能全部静态导入。16:22构建JS入口182.52kB、storage-validation182.27kB、react218.84kB；未提高警告阈值，原582kB chunk警告消失。

CI仅push/普通pull_request、Node24、锁定npm ci、统一检查及Chromium/WebKit安装和浏览器测试；无部署、供应商凭据或特权fork事件。配置参考[checkout官方文档](https://github.com/actions/checkout)、[setup-node官方文档](https://github.com/actions/setup-node)及[Vite构建文档](https://vite.dev/guide/build.html)。CI文件存在不代表远程已执行；远程结果需实际run URL。

未来AI、媒体、账号及云同步未在本阶段执行。模型延迟、真实费用、配额和云预算需独立验证。

## 最终独立审查

任务9独立审查通过。全分支审查发现三项跨模块缺陷，已实际复现并修复：移除动作同时原子删除关联计时器并保留其他动作计时器；添加动作采用现有最大排序加一；进行中的计划训练不能跳过，完成时也防御性拒绝已跳过的日程。新增回归逐一完成记录、完成训练、导出、校验和恢复，最终复审通过。子代理额度限制后由控制器接手修复，独立审查代理负责复审。
