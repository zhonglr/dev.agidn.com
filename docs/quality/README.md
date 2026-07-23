# 质量记录

> 状态：Active
> 最后更新：2026-07-23

本目录统一管理需要审计的质量事实。Issue、UAT 和 Verification 可以共享索引，但不能共享生命周期：Issue 维护问题的当前状态，UAT 保存一次人工验收的原始结论，Verification 保存一次专项技术验证的证据。

## 1. 选择记录类型

| 记录 | 回答的问题 | 创建触发条件 | 不创建的情况 |
| --- | --- | --- | --- |
| [Issue](./issues.md) | 这个具体问题现在是什么状态？ | 问题可以复现，并且需要跨提交跟踪、独立优先级、独立验收或后续复验 | 当场修正且无需独立回归；仅有猜测；尚未形成问题的产品想法 |
| [UAT](./uat/2026-07-23-studio-round-03.md) | 用户在这个固定版本上能否完成任务？ | 已确定基线 commit、验收人、环境和用户场景，且本次结论会影响接受或发布判断 | 开发者随手冒烟测试；只有自动化命令；没有固定验收基线 |
| [Verification](./verification/2026-07-23-studio-ui-gate-01.md) | 某项技术门槛是否达标？ | 预先存在明确技术问题、通过阈值、可重复方法和需要保留的证据 | 普通常规测试；没有阈值的探索；用户任务验收 |

无法判断时先问：记录的结论会不会随修复变化？会变化的是 Issue；只描述固定时间和固定 commit 上发生过什么的是 UAT 或 Verification。

## 2. Issue 触发条件

满足以下第一项，并至少满足后续一项时创建或关联 Issue：

1. 已有最小复现、可靠证据或明确的未满足验收条件。
2. 修复预计跨越当前提交或当前 Cycle。
3. 需要独立优先级、负责人、产品决定或验收条件。
4. 问题会阻断发布、破坏数据、影响核心路径或需要用户复验。
5. 同一问题曾修复失败、复发或需要跨轮次保留历史。

以下内容不创建 Issue：无法复现的猜测、纯讨论、未来产品方向、普通重构愿望和在当前提交内修正且已完整回归的小失误。它们分别进入调查备注、Roadmap、Cycle 非目标或提交说明。

当前问题集中维护在 [Studio Issue 台账](./issues.md)。只有当单项问题跨多个 Cycle、产生大量证据、多次 Reopened 或明显降低台账可读性时，才在 `quality/issues/` 下拆成 `<domain>-<nnn>-<short-title>.md`；ID 不变，台账保留摘要和链接。

## 3. UAT 触发条件

只有同时满足以下条件才开始一轮 UAT：

- 存在不可变的基线 commit 或构建标识。
- 已明确验收范围、非目标、验收人和环境。
- 场景以用户任务描述，具有预期结果。
- 本次结论会形成 `Accepted`、`Not accepted`、`Partial` 或 `Blocked`。

每次独立验收新建文件；同日复验也增加 Round，禁止覆盖前一轮。验收中发现的问题创建或关联 Issue，修复状态只更新 Issue；旧 UAT 只允许追加事实性 amendment。

命名为 `<YYYY-MM-DD>-<domain>-round-NN.md`，当前记录：

| 日期 | 领域 / 轮次 | 结论 | 记录 |
| --- | --- | --- | --- |
| 2026-07-23 | Studio Round 01 | Not accepted | [C01 UAT](../project/cycles/c01.md#10-uat) |
| 2026-07-23 | Studio Round 02 | Not accepted；5 项待复验 | [查看](./uat/2026-07-23-studio-round-02.md) |
| 2026-07-23 | Studio Round 03 | Development complete；待人工验收 | [查看](./uat/2026-07-23-studio-round-03.md) |

## 4. Verification 触发条件

专项验证开始前必须写清楚：技术问题、基线、通过阈值、执行方法和证据形式。常规 `typecheck`、单元测试和生产构建只记入 Cycle Test Log；只有需要独立决策、迁移 Gate、性能预算、兼容性矩阵、安全审计或可访问性审计时才新建 Verification。

命名为 `<YYYY-MM-DD>-<domain>-<gate-or-topic>.md`。结论固定后不随实现进度重写；后续重测新建报告并链接前序结果。

| 日期 | 验证 | 结论 | 报告 |
| --- | --- | --- | --- |
| 2026-07-23 | Studio UI Gate 01 / 表单替换与按需加载 | Pass | [查看](./verification/2026-07-23-studio-ui-gate-01.md) |
| 2026-07-23 | Studio UI Gate 00 / Spectrum 2 兼容性 | Pass with follow-up gates | [查看](./verification/2026-07-23-studio-ui-gate-00.md) |

## 5. 与 Cycle 的流转

```text
Roadmap / Issue intake
        ↓
      Cycle ── Dev / Fix / Test
        ├── 技术门槛需要独立证据 ──→ Verification
        └── 达到可验收基线 ──────→ UAT
                                      └── Fail / Blocked ──→ Issue
```

Cycle 只保存本轮快照和链接，不复制 Issue、UAT 或 Verification 正文。Cycle 可以带着未关闭 Issue 以 `Closed with carryover` 结束；这不表示 Issue 已关闭或产品已通过验收。

## 6. 扩展目录的门槛

当前使用扁平目录，领域写入文件名。只有出现第二个长期维护领域，或同一记录类型超过约 10 份活跃文件并显著影响浏览时，才增加 `studio/`、`runtime/` 等领域子目录。不得为尚未出现的规模预建空目录和多层索引。

创建记录时使用 [Issue 模板](../templates/issue.md)、[UAT 模板](../templates/uat-report.md)、[Verification 模板](../templates/verification.md)或 [Cycle 模板](../templates/cycle.md)，并遵循 [文档贡献规范](../contributing/documentation.md)。
