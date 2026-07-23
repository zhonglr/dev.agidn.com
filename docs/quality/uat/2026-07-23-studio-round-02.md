# Studio UAT：2026-07-23 / Round 02

> 状态：Completed / Not accepted
>
> 日期：2026-07-23
>
> 来源：Studio 第二轮用户验收（UAT Round 2）
>
> 验收对象：`8df696d` 之后、尚未提交的第一轮整改工作区
>
> 关联文档：[Studio Issue 台账](../issues.md)
>
> 追踪范围：5 项用户反馈，整理为 STUDIO-R2-001～STUDIO-R2-005

本文档记录第一轮整改后的真实用户复验结果。它区分以下几类容易混淆的能力：

- 从 Component Grid 插入新节点，与移动 PageDocument 中已经存在的节点不是同一能力。
- `node.move` 已存在于 Command Engine，与 Studio 已经提供移动交互不是同一事实。
- Registry 声明了 variant 名称，与 Preview 为每个 variant 提供可辨识视觉语义不是同一事实。
- Workbench 布局树能够完成 Dock，与 Dock 过程中的落点提示达到产品质量不是同一事实。
- HTML `title` 能最终显示浏览器提示，与产品能够控制 Tooltip 的首次出现时间不是同一事实。

## 1. 状态与关闭规则

| 状态 | 含义 |
| --- | --- |
| Open | 问题已复现并完成根因核对，尚未进入修复 |
| In Progress | 已有实现工作，尚未达到开发门禁 |
| Ready for Verification | 自动化检查通过，等待按本文验收矩阵进行真实浏览器复验 |
| Closed | 自动化证据、真实交互复验和修复提交均已记录 |
| Blocked | 受明确的协议、产品决策或上游 Issue 阻塞 |

关闭任何 Issue 前必须记录修复提交、测试位置、浏览器复验环境和结果。不得再用“代码路径存在”“Revision 增加”“类型检查通过”替代用户可见结果。

## 2. Issue 总览

| ID | 类型 | 优先级 | 状态 | 与第一轮关系 | 标题 |
| --- | --- | --- | --- | --- | --- |
| STUDIO-R2-001 | Missing interaction / integration | P1 | Ready for Verification | 重开 STUDIO-004 | 画布中的已有节点不能拖动、排序或更换父节点 |
| STUDIO-R2-002 | Missing interaction / integration | P1 | Ready for Verification | 重开 STUDIO-004 | Page Outline 中的已有节点不能拖动重组结构 |
| STUDIO-R2-003 | Interaction latency / accessibility | P2 | Ready for Verification | 重开 STUDIO-008 | 图标依赖浏览器原生 title，首次 Tooltip 出现不可控且过慢 |
| STUDIO-R2-004 | Incomplete visual capability | P1 | Ready for Verification | 重开 STUDIO-003 | Registry variant 可以提交，但多数变体在 Preview 中没有可辨识差异 |
| STUDIO-R2-005 | Workbench drag UX / visual design | P1 | Ready for Verification | 新问题，关联 STUDIO-009 | 面板停靠使用大块矩形覆盖层，遮挡内容且不能清晰预示结果 |

## 3. 结构编辑 Issue

### STUDIO-R2-001：画布中的已有节点不能拖动、排序或更换父节点

- **类型 / 优先级 / 状态**：Missing interaction / integration / P1 / Ready for Verification
- **修复实现（2026-07-23）**：Canvas 选中 Overlay 现在是已有节点 Drag Source；Preview 协议新增 `preview.resolveMove` / `preview.moveIntent`，Studio 使用共享结构目标解析器生成 `node.move`。拖动期间按 before / inside / after 显示几何提示，提交后保持 node ID 和选择态。
- **开发证据**：新增 PageDocument 根级移动支持；循环父子、必填源 Slot、目标 accepts / maxItems 和 no-op 位置在提交前拦截，服务端继续执行完整 Rule Engine 验证。`studio-structure-drag.test.ts`、`preview-protocol.test.ts` 和 `domain-commands.test.ts` 覆盖核心意图。
- **用户原始反馈**：元素无法在画布中通过拖拽移动到其他地方或修改父节点。
- **精确问题陈述**：Canvas 当前只支持点击选择、平移/缩放，以及接收从 Component Grid 拖入的“新组件插入”负载。PageDocument 中已经存在的节点不能从 Preview 发起拖动，因此不能在同一父节点中排序，也不能移动到另一个 Layout children 或命名 Slot。
- **不要与以下能力混淆**：
  - 从 Component Grid 拖入会生成 `node.insert`，不是 `node.move`。
  - Canvas 的 `preview.resolveDrop` 只携带 `componentRef`，没有被移动的 `sourceNodeId`。
  - Command Engine 已支持 `node.move`，说明领域能力存在；缺失的是 Studio / Preview 交互和协议集成。
- **代码证据**：
  - `apps/studio/src/canvas/CanvasViewport.tsx` 的 Drop handler 只读取 `application/x-agidn-component`，随后发送 `preview.resolveDrop`。
  - `packages/preview-protocol/src/index.ts` 的 `preview.resolveDrop` 只有 `componentRef`、`x`、`y`，没有移动来源、拖动阶段或插入位置反馈。
  - Preview iframe 设置 `pointer-events: none`，Preview DOM 自身无法产生节点拖动手势；Canvas 只处理平移和点击 hit-test。
  - `StudioSessionValue` 暴露 `insertComponent`，没有提交 `node.move` 的操作。
- **期望行为**：选中已有节点后可从画布拖动；拖动期间只显示 Rule Engine 允许的父节点、Slot 和 before-node 位置；放下后提交一个 `node.move`，保持节点 ID 不变。
- **验收条件**：
  - 支持同一 collection 内向前、向后排序，结果只改变顺序。
  - 支持从一个 Layout 的 `children` 移动到另一个 Layout 的 `children`。
  - 支持进入和离开命名 Slot，并遵守 `accepts`、`minItems`、`maxItems` 和防循环规则。
  - 非法落点不提交 Command，UI 显示具体原因而非静默恢复。
  - 拖动节点本身及其后代时不能形成循环父子关系。
  - 成功后保持原 node ID，更新 Revision、Outline、Preview 和 Inspector，并可 undo/redo。
  - 空格拖动画布、点击选择和节点拖动具有互斥的手势判定，不发生误触。
  - 在 Desktop / Tablet / Mobile 及 50%、100%、150% 缩放下完成浏览器级测试。
- **所需测试**：Preview 拖动协议契约测试、Rule Engine 非法落点测试、Canvas 组件交互测试、真实 sandbox iframe 浏览器测试。

### STUDIO-R2-002：Page Outline 中的已有节点不能拖动重组结构

- **类型 / 优先级 / 状态**：Missing interaction / integration / P1 / Ready for Verification
- **修复实现（2026-07-23）**：Outline treeitem 现在携带稳定 node ID 作为 Drag Source，按行上部 / 中部 / 下部解析 before / inside / after；合法命名 Slot 与 Layout children 共用 Canvas 的目标解析服务。`Alt+ArrowUp/ArrowDown` 提供同组键盘排序，非法位置显示原因。
- **开发证据**：纯函数测试覆盖同组前后排序、命名 Slot、循环、必填 Slot 和键盘排序；移动仍统一经过 Workspace `node.move`、Revision 和 undo/redo。
- **用户原始反馈**：节点树中的节点同样无法拖动。
- **精确问题陈述**：Outline 的 treeitem 可以选择、折叠和作为“新组件”的部分 Drop 目标，但已有 treeitem 不是 Drag Source。用户不能通过树完成排序、跨父节点移动或移入命名 Slot。
- **代码证据**：
  - `apps/studio/src/panels.tsx` 的 `.tree-row` 没有 `draggable`、`onDragStart` 或节点移动 payload。
  - 现有 `onDragOver` / `onDrop` 只在 Layout 行接受 `application/x-agidn-component`，调用 `insertComponent`。
  - Component 节点的命名 Slot 没有独立、可命中的 Tree Drop Zone。
- **期望行为**：Outline 是与 Canvas 等价的结构编辑入口；拖动已有节点时显示明确的 before / after / inside 位置，并用同一套合法性服务生成 `node.move`。
- **验收条件**：
  - 每个可移动 treeitem 都能作为指针拖动源，并携带稳定的 node ID，而不是序列化整棵节点数据。
  - 行上半区、下半区和可容纳子节点的内部区域分别表达 before、after 和 inside。
  - 折叠节点停留悬停后可自动展开；拖动结束或取消后恢复临时展开状态。
  - Layout children 和 Component 命名 Slot 都有清晰落点；不允许把 Slot 伪装成普通 children。
  - 深层缩进、搜索结果和滚动中的自动滚屏不会改变目标 node ID。
  - 支持键盘结构移动命令，不能把 HTML Drag and Drop 当作唯一入口。
  - Canvas 和 Outline 发起移动时生成相同的 `node.move` 语义，并共享 undo/redo、错误提示和测试矩阵。
- **所需测试**：Tree 交互测试、键盘移动测试、自动展开/滚屏测试、Canvas 与 Outline 命令等价性测试。

## 4. 反馈与视觉 Issue

### STUDIO-R2-003：图标依赖浏览器原生 title，首次 Tooltip 出现不可控且过慢

- **类型 / 优先级 / 状态**：Interaction latency / accessibility / P2 / Ready for Verification
- **修复实现（2026-07-23）**：新增共享 `TooltipProvider` / `Tooltip`，主要纯图标操作不再以原生 `title` 作为产品提示。首次延迟固定为 300ms，500ms grace period 内相邻提示为 80ms；支持 focus、Escape、滚动、resize 和 dragstart 关闭，并根据 viewport 翻转或限制位置。
- **开发证据**：`tooltip.test.ts` 固定验证首次与 grace-period 延迟；Undo/Redo 的 disabled 状态会显示具体原因。
- **用户原始反馈**：图标的 tooltip 首次 hover 出现需要的时间太久。
- **精确问题陈述**：图标按钮虽然有 `aria-label` 和 `title`，但界面没有产品级 Tooltip。原生 `title` 的显示延迟、位置、样式和重复悬停行为由浏览器/操作系统决定，Studio 无法满足明确的首次响应时间。
- **代码证据**：
  - Activity Bar、Undo/Redo、Settings、Workbench maximize/close 等按钮直接使用 `title="…"`。
  - 仓库中没有 Tooltip primitive、Tooltip Provider、受控 delay 或 portal 定位实现。
- **期望行为**：所有纯图标操作使用统一的产品 Tooltip；文案、出现时间、位置和键盘行为由 Studio 控制，`aria-label` 继续作为无障碍名称。
- **验收条件**：
  - 首次 pointer hover 后 250～350ms 显示，不依赖原生 `title`。
  - 同一工具区内 Tooltip 关闭后的 500ms grace period 中，切换到相邻图标应在 100ms 内显示。
  - 键盘 focus 同样显示，按 Escape 关闭；disabled 控件仍可解释禁用原因。
  - Tooltip 不遮挡当前目标、不超出 viewport，并根据 Activity Bar、Titlebar 和 Panel action 自动选择方向。
  - 鼠标移出、blur、滚动、拖动开始或对话框打开时可靠关闭，不出现残留浮层。
  - Tooltip 视觉使用 Studio 语义 Token，Light / Dark 均可读。
  - 测试使用可控时钟验证延迟，不以人工等待感受作为唯一证据。

### STUDIO-R2-004：Registry variant 可以提交，但多数变体在 Preview 中没有可辨识差异

- **类型 / 优先级 / 状态**：Incomplete visual capability / P1 / Ready for Verification
- **修复实现（2026-07-23）**：补齐 Button、Link、Text、Image、Icon、Badge、Card、Navigation 和 PricingCard 的所有已声明 modifier；Heading 保留原有完整覆盖。Image 与 Navigation Renderer 也开始消费 variant class。
- **开发证据**：新增 `preview-variants.test.ts`，从 Component Registry 遍历可选择 variant，并要求 Preview stylesheet 存在对应 modifier，防止再次出现“Registry 有选项、Preview 无实现”。
- **用户原始反馈**：组件的各种变体我看不出效果。
- **精确问题陈述**：Inspector 从 Component Registry 正确列出 variant 并能提交 `node.setVariant`，Preview 也会改变 className；但是 Preview stylesheet 只实现少量 modifier。多个不同 variant 最终落到同一基础样式，导致 Revision 成功增加却没有用户可见差异。
- **当前覆盖证据**：

| 组件 | Registry variants | 当前明确的 modifier 样式 | 问题 |
| --- | --- | --- | --- |
| Button | primary / secondary / danger / ghost | 仅 `primary` | secondary、danger、ghost 视觉相同或退回基础样式 |
| Link | default / muted | 无 variant modifier | 两种选择没有可辨识差异 |
| Heading | display / title / section | 三种均有 | 当前覆盖较完整 |
| Text | body / muted / emphasis | 仅 `muted` | body 与 emphasis 无可辨识差异 |
| Image | default / rounded | 无 variant modifier | rounded 未实现 |
| Icon | default / success / danger | 仅 `success` | danger 未实现 |
| Badge | default / accent / success | 无 variant modifier | 三种选择没有独立语义 |
| Card | default / outlined / elevated | 无 variant modifier | outlined / elevated 未实现 |
| Navigation | header / footer | 无 variant modifier | 两种结构/外观没有差异 |
| PricingCard | default / featured | `featured` 已实现 | 当前覆盖较完整 |

- **期望行为**：Registry 中每个可选择 variant 都必须有被 Renderer/组件实现消费的明确表现；如果产品尚未设计某个 variant，则不得在 Inspector 中作为可用选项展示。
- **验收条件**：
  - 建立 Registry variant 到组件实现和视觉测试的覆盖矩阵，构建时能发现声明但未消费的 variant。
  - 每个 variant 至少在一个稳定、可测试的视觉维度上有语义差异，例如颜色、边界、层级、排版或结构；不能只改变不可见 className。
  - 差异由组件 API、语义 Token 和受控 CSS 实现，不写入 PageDocument 原始样式。
  - 切换后 Revision、Inspector 值、Preview class 和最终 computed style 同步。
  - 视觉差异在 Light/Dark Studio Chrome 之外独立验证，避免错误地让编辑器主题改变页面内容。
  - 为全部非 default variant 增加组件级快照或视觉回归覆盖；无设计方案的选项先从 Registry 下线。
- **依赖决策**：需要产品/设计确认各 variant 的语义，不应由开发者根据名称任意猜测 `danger`、`elevated` 或 `footer` 的最终设计。

### STUDIO-R2-005：面板停靠使用大块矩形覆盖层，遮挡内容且不能清晰预示结果

- **类型 / 优先级 / 状态**：Workbench drag UX / visual design / P1 / Ready for Verification
- **修复实现（2026-07-23）**：DockOverlay 变为低干扰目标传感层；只有当前进入的 Panel 显示 92px 紧凑 Dock compass。五个目标改为统一线性图标，不再使用文字矩形；hover 后以单一半透明区域预览 top / right / bottom / left Split 或 center Tab merge 的最终几何范围。
- **开发证据**：非当前目标不显示高对比控件，移除了全区域 blur 和五块约 25% 大矩形；Dock 完成、取消或离开目标时清理 active 状态和预览。
- **用户原始反馈**：面板拖拽布局时出现的框太丑的问题没有解决。
- **精确问题陈述**：开始拖动 Panel 后，每个叶子 Panel 都渲染一个覆盖内容区的 DockOverlay，并同时显示 top / right / bottom / left / Tab 五个大矩形文字按钮。覆盖层会大面积变暗和模糊内容，多个 Panel 同时出现重复方框；方框表达的是抽象方向，而不是放下后的真实区域尺寸。
- **代码证据**：
  - `packages/studio-workbench/src/workbench.tsx` 为每个 `SinglePanel` 和 `TabGroup` 挂载 `DockOverlay`。
  - `DOCK_POSITIONS` 五个位置同时渲染为 button，并用文本显示方向。
  - `apps/studio/src/styles.css` 使用全区域半透明 backdrop、blur，以及占目标区域约 25% 的矩形 `.wb-dock-target`。
- **与 STUDIO-009 的边界**：STUDIO-009 处理布局树无限嵌套、sizes 归一化和 seam；本 Issue 处理拖动期间的目标发现、预览和视觉质量。布局结果正确不代表 Dock affordance 合格。
- **期望行为**：停靠提示应轻量、稳定、接近成熟 IDE：用户能看见合法位置，也能在放下前预知最终占用区域，同时页面内容仍可辨认。
- **验收条件**：
  - 未进入具体 Panel 前不在所有叶子区域同时显示五组方框。
  - 目标 Panel 激活后使用紧凑 Dock compass 或低干扰 edge zones；非当前目标不显示高对比控件。
  - hover 某个目标时显示最终布局几何预览，center 明确表示 Tab merge，边缘明确表示 Split。
  - Drop preview 使用单一半透明面，不叠加粗框、文字块、全区域 blur 和多层边界。
  - 非法方向或 `canDock: false` 的目标不出现；min/max size 不满足时显示不可放置原因。
  - Light / Dark、180px 工具区、主 Canvas 和底部区域使用一致视觉语言。
  - 连续跨多个 Panel 拖动时提示不闪烁、不残留、不造成布局抖动。
  - 完成至少 10 次 Dock / Tab merge / redock 的真实浏览器录屏复验。
- **设计交付要求**：实现前先确定 Dock compass、几何预览、颜色和动效规格；不得再次只通过调整现有五个矩形的颜色宣称完成。

## 5. 修复依赖与建议批次

### Batch R2-A：统一结构移动语义

1. 定义 `NodeDragPayload`、drag lifecycle 和 `MoveIntent`，明确 source node、target parent、target slot、before node。
2. 扩展 Preview 协议以解析已有节点的 Drop Intent，而不是复用仅面向组件插入的 `componentRef` 请求。
3. 在 Studio Session 暴露 `moveNode`，始终通过 Workspace Command API 和 Rule Engine 提交 `node.move`。
4. Canvas 与 Outline 共享合法性计算、插入指示、错误原因和 undo/redo。
5. 完成 STUDIO-R2-001 与 STUDIO-R2-002 的交叉验收矩阵。

### Batch R2-B：可感知反馈

1. 建立统一 Tooltip primitive，迁移所有纯图标按钮，再移除作为主要提示的 `title`。
2. 建立 variant 覆盖清单；先补齐已确认设计的组件，未确认项从可操作 UI 隐藏。
3. 为 Tooltip 定时和 variant computed style 增加自动化测试。

### Batch R2-C：Workbench Dock 体验

1. 先完成停靠提示设计规格和状态图。
2. 将“目标发现”和“最终区域预览”拆开，避免每个叶子 Panel 永久渲染整套高对比方框。
3. 复用 STUDIO-009 的归一化和 min-size 逻辑验证最终结果。

## 6. 第二轮复盘：为什么第一轮整改仍未通过

### 6.1 能力定义过宽

- “组件支持拖放”只验证了 Component Grid → Canvas 的 `node.insert`，没有按新节点插入、已有节点排序、跨父节点移动三个独立场景验收。
- “Inspector 由 Registry 驱动”只验证了选项和 Command，没有验证每个选项的最终 computed style。
- “图标有 Tooltip”只检查了 `title` 属性，没有定义可控制的延迟指标。
- “Workbench Dock 已整治”主要验证序列化布局结构，没有验证拖动过程中的视觉反馈。

### 6.2 自动化证据与用户任务不匹配

- 77 项测试覆盖协议、Command、布局和构建，但没有覆盖已有节点从 Canvas / Outline 发起 `node.move`，因为对应 UI 根本不存在。
- 静态 className 变化不足以证明 variant 有视觉差异。
- Workbench 测试验证 Dock 后的布局树，不验证 DockOverlay 的遮挡范围、几何预览或观感。
- 当前环境缺少真实浏览器实例时，将全部第一轮 Issue 标为 Ready for Verification 仍然过于乐观；第二轮已证明其中三项需要重开。

### 6.3 新增交付门禁

1. 结构编辑必须按“来源 × 操作 × 目标”矩阵验收：Component Grid / Canvas / Outline × Insert / Reorder / Reparent × Layout children / named Slot。
2. Registry 声明的每个可操作枚举必须有运行时消费证据；视觉枚举必须验证 computed style 或视觉快照。
3. 所有时序体验必须给出可测试阈值，不能依赖浏览器默认行为。
4. Drag and Drop 必须同时验证拖动开始、目标发现、合法性、几何预览、提交、取消和 undo/redo。
5. 涉及视觉质量的 Issue 在无浏览器复验时只能保持 Open 或 In Progress，不能仅凭类型检查和单元测试进入 Ready for Verification。

## 7. 处理记录

| 日期 | 事件 | 结果 |
| --- | --- | --- |
| 2026-07-23 | 第一轮整改完成开发检查 | 类型检查、77 项测试及生产构建通过；17 项进入 Ready for Verification |
| 2026-07-23 | 用户进行第二轮 UAT | 确认已有节点移动、Tree 拖动、Tooltip 时序、variant 视觉覆盖和 Dock 提示仍不合格 |
| 2026-07-23 | 逐项核对 Canvas、Outline、Session、Preview Protocol、Preview CSS 与 Workbench Overlay | 建立 STUDIO-R2-001～005；重开 STUDIO-003、004、008，并将 Dock Overlay 从布局归一化问题中拆分为独立 Issue |
| 2026-07-23 | 完成第二轮五项开发修复 | 接通 Canvas / Outline 已有节点移动，建立受控 Tooltip，补齐 variant 视觉覆盖，重做 Dock compass 与几何预览；全仓类型检查、21 个测试文件 85 项测试、Studio / Preview / 全仓生产构建通过。当前环境无可用浏览器实例，五项进入 Ready for Verification。 |
