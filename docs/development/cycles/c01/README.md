# Cycle 01 — Studio Foundation & First UAT

## 1. Metadata

| 字段 | 值 |
| --- | --- |
| Cycle ID | `C01` |
| 中文名称 | Studio 基础工作台与首轮验收 |
| 状态 | `Closed with carryover` |
| 记录方式 | 事后补建（retrospective reconstruction） |
| 开始日期 | 2026-07-23 |
| 结束日期 | 2026-07-23 |
| 上一基线 | `d6c95b9` |
| 首个本轮提交 | `19cdd2c` |
| End commit | `9bece1d` |
| Commit range | `d6c95b9..9bece1d` |
| 本轮提交数 | 14 |
| 产品验收 | `Not accepted` |
| Rebuild | `No` |

`9bece1d` 是 C01 的不可变截止点。该 commit 之后尚未提交的工作区内容不属于 C01，应在下一个 Cycle 开始时记录为 baseline WIP 或先整理成明确提交。

## 2. Cycle Summary

C01 将项目从“无界面内核 + 路线文档”推进到第一个可运行的 Studio 工作台基线。本轮建立了 React Renderer、隔离 Preview Host、数据驱动 Workbench、面板停靠、独立 Canvas Viewport、版本化 Preview 协议，以及 Heading/Text 的首条 Revision 编辑链路。

代码级检查、契约测试和生产构建通过，但首轮用户验收暴露了 17 项功能、恢复性、布局和视觉问题。因此 C01 作为时间与 Git 边界已关闭，但产品验收结论为 `Not accepted`，所有未关闭项转入后续 Cycle。

## 3. Objectives

### 3.1 本轮目标（事后重建）

- 补齐 Workspace 配置的运行时验证。
- 将 PageDocument 确定性渲染为真实 React 页面。
- 建立可编排、可调尺寸、可持久化的专业 Studio Workbench 基线。
- 使 Canvas 独立平移和缩放，不缩放整个 Studio 页面。
- 建立 Studio / Preview 隔离边界和版本化消息协议。
- 尝试打通选择、Heading/Text 修改、Revision 提交和 undo/redo。
- 建立首份用户验收 Issue 跟踪文档。

### 3.2 非目标

- 本轮不开放第三方插件市场或任意代码加载。
- 本轮不实现完整的组件插入/结构拖放。
- 本轮不实现 Token / Registry / Settings 管理面。
- 本轮不实现完整主题系统和视觉系统。
- 本轮不实现 MCP、多人协作或云端部署。

## 4. Rebuild Decision

- **决策**：`No`
- **理由**：C01 新增了首个 Studio 和 Workbench 实现，而不是替换一个已经存在的 Studio 架构。Headless core、Command Engine、Document Engine 和 Workspace Server 均被保留并复用。
- **备注**：本轮执行了生产构建验证，但按 Cycle 规范，这属于 Test，不属于 Rebuild。

## 5. Dev Log

| 能力 | 主要结果 | 提交 |
| --- | --- | --- |
| Workspace validation | Component、Token、Action、Policy 和 Constraint 配置运行时验证 | `19cdd2c` |
| React Renderer / Preview | 确定性 Renderer、Preview Host 和 Golden Pricing Page | `894e0fa` |
| Studio architecture | 专业 Workbench、独立 Canvas、插件扩展边界和 ADR | `98ab774` |
| Workbench core | 版本化布局树、Split/Tab/Panel、Panel/Command Registry | `c309966` |
| Studio shell / Canvas | Vite Studio、Activity Bar、Command Palette、可调尺寸布局、触控板平移/缩放 | `eaa1abf` |
| Panel docking | 面板拖动、四向停靠和中心 Tab 合并 | `89ea403` |
| Preview protocol | Studio / Preview 严格版本化消息 Schema 和契约测试 | `34f7a92` |
| Preview intent / bounds | 节点标记、hit-test、bounds、overflow 和 render error 回传 | `6cd99cf` |
| First editing slice | 动态 Outline、Selection Overlay、Inspector、Revision、undo/redo | `2710373` |
| UAT tracking | 17 项用户验收 Issue、优先级、根因和验收条件 | `d01b30a` |

## 6. Fix Log

| Issue / 范围 | 根因 | 处理 | 提交 | 结果 |
| --- | --- | --- | --- | --- |
| Workbench docking gap | 首个 Shell 只支持 resize，不支持面板停靠 | 增加 panel drag / dock 布局操作 | `89ea403` | 功能存在，但布局归一化与视觉缝隙转为 STUDIO-009 / 012 |
| STUDIO-002 子问题 | sandbox iframe 的 opaque origin 使 Vite 模块请求带 `Origin: null` 并被拦截 | Preview dev server 仅允许 `Origin: null` | `9bece1d` | 模块加载恢复；`load` / `preview.ready` 时序和交互复验仍未完成，Issue 保持 Open |

## 7. Test Log

### 7.1 自动化结果

| 层级 | 范围 | C01 最终结果 |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | 通过 |
| Unit / contract / integration | `pnpm test` | 18 个测试文件，74/74 通过 |
| Core build | `pnpm build` | 通过 |
| Studio production build | `pnpm studio:build` | 通过 |
| Preview production build | `pnpm preview:build` | 通过 |
| Development service health | Studio 4173、Preview 4174、Workspace 4178 | HTTP 健康检查通过 |

### 7.2 测试覆盖的主要范围

- PageDocument、Command、Patch、Revision 和规则引擎契约。
- Workspace HTTP、持久化恢复、Catalog、History 和 Export。
- React Renderer、Preview 协议和 Canvas 坐标转换。
- Workbench 布局验证、resize、panel close/open 和单次 dock。

### 7.3 本轮暴露的测试缺口

- 没有浏览器级测试覆盖真实 sandbox origin、iframe `load` / `ready` 时序和 Canvas 点击。
- 没有测试覆盖关闭最后一个 Tab 后的 Panel 恢复。
- 没有对多次 docking 后的 Split 归一化和 seam 一致性进行验证。
- 没有对窄面板宽度下的 Tree / Component Grid / Titlebar 进行交互和视觉验收。
- 无事件处理的占位按钮和输入框没有被自动检测。

## 8. Commit Inventory

| Commit | Type | 内容 |
| --- | --- | --- |
| `19cdd2c` | feat | Validate workspace configuration and actions |
| `894e0fa` | feat | Add React renderer and preview host |
| `98ab774` | docs | Define professional Studio workbench architecture |
| `c309966` | feat | Add data-driven workbench foundation |
| `eaa1abf` | feat | Add workbench shell and canvas viewport |
| `08af6fb` | docs | Record Studio workbench implementation status |
| `89ea403` | feat | Support panel drag and docking |
| `f390744` | docs | Mark workbench docking complete |
| `34f7a92` | feat | Add versioned preview protocol |
| `6cd99cf` | feat | Report Preview node intent and bounds |
| `2710373` | feat | Complete first document editing loop |
| `2eeb35f` | docs | Record first Studio editing slice |
| `d01b30a` | docs | Add Studio UAT issue tracker |
| `9bece1d` | fix | Allow sandboxed Preview dev modules |

## 9. Deliverables

- [Studio Workbench 架构](../../../architecture/STUDIO_WORKBENCH.md)
- [ADR-0003：Studio Workbench 与 Canvas Viewport](../../../adr/0003-studio-workbench-and-canvas-viewport.md)
- [Studio 验收问题追踪](../../STUDIO_ISSUE_TRACKER.md)
- [当前实现状态](../../CURRENT_STATUS.md)
- `packages/studio-workbench`
- `packages/preview-protocol`
- `apps/studio`
- `apps/preview-host`

## 10. UAT

- **日期**：2026-07-23
- **结论**：`Not accepted`
- **问题数**：17
- **问题快照**：P0 × 3，P1 × 10，P2 × 4
- **详细记录**：[STUDIO-001～STUDIO-017](../../STUDIO_ISSUE_TRACKER.md)

用户验收确认：

- Export、Settings、Page/Component 搜索和 Component Grid 操作仅有占位界面或样式暗示。
- Canvas 选择和 Inspector / Preview 同步不可靠，编辑闭环未通过验收。
- 关闭某区域最后一个 Tab 会使该区域无法恢复。
- Workbench 重组、Titlebar、Panel seam、Tree、Component Grid、滚动条和图标未达到专业生产力工具标准。
- 主题和 Token / Registry 管理面缺失。

## 11. Outcome

### 11.1 已达成

- 核心 PageDocument / Command / Revision 架构保持独立并通过自动化测试。
- 建立了真实 React Renderer 和隔离 Preview Host。
- 建立了数据驱动 Workbench 和独立 Canvas 的架构边界。
- 建立了 Panel / Command / Inspector / Route / Status contribution 基础。
- 建立了版本化 Preview 协议、运行时 Schema 和契约测试。
- 建立了可执行的 UAT Issue 分类、优先级和验收标准。

### 11.2 未达成

- 首个用户编辑闭环未通过真实交互验收。
- 用户可见界面中仍存在多个无行为的占位控件。
- 组件插入、结构拖放、搜索、Outline 折叠、Export 和 Settings 未交付。
- Workbench 恢复性、布局归一化和视觉系统未达到验收标准。

### 11.3 Carryover

| 优先级 | Issue | 下一步 |
| --- | --- | --- |
| P0 | STUDIO-002、003、016 | 先恢复 Preview 握手/选择、Inspector 同步和 Panel 可恢复性 |
| P1 | STUDIO-001、004、008、009、011～015、017 | 接通导出与结构操作，整治 Workbench / Titlebar / 窄面板布局，建立 Settings |
| P2 | STUDIO-005、006、007、010 | 补齐搜索、Tree 折叠、主题和滚动条 |

## 12. Retrospective

### 12.1 有效做法

- 将领域内核、Preview、Studio 和 Workbench 分成独立边界。
- 使用 TypeBox 对布局、HTTP 和 Preview 消息进行运行时验证。
- 按能力分段提交，使 C01 可以从 Git 历史中重建。
- 在 UAT 后将反馈转换为具有验收条件的 Issue，而不只保留口头描述。

### 12.2 问题

- 将“代码存在且构建通过”过早当作“产品能力完成”。
- 缺少浏览器级交互测试，未能提前发现 sandbox 加载、ready 时序和无响应控件。
- 在搜索、Export、Settings、Token 和 Component Grid 仍是占位时，UI 没有清晰显示未实现状态。
- Workbench 布局测试只验证结构合法，没有足够验证长时间操作后的可理解性和可恢复性。

### 12.3 下轮改进

- 以 P0 用户路径为主线，不先增加更多新界面。
- 为 Preview 选择、Inspector 提交、Panel 恢复和 Export 增加浏览器/组件级交互测试。
- 禁止无行为的控件使用可点击、可搜索或可拖动的外观。
- 将容器级窄面板尺寸加入每轮验收矩阵。
- 使用本目录的 Cycle 模板在下轮开始前定义验收条件。

## 13. Closure

- **Cycle 状态**：`Closed with carryover`
- **End commit**：`9bece1d`
- **关闭日期**：2026-07-23
- **产品验收**：`Not accepted`
- **建议下一轮**：`Cycle 02 — Core Workflow Remediation`
- **建议顺序**：STUDIO-002 → STUDIO-003 → STUDIO-016 → STUDIO-001，然后再进入组件插入与视觉整治。

## 14. Amendment Log

| 日期 | 修正原因 | 修正内容 |
| --- | --- | --- |
| 2026-07-23 | 首次建立 Cycle 制度 | 根据 Git 历史、测试记录和首轮 UAT 事后重建 C01 |
