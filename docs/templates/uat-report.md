# <产品/模块> UAT：YYYY-MM-DD / Round NN

> 仅当基线 commit、验收人、环境、用户场景和接受判断均已明确时创建；临时冒烟和纯自动化测试不创建 UAT。每次独立复验新建 Round，禁止覆盖旧报告。

> 状态：Planned / In Progress / Completed
> 日期：YYYY-MM-DD
> 基线 Commit：<sha>
> 环境：<OS、浏览器、视口、输入设备>
> 验收人：<name or role>

## 范围

- <本轮要验证的用户任务>
- 非目标：<本轮不验证的内容>

## 场景与结果

| 场景 | 操作 | 预期 | 实际 | 结果 | Issue |
| --- | --- | --- | --- | --- | --- |
| <name> | <steps> | <expected> | <actual> | Pass / Fail / Blocked | <ID/none> |

## 结论

- 总体：Accepted / Not accepted / Partial / Blocked
- 新增或重开 Issue：<IDs/none>
- 未验证风险：<items/none>

## 证据

- <测试记录、截图、录屏或日志的仓库相对链接>

## 后续

- <责任边界清晰的下一步；修复状态应回到 Issue，不持续改写本报告>
