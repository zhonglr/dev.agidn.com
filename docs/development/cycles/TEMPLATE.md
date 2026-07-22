# Cycle NN — <Name>

> 创建新 Cycle 时，将本文件复制到 `cycles/cNN/README.md`，删除所有尖括号提示，并在开始编码前锁定 start commit。

## 1. Metadata

| 字段 | 值 |
| --- | --- |
| Cycle ID | `CNN` |
| 名称 | `<短标题>` |
| 状态 | `Planned` |
| 创建日期 | `YYYY-MM-DD` |
| 开始日期 | `<未开始 / YYYY-MM-DD>` |
| 结束日期 | `<未关闭 / YYYY-MM-DD>` |
| Start commit | `<sha>` |
| End commit | `<未关闭 / sha>` |
| Commit range | `<start^..end>` |
| 产品验收 | `Not started / Accepted / Not accepted / Partial` |
| Rebuild | `No / Proposed / Approved / Completed` |
| 验收负责人 | `<name or role>` |

## 2. Cycle Summary

### 2.1 目标

- `<本轮必须达成的可验收结果>`

### 2.2 非目标

- `<明确不在本轮解决的事项>`

### 2.3 输入

- Issue：`<ISSUE-ID>`
- 架构/ADR：`<link>`
- 上轮 carryover：`<Cnn / none>`

### 2.4 计划验收标准

- [ ] `<用户可见结果>`
- [ ] `<协议/数据结果>`
- [ ] `<质量和回归结果>`

## 3. Baseline

- **代码基线**：`<sha>`
- **工作区状态**：`Clean / Dirty`
- **已知问题**：`<issue links>`
- **环境**：Node `<version>`，pnpm `<version>`，OS/browser `<versions>`
- **备注**：`<fixtures, services, migrations, feature flags>`

## 4. Rebuild Decision

- **决策**：`No / Proposed / Approved / Completed`
- **触发原因**：`<why>`
- **保留范围**：`<what remains>`
- **替换范围**：`<what is rebuilt>`
- **Migration / rollback**：`<plan>`
- **ADR / 评估**：`<link>`

> 本轮无 Rebuild 时，仍保留本节并记录 `No` 与一句理由。

## 5. Dev Log

| 日期 | 能力 / Issue | 改动 | Commit | 结果 |
| --- | --- | --- | --- | --- |
| `YYYY-MM-DD` | `<ID>` | `<summary>` | `<sha>` | `<outcome>` |

## 6. Fix Log

| 日期 | Issue | 根因 | 修复 | Commit | 剩余风险 |
| --- | --- | --- | --- | --- | --- |
| `YYYY-MM-DD` | `<ID>` | `<cause>` | `<fix>` | `<sha>` | `<risk / none>` |

## 7. Test Log

| 日期 | 层级 | 范围 / 命令 | 环境 | 结果 | 证据 |
| --- | --- | --- | --- | --- | --- |
| `YYYY-MM-DD` | Typecheck | `pnpm typecheck` | `<env>` | `<pass/fail>` | `<link/log>` |
| `YYYY-MM-DD` | Unit/contract | `pnpm test` | `<env>` | `<n/n>` | `<link/log>` |
| `YYYY-MM-DD` | Build | `pnpm build` | `<env>` | `<pass/fail>` | `<link/log>` |
| `YYYY-MM-DD` | Interaction | `<critical path>` | `<browser/device>` | `<pass/fail>` | `<link/log>` |

### 7.1 失败和重试

| 日期 | 失败项 | 诊断 | 处理 | 最终结果 |
| --- | --- | --- | --- | --- |
| `YYYY-MM-DD` | `<failure>` | `<cause>` | `<action>` | `<result>` |

## 8. UAT

- **日期**：`YYYY-MM-DD`
- **结论**：`Accepted / Not accepted / Partial`
- **验收场景**：`<scenarios>`
- **验收结果**：`<summary>`
- **新增 Issue**：`<IDs>`
- **复验负责人**：`<name or role>`

## 9. Commit Inventory

| Commit | Type | 内容 | 关联 Issue / 文档 |
| --- | --- | --- | --- |
| `<sha>` | `feat/fix/test/docs/refactor` | `<summary>` | `<IDs/links>` |

## 10. Deliverables

- `<code/doc/API/artifact link>`

## 11. Outcome

### 11.1 已达成

- `<accepted or code-complete result>`

### 11.2 未达成

- `<failed or deferred result>`

### 11.3 Carryover

| Issue | 优先级 | 当前状态 | 下一步 |
| --- | --- | --- | --- |
| `<ID>` | `<P0/P1/P2>` | `<status>` | `<action>` |

## 12. Retrospective

### 12.1 有效做法

- `<keep>`

### 12.2 问题

- `<problem>`

### 12.3 下轮改进

- `<change>`

## 13. Closure

- **Cycle 状态**：`Closed / Closed with carryover`
- **End commit**：`<sha>`
- **关闭日期**：`YYYY-MM-DD`
- **产品验收**：`Accepted / Not accepted / Partial`
- **下一 Cycle 建议**：`<Cnn title>`

## 14. Amendment Log

Cycle 关闭后不改写历史。只在发现事实错误、无效链接或遗漏证据时追加 amendment。

| 日期 | 修正原因 | 修正内容 | 修正人 |
| --- | --- | --- | --- |
