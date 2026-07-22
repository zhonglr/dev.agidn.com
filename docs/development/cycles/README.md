# Development Cycles

本目录记录项目每一轮可审计的开发周期。每轮至少包含 Dev、Fix 和 Test，可根据需要增加 Rebuild，最后以明确的 Git commit 作为不可变边界。

## 1. 命名决策

正式名称使用 **Cycle**，稳定标识使用 `Cnn`：

```text
Cycle 01 → C01
Cycle 02 → C02
…
Cycle 99 → C99
```

推荐标题格式：

```text
Cycle 01 — Studio Foundation & First UAT
Cycle 02 — Core Workflow Remediation
```

不采用 `Roll01` 作为正式标识，因为 `roll` 在软件工程中容易与 rollout、rollback、rolling release 或日志轮转混淆。如果团队在口头沟通中喜欢“第一轮”，可以称为“第一轮 / C01”，但文档、commit、Issue 和报告统一使用 `C01`。

## 2. 目录结构

```text
docs/development/cycles/
├── README.md             Cycle 规范和总索引
├── TEMPLATE.md           新 Cycle 文档模板
├── c01/
│   └── README.md         C01 的完整记录
├── c02/
│   ├── README.md         C02 的完整记录
│   └── artifacts/        可选：本轮专属报告、fixture 或非代码证据
└── …
```

每轮使用独立目录，而不是将所有轮次写入一个不断增长的文件。这样可以在未来安全收纳某轮特有的测试报告、迁移说明或 Rebuild 评估。

## 3. Cycle 与其他文档的职责边界

| 文档 | 回答的问题 |
| --- | --- |
| Cycle record | 这一轮为什么做、做了什么、怎么测试、结果如何、遗留什么 |
| `STUDIO_ISSUE_TRACKER.md` | 某个问题的当前状态、根因、验收条件和历史 |
| `CURRENT_STATUS.md` | 整个项目此刻的快照 |
| `TODO.md` | 跨 Cycle 的路线和未完成能力 |
| ADR | 为什么选择某个长期架构决策 |
| API / architecture docs | 当前有效的协议和系统设计 |

Cycle record 不复制整份 Issue 内容，只记录本轮的 Issue 快照和链接。Issue 跨轮未关闭时，在下一轮作为 carryover 继续追踪，不回头改写上一轮的历史结果。

## 4. 标准生命周期

```text
Intake → Baseline → Dev → Fix → Test → UAT → Close
                                ↑      ↓
                                └─ Fix loop

需要时：Baseline → Rebuild Decision → Rebuild → Dev/Fix/Test
```

### 4.1 Intake

- 明确本轮目标、非目标、输入 Issue 和验收人。
- 一个 Cycle 可以从规划开始，也可以像 C01 一样在事后补建；事后补建必须明确标记。

### 4.2 Baseline

- 记录 start commit、开始日期、工作区状态和已知问题。
- start/end 必须是完整 Git commit，不使用“当前本地状态”作为永久边界。

### 4.3 Dev

- 记录本轮新增或改变的产品能力、协议、数据模型和交互。
- 按能力或 Issue 分段提交，不用一个巨型 commit 包含整轮。

### 4.4 Fix

- 记录修复的 Issue、回归风险、修复提交和剩余风险。
- Dev 与 Fix 可以循环多次；文档保留每次关键结论，不只写最后结果。

### 4.5 Test

每轮至少记录：

- Typecheck、单元/契约测试、集成测试和生产构建。
- 关键用户路径的交互测试或 UAT。
- 执行环境、测试数量、结果、失败项和证据位置。

`pnpm build` 属于常规 Test 阶段的“构建验证”，不等于 Rebuild。

### 4.6 Rebuild（可选）

Rebuild 指主动放弃或替换某个已有实现路径，例如重写 Workbench Layout Engine、替换 Preview 运行时或进行不兼容 Schema migration。每次 Rebuild 必须记录：

- 触发原因和不重建的替代方案。
- 保留与删除的边界。
- migration / rollback 路径。
- 额外回归范围和验收条件。
- 对应 ADR 或技术评估链接。

仅新增一个首次实现的模块不算 Rebuild。

### 4.7 UAT 与 Close

- Cycle 状态和产品验收结果必须分开。
- 一个时间边界可以被关闭，同时标记为 `Closed with carryover`；这不表示功能验收通过。
- 关闭时记录 end commit、最终测试、UAT 结论、未关闭 Issue 和下一轮输入。
- end commit 之后的任何修改自动属于下一个 Cycle，除非通过 amendment 明确修正历史记录。

## 5. Cycle 状态

| 状态 | 含义 |
| --- | --- |
| Planned | 已创建文档，尚未锁定 start commit |
| Active | 正在 Dev / Fix |
| Verification | 功能冻结，正在 Test / UAT |
| Closed | 轮次边界已关闭，无 carryover |
| Closed with carryover | 轮次边界已关闭，但未关闭 Issue 转入后续 Cycle |
| Reopened | 只在轮次记录本身有事实错误时使用；产品 Bug 应进入新 Cycle |

## 6. 必填字段

每个 Cycle 的 `README.md` 必须包含：

1. ID、名称、状态、起止日期、start/end commit、commit range。
2. 产品验收结果和 Rebuild 决策。
3. 目标、非目标、输入 Issue 与计划验收标准。
4. Dev、Fix、Test、UAT 和可选 Rebuild 记录。
5. 提交清单和主要产物链接。
6. 测试环境、命令/检查类型、数量和结果。
7. UAT 反馈、未关闭 Issue、carryover 和下一轮建议。
8. 复盘、流程改进和按时间追加的 amendment log。

## 7. 总索引

| Cycle | 名称 | 状态 | Git 边界 | UAT | Rebuild | 记录 |
| --- | --- | --- | --- | --- | --- | --- |
| C01 | Studio Foundation & First UAT | Closed with carryover | `d6c95b9..9bece1d` | Not accepted | No | [查看](./c01/README.md) |

## 8. 开启下一轮

1. 从 [Cycle 模板](./TEMPLATE.md) 创建 `cNN/README.md`。
2. 将状态设为 `Planned`，记录预期目标和 carryover Issue。
3. 开始编码前记录 start commit 和工作区状态，再将状态改为 `Active`。
4. 在本索引追加新行，不改变旧 Cycle 的 Git 边界。
