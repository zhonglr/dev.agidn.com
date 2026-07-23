# Studio Issue 索引

> 创建日期：2026-07-23
> 来源：Studio 用户验收与后续反馈
> 验收基线：`2eeb35f` 及其之前的 Studio / Preview / Workbench 实现
> 追踪范围：30 个稳定 Issue；第一轮 17 项、第二轮新增 Dock 交互问题、第三批反馈去重后新增 7 项、第四批反馈新增 4 项、后续新增上下文菜单能力

> 第二轮 UAT 已确认其中 3 项需要重开，并发现新的 Dock 交互问题；精确复现和验收矩阵见 [Studio 第二轮 UAT](./uat/2026-07-23-studio-round-02.md)。第三批 12 条反馈已归并到 `STUDIO-004`、`STUDIO-018`～`STUDIO-025`，原整改摘要保存在[归档记录](../archive/2026-07-23-studio-feedback-batch-03-remediation.md)。第四批反馈不是固定基线上的正式 UAT：画布聚焦和拖放规则归并到 `STUDIO-002`、`STUDIO-004`，新增产品与视觉缺口由 `STUDIO-026`～`STUDIO-029` 跟踪；后续右键编辑菜单由 `STUDIO-030` 跟踪。长期编辑模型见 [Studio Authoring Model](../product/studio-authoring-model.md)。

本文档是 `STUDIO-*` 问题当前状态的唯一事实来源。项目路线见 [项目路线图](../project/roadmap.md)，全局快照见 [项目状态](../project/status.md)。代码已存在、类型检查通过或单元测试通过，都不等于用户验收通过。

## 1. 管理规则

### 1.1 状态

| 状态                   | 含义                                                 |
| ---------------------- | ---------------------------------------------------- |
| Open                   | 问题已确认，尚未开始修复                             |
| In Progress            | 已有负责人和实现分支，正在修复                       |
| Ready for Verification | 已通过开发检查，等待按本文验收条件复验               |
| Closed                 | 验收条件全部通过，已记录修复提交和测试证据           |
| Blocked                | 受上游协议、产品决策或其他 Issue 阻塞                |
| Reopened               | 曾进入待验证或关闭状态，但后续用户验收证明条件未满足 |

### 1.2 优先级

| 优先级 | 判定标准                                             |
| ------ | ---------------------------------------------------- |
| P0     | 核心编辑链路无法使用，或会造成工作区不可恢复         |
| P1     | 重要能力缺失或显著影响专业工具使用效率               |
| P2     | 不阻断核心任务，但影响一致性、可读性或长时间使用体验 |

### 1.3 关闭要求

每个 Issue 关闭时必须同时记录：

- 修复提交。
- 自动化测试位置和结果。
- 用户可见交互的复验结果。
- 如果改动协议、布局 Schema 或设计系统，同步更新架构文档或 ADR。

## 2. Issue 总览

| ID         | 来源编号                        | 类型                                        | 优先级 | 状态                   | 标题                                                    |
| ---------- | ------------------------------- | ------------------------------------------- | ------ | ---------------------- | ------------------------------------------------------- |
| STUDIO-001 | 0                               | Missing integration                         | P1     | Ready for Verification | Export 按钮未连接导出流程                               |
| STUDIO-002 | 1 / B4-1                        | Functional bug                              | P0     | Ready for Verification | 画布点击与大纲选中无法稳定同步 Preview 节点             |
| STUDIO-003 | 2                               | Functional bug / incomplete capability      | P0     | Ready for Verification | Inspector 控件与 Preview 更新链路不可靠                 |
| STUDIO-004 | 3 / R2-1～2 / B3-1～3 / B4-3、5 | Missing capability / interaction            | P1     | Ready for Verification | 组件插入、移动与 Slot 拖放链路不完整                    |
| STUDIO-005 | 4                               | Missing capability                          | P2     | Ready for Verification | Page 和 Component 搜索框不执行过滤                      |
| STUDIO-006 | 5                               | Missing capability                          | P2     | Ready for Verification | Page Outline 节点无法折叠或展开                         |
| STUDIO-007 | 6                               | Product gap                                 | P2     | Ready for Verification | Studio 只有暗色主题                                     |
| STUDIO-008 | 7                               | Visual usability                            | P1     | Ready for Verification | 图标语义不清且尺寸不一致                                |
| STUDIO-009 | 8                               | Workbench layout defect                     | P1     | Ready for Verification | 面板停靠后产生零碎且不规则的嵌套网格                    |
| STUDIO-010 | 9                               | Visual usability                            | P2     | Ready for Verification | 面板滚动条过粗且与界面密度不匹配                        |
| STUDIO-011 | 10                              | Layout defect                               | P1     | Ready for Verification | Titlebar 的网格定义与子元素数量不匹配                   |
| STUDIO-012 | 11                              | Layout defect                               | P1     | Ready for Verification | 面板边界和分隔缝宽度不一致                              |
| STUDIO-013 | 12                              | CSS defect                                  | P1     | Ready for Verification | Tree kind 标识在窄面板中被压缩                          |
| STUDIO-014 | 13                              | CSS defect                                  | P1     | Ready for Verification | Component Grid 文字在窄面板中溢出                       |
| STUDIO-015 | 14                              | CSS/layout defect                           | P1     | Ready for Verification | 结构树行在窄面板中不能稳定占满可见宽度                  |
| STUDIO-016 | 15                              | Recoverability bug                          | P0     | Ready for Verification | 关闭某区域最后一个 Tab 后无法重新打开面板               |
| STUDIO-017 | 16                              | Missing capability                          | P1     | Ready for Verification | Token / Registry / Settings 管理入口缺失                |
| STUDIO-018 | R2-5 / B3-11                    | Workbench drag UX                           | P1     | In Progress            | Dock compass 难发现且目标命中区域过小                   |
| STUDIO-019 | B3-4                            | Missing capability                          | P1     | Ready for Verification | 缺少保存和复用节点子树的工作流                          |
| STUDIO-020 | B3-5                            | Missing capability                          | P1     | Ready for Verification | Revision History 缺少安全恢复能力                       |
| STUDIO-021 | B3-6～7                         | Missing integration / visual consistency    | P2     | Ready for Verification | Schema 标识符与本地化展示名称未分离                     |
| STUDIO-022 | B3-8                            | Information architecture                    | P2     | In Progress            | Components 面板未按组件类别分组                         |
| STUDIO-023 | B3-9                            | Missing capability                          | P1     | Ready for Verification | Studio 与组件元数据缺少国际化链路                       |
| STUDIO-024 | B3-10                           | Visual usability                            | P2     | In Progress            | Outline 深层节点缺少连续层级引导                        |
| STUDIO-025 | B3-12                           | Product gap / UX                            | P2     | In Progress            | 面板显隐入口未按工作区方位组织                          |
| STUDIO-026 | B4-4、6                         | Product capability / authoring model        | P1     | In Progress            | 自定义组件缺少项目级专注编辑闭环与同构结构树            |
| STUDIO-027 | B4-7                            | Workbench layout / information architecture | P1     | Ready for Verification | 默认布局未同时展示 Outline 与 Components 面板           |
| STUDIO-028 | B4-8                            | Missing capability / document model         | P1     | In Progress            | 缺少多页面根节点、新建页面入口与页面编辑 Tab            |
| STUDIO-029 | B4-2                            | Visual consistency / overlay defect         | P2     | Ready for Verification | Command Palette 搜索框及 Overlay 层叠与 Spectrum 不一致 |
| STUDIO-030 | 后续反馈                        | Missing capability / extensibility          | P1     | Ready for Verification | 编辑目标缺少可扩展的 Spectrum 右键菜单                  |

## 3. 功能 Issue

### STUDIO-001：Export 按钮未连接导出流程

- **原始编号**：0
- **类型 / 优先级 / 状态**：Missing integration / P1 / Ready for Verification
- **影响范围**：Titlebar、Studio Session、Workspace Export API、导出结果反馈
- **实际行为**：点击 Titlebar 中的 `Export` 按钮没有任何反应。
- **代码证据**：`apps/studio/src/App.tsx` 中 `.export-button` 只有文本和样式，没有 `onClick`；`StudioSessionValue` 也没有 export 操作。Workspace Server 已提供 `POST /v1/export`，因此这是 Studio 集成缺失，不是服务端能力缺失。
- **期望行为**：按钮打开轻量导出对话框，默认导出当前 Revision，并显示进行中、成功或失败状态。
- **验收条件**：
  - 点击后有明确的对话框或导出界面，不进行静默操作。
  - 请求使用当前已确认 Revision，并通过 API 协议验证。
  - 成功时显示输出位置和 manifest 摘要；失败时提供可重试的错误信息。
  - 包含 Studio 交互测试和 Workspace HTTP 集成测试。

### STUDIO-002：画布点击与大纲选中无法稳定同步 Preview 节点

- **原始编号**：1
- **类型 / 优先级 / 状态**：Functional bug / P0 / Ready for Verification
- **影响范围**：Canvas Viewport、sandboxed iframe、Preview 协议、Selection Overlay、Inspector
- **实际行为**：画布中的元素可见，但鼠标点击后不会稳定更新当前选中节点、Outline 选中态和 Inspector。
- **代码证据**：
  - iframe 使用 `sandbox="allow-scripts"`，Preview 文档因此是 opaque origin；开发服务需要明确处理 `Origin: null`。
  - `CanvasViewport` 依赖 `preview.ready` 后才发送 `preview.hitTest`，但 iframe `onLoad` 会将 `previewReady` 重置为 `false`。如果 `preview.ready` 早于父页 `onLoad` 处理，就会丢失就绪状态。
  - 当前没有 ready 超时、重试、心跳或用户可见的“Preview 未连接”状态。
- **已修复的子问题（2026-07-23）**：Preview Host 未允许 sandbox iframe 的 `Origin: null`，导致 Vite 的 `@vite/client`、`@react-refresh` 和 `src/main.tsx` 被 CORS 拦截，画布完全无法加载。`apps/preview-host/vite.config.ts` 现仅允许该 opaque origin，同时保留 `sandbox="allow-scripts"` 隔离；三个开发模块均已验证返回 HTTP 200 和 `Access-Control-Allow-Origin: null`。Preview Host 生产构建、全仓类型检查和 74 项测试通过。
- **本轮修复（2026-07-23）**：Preview 在挂载期间周期性重发 `preview.ready`，Studio 使用显式 connecting / ready / error 状态、5 秒超时和 Retry 重建 iframe；`load` 即使晚于首次 ready 也会在下一次公告恢复握手。点击与拖放都经版本化 Preview 协议返回命中意图，Canvas 对断点、缩放和平移统一使用坐标转换服务。
- **第四批反馈**：从左侧 Outline 选择节点时，如果目标当前不在 Canvas 视口内，画布必须用一次短暂、可感知的平移把目标带入视口；不能瞬间跳转，也不能在节点已经可见时产生不必要移动。
- **剩余复验**：自动化协议与坐标测试通过；当前执行环境没有可用的内置浏览器实例，仍需按验收矩阵完成真实浏览器点击、手势和 opaque-origin 复验，因此状态为 Ready for Verification。
- **期望行为**：画布点击通过统一坐标服务命中最深层可编辑节点，并在任意缩放、平移和断点下同步 Outline、Overlay 和 Inspector。
- **验收条件**：
  - Preview 握手只有一个明确的状态机，不受 `load` / `ready` 时序影响。
  - 连接失败时 Canvas 显示错误和重试入口，而不是静默忽略点击。
  - Desktop、Tablet、Mobile 以及 50%、100%、150% 缩放下点击选择正确。
  - Outline 选中视口外节点时，Canvas 使用约 150～250ms 的短平移动画将其完整带入安全可视区；已在安全可视区内的节点不移动。
  - 连续快速选中不同节点时，新动作接管旧动画且不抖动；用户主动缩放或平移时可立即接管。
  - `prefers-reduced-motion: reduce` 下取消空间动画但仍保证目标进入视口。
  - 点击、空格拖动平移和触控板手势不互相触发。
  - 增加覆盖 opaque-origin sandbox 的浏览器级交互测试。

### STUDIO-003：Inspector 控件与 Preview 更新链路不可靠

- **原始编号**：2
- **类型 / 优先级 / 状态**：Functional bug / incomplete capability / P0 / Ready for Verification
- **第二轮复验**：Registry 已能生成 variant 选项并提交 `node.setVariant`，但 Preview 只实现少量 modifier，多数组件切换后没有可辨识视觉差异。详见 [STUDIO-R2-004](./uat/2026-07-23-studio-round-02.md#studio-r2-004registry-variant-可以提交但多数变体在-preview-中没有可辨识差异)。
- **影响范围**：Inspector、Component Registry、Command 提交、Revision、Preview 同步
- **实际行为**：部分字段可产生保存状态，但 Preview 没有可见变化；部分看起来可操作的设置点击后没有任何行为。
- **代码证据**：
  - Inspector 只对 `Heading` 和 `Text` 开放真实编辑，其他节点全部只读。
  - `Text color` 和 `Typography` 使用 disabled button；Content / Appearance 标题看起来是可折叠按钮，但没有点击处理。
  - Preview 更新依赖 STUDIO-002 中同一个 ready / message 链路；一旦该链路未就绪，Workspace Revision 仍可能成功增加，但画布不会同步。
  - 界面未明确区分“可编辑”、“只读”、“未实现”和“提交失败”。
- **期望行为**：Inspector 由 Component Registry 的 Props、Variants 和 Token 能力生成；所有显示为可操作的控件都必须产生可见结果或清晰错误。
- **验收条件**：
  - 先修复 STUDIO-002，再验证 Inspector 与 Preview 同步。
  - 可编辑字段的值、类型、枚举和必填规则来自 Registry，不在 Inspector 中重复硬编码。
  - 每次成功修改后，Revision、Outline 文本、Inspector 值、Preview DOM 和 Overlay 均保持一致。
  - 禁用或尚未实现的能力不使用伪装的可点击样式，并提供原因。
  - 服务端拒绝、Revision 冲突和 Preview 同步失败分别显示，不共用模糊的保存状态。

### STUDIO-004：组件插入、移动与 Slot 拖放链路不完整

- **原始编号**：3
- **类型 / 优先级 / 状态**：Missing capability / interaction / P1 / Ready for Verification
- **第二轮复验**：第一轮整改只完成 Component Grid 新组件插入，没有实现 Canvas / Outline 已有节点的 `node.move`。详见 [STUDIO-R2-001](./uat/2026-07-23-studio-round-02.md#studio-r2-001画布中的已有节点不能拖动排序或更换父节点) 与 [STUDIO-R2-002](./uat/2026-07-23-studio-round-02.md#studio-r2-002page-outline-中的已有节点不能拖动重组结构)。
- **第三批反馈**：新组件插入位置仍不可见，Outline 排序或换父节点不稳定，Component 命名 Slot 不能可靠作为结构目标。这三项属于本 Issue 既有验收矩阵，不另建轮次 ID。
- **第四批反馈**：
  - Components 面板的组件卡片只能作为拖拽源；单击卡片不得向文档插入组件。原“点击插入”要求由本次明确产品决定取代。
  - Canvas 放大后，拖动期间出现的蓝色组件边框指示器尺寸仍与目标组件不一致；该问题曾表现为过大，当前又表现为过小，说明几何换算仍存在重复缩放、遗漏缩放或坐标空间混用。
- **本批实现证据**：`f22f34f` 为 Button 注册 leading Icon、content Text 和 trailing Icon Slot；`90afce7` 将拖动源状态移入 Studio Session，统一 Canvas / Outline 的 MoveTarget，并增加 before / inside / after 几何提示。
- **第四批实现证据**：选择、移动与插入 Overlay 已移出缩放的 `.canvas-surface`，统一使用 `previewRectToScreen` 映射到 Canvas 视口坐标，因此矩形尺寸只乘一次 zoom，边框本身不再随画布缩放；Components、Saved components 和自定义组件卡片均保持为纯拖拽源。`canvas-coordinates.test.ts` 覆盖 50%、100%、150%、200% 几何矩阵。
- **后续实现证据**：Preview 的 Layout 节点和 Container / Stack / Row / Grid 布局组件具有 72px 默认最小高度，完全为空时提供 96px 插入面，避免只有一行文字或没有子节点时难以命中拖放目标。
- **实际行为**：历史基线中的 Component Grid 只有抓取光标而没有完整拖放；后续实现补上了结构拖动，但缩放状态下蓝色落点边框的尺寸仍会偏离 Preview DOM。组件卡片单击行为也需要按最新产品决定保持为无文档副作用。
- **反馈基线代码证据**：最初 `ComponentsPanel` 中的 button 没有 `onClick`、`draggable`、drag payload 或键盘插入命令；`StudioSessionValue` 也没有 `node.insert` / `node.move` 提交方法。CSS 却使用 `cursor: grab`，导致错误的功能暗示。当前实现已变化，此条只保留为历史根因；最新未通过项以第四批反馈和验收矩阵为准。
- **期望行为**：组件卡片只通过拖拽进入画布；拖动时仅显示符合 Slot Policy 的合法落点，并且蓝色组件边框与 Preview 中真实目标边界精确一致。
- **验收条件**：
  - 单击、双击或聚焦 Components 卡片都不修改 PageDocument、不产生 Revision；从 Components 面板插入组件只由明确拖拽触发。
  - 键盘用户如需插入，应使用独立、明确命名的插入命令或无障碍拖放替代流程，不把普通卡片单击重新解释为插入。
  - Preview 回传可命中的父节点、Slot 和 before-node 意图，Studio 生成 `node.insert` / `node.move` Command。
  - 非法 Slot 不允许放置，并显示原因；不允许绕过 Rule Engine。
  - 插入成功后选中新节点，并可 undo/redo。
  - 覆盖布局 children 和命名 Slot 两种结构。
  - 在 Desktop、Tablet、Mobile 及 50%、100%、150%、200% 缩放下，蓝色边框的 `x/y/width/height` 与目标 Preview DOM 的可视边界一致，容差不超过 1 个 CSS 像素。
  - 同一目标从 100% 放大到 150% 或 200% 后，指示器只随画布变换一次；不得再次把已经换算过的 rect 乘除 zoom。
  - 平移、缩放、滚动、断点切换和拖动自动滚屏期间，边框持续贴合；取消拖动或离开合法目标后立即清除。
  - Outline 支持同组排序、跨父节点移动、进入和离开命名 Slot；取消、非法目标及 undo/redo 均保持文档一致。

### STUDIO-005：Page 和 Component 搜索框不执行过滤

- **原始编号**：4
- **类型 / 优先级 / 状态**：Missing capability / P2 / Ready for Verification
- **实际行为**：在 Page Outline 或 Component Grid 的搜索框输入内容后，列表完全不变。
- **代码证据**：两个 `input type="search"` 都没有 value state、`onChange`、过滤函数或空结果状态。
- **期望行为**：Page 搜索节点名称、ID、role 和 componentRef；Component 搜索组件名称与可搜索元数据。
- **验收条件**：
  - 输入时即时过滤，不区分大小写，清空后恢复完整列表。
  - Page 命中子节点时保留祖先路径，避免丢失层级上下文。
  - 无结果时显示空状态和清除操作。
  - 搜索属于 Studio 临时状态，不写入 PageDocument 或产生 Revision。

### STUDIO-006：Page Outline 节点无法折叠或展开

- **原始编号**：5
- **类型 / 优先级 / 状态**：Missing capability / P2 / Ready for Verification
- **实际行为**：所有有子节点的行都显示向下箭头，点击箭头或行只会选中，不会收起子树。
- **代码证据**：`OutlineNode` 无条件递归渲染所有 children，箭头固定为 `▾`，没有 expanded state 和独立的 disclosure button。
- **期望行为**：有子节点的行支持独立折叠/展开，并保留键盘可达的 Tree 语义。
- **验收条件**：
  - 箭头点击不改变选中，行点击选中节点。
  - 支持 `ArrowLeft`、`ArrowRight`、`ArrowUp`、`ArrowDown`、`Home` 和 `End`。
  - 子孙节点被画布选中或被搜索命中时，必要的祖先自动展开。
  - 展开状态属于本地 Studio Session，不产生 Document Revision。

## 4. 样式与视觉 Issue

### STUDIO-007：Studio 只有暗色主题

- **原始编号**：6
- **类型 / 优先级 / 状态**：Product gap / P2 / Ready for Verification
- **实际行为**：Studio Chrome 只提供暗色外观，没有 Light 或 Follow System 选项。
- **代码证据**：`apps/studio/src/styles.css` 中大量颜色为暗色字面量；没有 `data-theme`、`prefers-color-scheme`、主题 Store 或设置入口。
- **期望行为**：Studio 提供 Light、Dark 和 Follow System；主题只影响编辑器 Chrome，不得擅自改变项目 Preview 内容。
- **验收条件**：
  - 所有 Studio 颜色转换为语义 Token，不在组件选择器中散布主题字面量。
  - 主题可从 Settings 切换，本地持久化，Follow System 响应系统变化。
  - Light / Dark 的普通、hover、selected、disabled、focus 和 error 状态均达到可读对比度。
  - Preview iframe 主题与 Studio Chrome 主题保持解耦。

### STUDIO-008：图标语义不清且尺寸不一致

- **原始编号**：7
- **类型 / 优先级 / 状态**：Visual usability / P1 / Ready for Verification
- **第二轮复验**：图标已统一为 SVG，但提示仍依赖浏览器原生 `title`，首次显示延迟不可控且过慢。详见 [STUDIO-R2-003](./uat/2026-07-23-studio-round-02.md#studio-r2-003图标依赖浏览器原生-title首次-tooltip-出现不可控且过慢)。
- **实际行为**：Activity Bar、Tab action、Undo/Redo、选中摘要和问题面板使用不同字符系的符号，含义难以识别，视觉尺寸和基线不一致。
- **代码证据**：Panel contribution 和操作按钮直接使用 `⊞`、`◈`、`▣`、`☷`、`△`、`◷`、`□`、`⧉`、`↶`、`↷` 等 Unicode glyph，它们的字形依赖系统字体。
- **期望行为**：使用一套具有统一 viewBox、stroke、尺寸和命名的产品图标系统，每个操作配有清晰 tooltip 和无障碍名称。
- **验收条件**：
  - 不再使用依赖字体的 Unicode 作为主要工具图标。
  - 常驻图标使用统一的 16px 或 18px 视觉规格和点击区域。
  - 所有无文字按钮都具有 `aria-label` 和延迟 tooltip。
  - 对 Activity Bar 进行非技术用户的识别性复验。

### STUDIO-009：面板停靠后产生零碎且不规则的嵌套网格

- **原始编号**：8
- **类型 / 优先级 / 状态**：Workbench layout defect / P1 / Ready for Verification
- **实际行为**：面板停靠数次后，工作区出现过多嵌套分割、双重边框、不一致的缝隙和过小区域，难以读出主次。
- **代码证据**：`dockPanel` 每次边缘停靠都在目标外新建一层 Split，即使父 Split 方向相同也不展平；新区域固定使用 30% / 70%；每个 `.wb-panel` 自带 1px 边框，Split 又插入 4px separator。
- **期望行为**：停靠结果应像 IDE 一样形成可理解的主区域、工具区域和 Tab Group，而不是无限嵌套的盒子。
- **验收条件**：
  - 相同方向的相邻 Split 自动展平并归一化 sizes。
  - 停靠时尊重 Panel contribution 的 min/max/default size，防止不可用的极窄区域。
  - 分隔线的视觉线与鼠标命中区域分离，不与 Panel border 叠加。
  - 完成 10 次连续停靠/重组后，布局仍无双重边线、空白条和尺寸异常。
  - 为布局归一化增加契约测试和序列化恢复测试。

### STUDIO-010：面板滚动条过粗且与界面密度不匹配

- **原始编号**：9
- **类型 / 优先级 / 状态**：Visual usability / P2 / Ready for Verification
- **实际行为**：面板的滚动条占用明显宽度，在窄工具面板中进一步压缩内容。
- **代码证据**：`.wb-panel__body` 和 Command Palette 使用 `overflow: auto`，但 Studio 没有统一的 scrollbar width、thumb、track、hover 或 Firefox 规则。
- **期望行为**：采用适合高密度生产力工具的细滚动条，同时保留可发现性和无障碍滚动。
- **验收条件**：
  - Chromium/WebKit 与 Firefox 的视觉宽度接近，且不因显示/隐藏造成布局跳动。
  - thumb 普通态低对比，hover/active 态可识别，track 不与 Panel seam 混淆。
  - 键盘、鼠标滚轮和触控板滚动都保持可用。

## 5. 页面布局 Issue

### STUDIO-011：Titlebar 的网格定义与子元素数量不匹配

- **原始编号**：10
- **类型 / 优先级 / 状态**：Layout defect / P1 / Ready for Verification
- **实际行为**：品牌标识、项目名、搜索和操作区无法稳定保持在同一水平线，窗口宽度变化后更明显。
- **代码证据**：`.titlebar` 只定义 3 个 grid column，但存在 4 个直接子元素：`.app-mark`、`.titlebar__project`、`.titlebar__center` 和 `.titlebar__actions`。第 4 个元素会被 CSS Grid 自动放置到隐式行；同时项目名使用负 margin 补偿标识位置。
- **期望行为**：Titlebar 使用明确 grid area 或嵌套分组，品牌/项目、全局搜索和文档操作始终处于一行。
- **验收条件**：
  - 不依赖负 margin 或隐式 Grid row 排列核心元素。
  - 1024px～2560px 宽度下保持单行、垂直居中和稳定间距。
  - 窄屏使用明确的降级顺序：先收起搜索详情，再压缩项目路径，不把操作区换到第二行。
  - Undo、Redo、Save 和 Export 使用统一高度和基线。

### STUDIO-012：面板边界和分隔缝宽度不一致

- **原始编号**：11
- **类型 / 优先级 / 状态**：Layout defect / P1 / Ready for Verification
- **实际行为**：不同面板之间有的是细线，有的是宽条或双线，拖放重组后更明显。
- **代码证据**：`.wb-separator` 占 4px 实体宽度，`.wb-panel` 四周同时有 1px border，Tab bar 再增加 bottom border；嵌套 Split 没有统一 seam 所有权。
- **期望行为**：相邻区域之间只渲染一条视觉 seam，而 resize 命中区域可以更宽但不可见。
- **验收条件**：
  - 定义单一 seam 颜色和 1px 视觉宽度。
  - resize hit target 至少 6px，但不影响视觉间距或布局尺寸。
  - 水平、垂直和嵌套停靠的 seam 规则一致。
  - 与 STUDIO-009 同一批次处理，避免两次重做 Workbench 视觉结构。

### STUDIO-013：Tree kind 标识在窄面板中被压缩

- **原始编号**：12
- **类型 / 优先级 / 状态**：CSS defect / P1 / Ready for Verification
- **实际行为**：工具面板缩窄时，16×16 的节点类型标识会被 Flex 压缩到难以识别。
- **代码证据**：`.tree-kind` 只设置 `width` 和 `height`，没有 `flex: 0 0 16px` / `flex-shrink: 0`；`.tree-arrow` 存在同样风险。
- **期望行为**：类型标识和展开箭头保持固定视觉尺寸，只允许文本区域压缩。
- **验收条件**：
  - 图标与箭头都设置固定 flex basis 和 `flex-shrink: 0`。
  - 文本容器使用 `min-width: 0`和 ellipsis，完整名称通过 tooltip 可访问。
  - 在 180px 面板宽度和至少 6 层缩进下仍可识别节点类型。

### STUDIO-014：Component Grid 文字在窄面板中溢出

- **原始编号**：13
- **类型 / 优先级 / 状态**：CSS defect / P1 / Ready for Verification
- **实际行为**：当 Component 面板较窄时，如 `PricingCard` 等较长名称超出 button 边界。
- **代码证据**：Grid 固定为两列，button 虽有 `min-width: 0`，但文字不在独立的可压缩容器中，也没有 wrap、ellipsis 或容器查询降为单列。
- **期望行为**：组件名称始终保留在卡片内，格子数根据 Panel Host 宽度响应，而不是根据顶层窗口响应。
- **验收条件**：
  - 使用 container query 或等价的面板宽度规则在一列/两列间切换。
  - 长名称使用可预测的单行 ellipsis 或最多两行截断，完整名称在 tooltip 中可见。
  - 180px～480px 面板宽度下无水平滚动和文字越界。

### STUDIO-015：结构树行在窄面板中不能稳定占满可见宽度

- **原始编号**：14
- **类型 / 优先级 / 状态**：CSS/layout defect / P1 / Ready for Verification
- **实际行为**：Tree row 的 hover / selected 背景和可点击区域没有稳定覆盖面板的整个可见宽度。
- **代码证据**：代码虽声明 `.tree-row { width: 100% }`，但 `.tree` 使用左右负 margin 做 full-bleed，行内长文本没有可压缩容器和溢出规则，深层 padding 又与内容固有宽度叠加。因此问题不是单纯缺少 `width: 100%`，需要在窄面板中复现并修正整个宽度链。
- **期望行为**：每个 treeitem 的选中、hover、focus 和点击区域占满 Tree viewport 的可见行宽，文本溢出不扩展行宽。
- **验收条件**：
  - Tree viewport 是明确的宽度和滚动所有者，full-bleed 不依赖难以推理的双负 margin。
  - 行背景始终覆盖可见宽度，缩进只影响内容起点。
  - 文本使用 `min-width: 0`、ellipsis 和 tooltip，不产生水平溢出。
  - 在有/无垂直滚动条、180px 面板宽度和深层节点下复验。

### STUDIO-016：关闭某区域最后一个 Tab 后无法重新打开面板

- **原始编号**：15
- **类型 / 优先级 / 状态**：Recoverability bug / P0 / Ready for Verification
- **实际行为**：关闭某个区域的最后一个 Tab 后，整个 Tab Group 从布局树消失。再点击 Activity Bar 或执行 Open Panel Command 也无法恢复，只能 Reset Workbench Layout。
- **根因**：`closePanel` 在 Tab Group 变空时删除该布局节点，并可能折叠父 Split；`openPanel` 只能向指定的 `targetTabGroupId` 插入。当 `tabs.primary`、`tabs.secondary` 或 `tabs.bottom` 已被删除时，打开操作直接返回原布局。
- **期望行为**：任何可关闭 Panel 都能通过 Activity Bar、Command Palette 或 View 菜单恢复，不需要重置其他用户布局。
- **验收条件**：
  - Layout 协议保存空区域锚点，或 `openPanel` 能根据 Panel defaultLocation 重建丢失的区域。
  - 从默认布局分别关闭 primary、secondary 和 bottom 的全部可关闭 Tab，每个 Panel 均可单独重新打开。
  - 恢复一个 Panel 不改变其他区域的尺寸、Tab 顺序或停靠关系。
  - 持久化后重启 Studio，关闭/恢复状态仍正确。
  - 增加“关闭最后一个 Tab 后重开”的 Workbench 契约测试。

### STUDIO-017：Token / Registry / Settings 管理入口缺失

- **原始编号**：16
- **类型 / 优先级 / 状态**：Missing capability / P1 / Ready for Verification
- **实际行为**：界面没有 Token、Component Registry、Policy 或其他项目设置的可用入口；Activity Bar 的齿轮按钮无响应，Inspector 的 Token 字段为禁用按钮。
- **代码证据**：Settings 按钮没有 `onClick`；Studio 没有 Settings route / dialog，也没有调用已存在的 `GET /v1/catalog`。当前 Token Registry 只存在于项目 JSON、服务端 Catalog 和 Preview 渲染链路中，没有用户界面。
- **期望行为**：按照产品约束，Token 和 Registry 等全局配置进入独立 Settings 页面或对话框，不长期占用画布主工作区。
- **验收条件**：
  - Settings 按钮可键盘访问，并打开独立路由或模态对话框。
  - 至少提供 Theme、Token Browser、Component Registry Browser 和 Workspace 连接状态。
  - Token / Component 数据来自受协议验证的 Catalog API，不在 Studio 中再维护静态副本。
  - 未开放的写操作明确标记为只读，不伪装成可点击控件。
  - API token / 密钥等敏感配置不出现在画布常驻界面，且不写入 PageDocument。

## 6. 后续反馈 Issue

### STUDIO-018：Dock compass 难发现且目标命中区域过小

- **来源**：[第二轮 UAT 的 `STUDIO-R2-005`](./uat/2026-07-23-studio-round-02.md#studio-r2-005面板停靠使用大块矩形覆盖层遮挡内容且不能清晰预示结果)、第三批反馈 11
- **类型 / 优先级 / 状态**：Workbench drag UX / P1 / In Progress
- **实际行为**：第二轮整改将大块覆盖层替换为紧凑 compass 后，用户仍难以稳定唤出停靠目标；92px compass 和 28px 目标对连续跨 Panel 拖动过于苛刻。
- **反馈基线复现**：拖动任一 Panel 跨越多个目标区域，尝试依次命中 center 和四个边缘位置；观察 compass 出现时机、命中容错、闪烁及残留。
- **根因**：第二轮方案缩小了视觉遮挡，但同时缩小了目标发现和命中范围；目标激活还依赖拖动进入特定区域，发现性与容错不足。
- **实现证据**：`90afce7` 改为在 `dragover` 期间激活目标，将 compass 扩至 136px、单个目标扩至 40px，并在拖动期间显示操作提示。
- **验收条件**：
  - 从不同 Panel 连续跨越主 Canvas、左右工具区和底部区域时，合法目标稳定出现且不闪烁。
  - center 与四个边缘目标可清晰区分，并在放下前显示最终 Tab merge 或 Split 范围。
  - 命中目标不需要像素级瞄准；离开、取消和完成后不残留 compass 或预览层。
  - Light / Dark 与窄面板中均保持可读，且不重新遮挡大面积内容。
  - 使用真实指针完成至少 10 次 Dock、Tab merge 和 redock 复验后才可进入 `Closed`。

### STUDIO-019：缺少保存和复用节点子树的工作流

- **来源**：[第三批反馈 4](../archive/2026-07-23-studio-feedback-batch-03-remediation.md#结构编辑)
- **类型 / 优先级 / 状态**：Missing capability / P1 / Ready for Verification
- **实际行为**：用户可以组合已注册组件，但无法把选中的合法节点子树保存为可重复插入的本地模板。
- **反馈基线复现**：在 Canvas 或 Outline 选中一个由多个已注册组件组成的节点子树，检查 Inspector 和 Components 面板；不存在保存或再次插入该组合的入口。
- **根因**：反馈基线只有 Registry 组件插入链路，没有 Saved component 模型、持久化、保存入口或重新生成 node ID 的复制流程。
- **实现证据**：`90afce7` 在 Inspector 增加保存入口，在 Components 增加 Saved components 分组，并为每次插入重新生成整棵子树的 node ID；模板持久化在当前浏览器。
- **范围边界**：该能力保存由已注册组件组成的节点子树，不创建新的代码组件，也不修改 Component Registry。
- **验收条件**：
  - 可保存当前选中的合法节点子树，并要求非空且可辨识的展示名称。
  - 刷新 Studio 后模板仍存在；删除后不再出现在列表中。
  - 同一模板连续插入多次时，所有 node ID 唯一，引用和 Slot 结构保持正确。
  - 点击插入和拖放插入都经过现有 Slot Policy、Rule Engine、Revision 与 undo/redo 链路。
  - 无合法目标、存储损坏或空间不足时给出明确错误，不静默丢失数据。

### STUDIO-020：Revision History 缺少安全恢复能力

- **来源**：[第三批反馈 5](../archive/2026-07-23-studio-feedback-batch-03-remediation.md#revision-history)
- **类型 / 优先级 / 状态**：Missing capability / P1 / Ready for Verification
- **实际行为**：History 只能查看 Revision，不能从旧快照恢复；现有 undo/redo 不能替代选择任意历史 Revision。
- **反馈基线复现**：产生多个 Revision 后打开 History，选择 Revision 0 或中间 Revision；列表只提供查看信息，没有恢复和确认操作。
- **根因**：反馈基线的 Document Service、HTTP API 和 History Panel 都没有 restore 操作。
- **实现证据**：`4165e71` 增加 `POST /v1/history/restore`、协议校验、持久化恢复和集成测试；`90afce7` 增加 History 二次确认与恢复 UI。恢复会创建新的单调 Revision，并将恢复前状态保留在 undo 栈。
- **验收条件**：
  - 可恢复 Revision 0 和任意存在的中间 Revision，不覆盖或删除既有历史。
  - 恢复产生新的单调 Revision，并在 History 中记录目标 Revision。
  - 恢复后 undo 可回到恢复前状态；redo、后续编辑和导出继续正常工作。
  - 刷新 Studio 和重启 Workspace Server 后，恢复记录与当前文档保持一致。
  - 当前 Revision、缺失 Revision、Revision 冲突和服务错误分别提供清晰反馈。

### STUDIO-021：Schema 标识符与本地化展示名称未分离

- **来源**：[第三批反馈 6～7](../archive/2026-07-23-studio-feedback-batch-03-remediation.md#信息架构与国际化)
- **类型 / 优先级 / 状态**：Missing integration / visual consistency / P2 / Ready for Verification
- **实际行为**：Component、Prop、Slot 和 Variant 的技术标识符直接进入 Inspector 与 Components UI，导致 camelCase、点号、连字符和大小写混杂，也无法提供本地化展示名称。
- **反馈基线复现**：选择包含 camelCase Prop、命名 Slot 和多个 Variant 的组件，比较 Registry 标识符与 Inspector、Outline、Components 中的可见文案。
- **根因**：反馈基线的 Registry 与 Catalog Schema 只有稳定机器标识符，没有独立 display metadata；Studio 也没有统一的 fallback 格式化层。
- **实现证据**：`f22f34f` 为 Component、Prop、Slot、Variant 和 category 增加本地化展示元数据并通过 Catalog API 传递；`90afce7` 增加 Display Label 层；`studio-display-label.test.ts` 和 `studio-i18n.test.ts` 覆盖 fallback 与元数据完整性。
- **验收条件**：
  - 稳定机器标识符不因语言或文案修改而变化。
  - 所有 Catalog 控件优先显示当前 locale 的 metadata，并按明确顺序回退。
  - 缺失 metadata 时，camelCase、点号、连字符等标识符得到一致、可读的 fallback label。
  - Component、Prop、Slot、Variant、枚举值及 category 使用同一解析规则。
  - Catalog 序列化、HTTP 协议和 Studio UI 不丢失展示元数据。

### STUDIO-022：Components 面板未按组件类别分组

- **来源**：[第三批反馈 8](../archive/2026-07-23-studio-feedback-batch-03-remediation.md#信息架构与国际化)
- **类型 / 优先级 / 状态**：Information architecture / P2 / In Progress
- **实际行为**：Components 面板把所有组件放在同一平面列表中，组件数量增加后难以浏览和建立类别心智模型。
- **反馈基线复现**：打开未输入搜索词的 Components 面板；Actions、Typography、Media、Content、Layout、Navigation 和 Commerce 组件出现在同一平面列表。
- **根因**：反馈基线的 Registry 与 Catalog 没有 category metadata，面板只能按单一列表渲染。
- **实现证据**：`f22f34f` 增加 category 与本地化 category display metadata；`90afce7` 按 Actions、Typography、Media、Content、Layout、Navigation、Commerce 分组渲染。
- **验收条件**：
  - 每个已注册组件进入一个稳定类别；未知类别进入明确的 Other 分组。
  - 分组标题使用当前 locale 的展示元数据，不改变 Registry 标识符。
  - 搜索时只显示有命中项的分组，清空搜索后恢复完整结构。
  - 在 180px～480px 面板宽度、Light / Dark 和中英文下无溢出或错误折行。
  - 真实浏览器确认分组顺序、扫描效率和键盘导航后才可进入 `Ready for Verification` 或 `Closed`。

### STUDIO-023：Studio 与组件元数据缺少国际化链路

- **来源**：[第三批反馈 9](../archive/2026-07-23-studio-feedback-batch-03-remediation.md#信息架构与国际化)
- **类型 / 优先级 / 状态**：Missing capability / P1 / Ready for Verification
- **实际行为**：Studio Chrome、Workbench、ARIA、异步错误与组件元数据没有统一 locale，界面文案无法完整切换语言。
- **反馈基线复现**：打开 Settings 并检查 locale 配置，再遍历 Studio、Canvas、Workbench、Dialog、Tooltip 和组件元数据；没有统一切换入口或完整语言覆盖。
- **根因**：反馈基线没有语言包类型、运行时解析、React Provider、用户设置或 Catalog display metadata 协议。
- **实现证据**：`90afce7` 建立初始 Provider、`en-US` / `zh-CN` 语言包与 Settings 切换；`f7fd334` 将 Studio、Canvas、Workbench、ARIA 和异步错误迁移到类型化 message key，并增加语言包结构、占位符和硬编码审计测试。
- **验收条件**：
  - Settings、`VITE_STUDIO_LOCALE` 和运行时配置按文档化优先级解析 locale，并持久化用户选择。
  - Studio、Canvas、Workbench、Dialog、Tooltip、ARIA 与异步错误在中英文下没有混用或裸 message key。
  - 两套语言包具有相同 key 和占位符结构；缺失翻译按明确规则回退。
  - Catalog 的 Component、Prop、Slot、Variant、枚举值和 category 展示元数据随 locale 切换。
  - 切换语言不刷新 PageDocument、不创建 Revision，也不改变 Preview 内容语义。

### STUDIO-024：Outline 深层节点缺少连续层级引导

- **来源**：[第三批反馈 10](../archive/2026-07-23-studio-feedback-batch-03-remediation.md#workbench-与视觉层级)
- **类型 / 优先级 / 状态**：Visual usability / P2 / In Progress
- **实际行为**：Outline 层级较深时，仅靠缩进难以判断节点的祖先路径和同级关系。
- **反馈基线复现**：在 Outline 展开至少 6 层节点并同时显示多个相邻分支；沿深层节点向上辨认祖先路径时只有缩进可供判断。
- **根因**：反馈基线只设置逐层 padding，没有连续纵向引导线或等价的层级视觉提示。
- **实现证据**：`90afce7` 按树深度绘制连续纵向引导线，并与 selection、hover 和 drop indicator 分层。
- **验收条件**：
  - 至少 6 层嵌套时可以沿引导线辨认祖先路径和同级边界。
  - 引导线不遮挡 disclosure、kind icon、selection、focus 或 drop indicator。
  - 折叠、搜索、拖动和滚动时，引导线不发生断裂、错位或残留。
  - 180px 窄面板、Light / Dark 和高 DPI 下保持足够但不过强的对比度。
  - 真实浏览器视觉复验完成前保持 `In Progress`。

### STUDIO-025：面板显隐入口未按工作区方位组织

- **来源**：[第三批反馈 12](../archive/2026-07-23-studio-feedback-batch-03-remediation.md#workbench-与视觉层级)
- **类型 / 优先级 / 状态**：Product gap / UX / P2 / In Progress
- **实际行为**：所有 Panel 显示/隐藏入口集中在左侧 Activity Bar，与实际位于右侧或底部的工具区域缺少空间对应关系。
- **反馈基线复现**：从默认布局关闭左、右和底部 Panel，再查找各 Panel 的恢复入口；所有入口集中在左侧 Activity Bar。
- **根因**：反馈基线只有单一 Activity Bar，Panel contribution 的默认方位没有映射到周边工具窗口栏。
- **实现证据**：`90afce7` 增加左侧项目类、右侧内容类和底部状态类工具窗口栏，按钮支持显隐切换；顶部同时增加 File、Edit、View 菜单。
- **验收条件**：
  - Panel contribution 按默认方位稳定进入左、右或底部工具窗口栏。
  - 每个按钮准确反映 Panel 显示状态，并可在关闭最后一个 Tab 后恢复对应 Panel。
  - 周边入口、View 菜单和 Command Palette 调用同一打开/关闭命令，不产生状态分叉。
  - 键盘、tooltip、ARIA、Light / Dark 和窄窗口布局均可用。
  - 真实浏览器确认入口方位、可发现性和布局观感后才可进入 `Ready for Verification` 或 `Closed`。

### STUDIO-026：自定义组件缺少项目级专注编辑闭环与同构结构树

- **来源**：第四批反馈 4、6；产品模型见 [Studio Authoring Model](../product/studio-authoring-model.md#3-自定义组件资产与专注工作台)
- **类型 / 优先级 / 状态**：Product capability / authoring model / P1 / In Progress
- **影响范围**：自定义组件资产、专注工作台、结构树、组件库、Preview、变量与 Slot 配置、Workspace 持久化
- **实际行为**：当前代码已有独立的 Component Workbench、组件拖入、变量/Slot 表单和浏览器本地保存原型，但左侧 Layers 是扁平列表，无法表达嵌套父子关系与命名 Slot；资产仍保存在 `localStorage`，没有成为项目级、可校验、可 Revision、可导出的正式资产。
- **代码证据**：
  - `apps/studio/src/ComponentWorkbench.tsx` 提供专注页面、Preview、Building Blocks、Variables 和 Slots 配置。
  - 当前 Layers 通过深度遍历后直接渲染为平面 button 列表，没有 disclosure、层级缩进、Slot 行、树键盘语义或结构拖动。
  - `apps/studio/src/custom-components.ts` 使用 `agidn.studio.custom-components` 本地存储键；该格式未进入 Workspace Server、项目 Schema、Revision Store 或 Context Export。
- **第四批实现证据**：专注工作台的扁平 Layers 已替换为包含组件根、嵌套节点和命名 Slot 的紧凑结构树；支持 disclosure、Tree 键盘移动、Tree/Preview 选中同步、祖先自动展开、节点排序、跨命名 Slot 移动以及视口外选中的短平滑聚焦。工作区主体与页面编辑器保持相同的“结构树、组件库、画布、配置”四列顺序，窄桌面布局不再隐藏组件库。专注页作为覆盖层挂载，主工作台和 Canvas iframe 在进入、退出期间保持同一 DOM 实例；Preview 未初始化时只渲染中性空白，并在组件文档首帧完成后原子地从加载提示切换到空组件引导，不再泄露内置示例页的深色内容。变量/Slot 的类型、初始值、绑定和实例配置继续由同一工作台编辑。
- **剩余边界**：用户可见创建/修改链路已经可用并通过开发门禁，但资产仍使用浏览器本地持久化；进入 Workspace 项目 Schema、Revision Store 和导出协议后才满足本 Issue 的项目级关闭条件，因此保持 In Progress。
- **期望行为**：用户进入只关注一个自定义组件的编辑状态，复用页面编辑器的选择、树、Preview、拖放、Inspector 和规则逻辑；变量与 Slot 是资产的正式公开接口，而不是仅存在于当前浏览器的临时配置。
- **验收条件**：
  - 可从 Components 面板新建自定义组件，也可打开已有资产继续编辑；专注模式明确显示资产身份、保存状态和返回工作区入口。
  - 专注工作台拥有一棵小型但完整的结构树，显示组件根、嵌套节点和命名 Slot；折叠、键盘导航、搜索、选中同步、自动展开、拖动排序及合法落点规则与 Page Outline 复用同一逻辑。
  - 在树或 Preview 选中节点时，另一侧同步选中；视口外目标使用与 `STUDIO-002` 相同的短暂聚焦平移。
  - 变量至少支持 string、number、boolean、enum 的稳定 ID、展示名称、值类型、初始值、约束和节点属性绑定。
  - Slot 至少支持单组件、组件列表和文本的稳定 ID、展示名称、值类型、初始值/默认内容、数量约束、可接受类型和内部命名 Slot 绑定。
  - 删除、重命名或改类型时先检查现有实例和绑定，提供迁移或阻止破坏性保存，不静默留下悬空引用。
  - 自定义组件资产由 Workspace 项目持久化并纳入 Schema 校验、Revision、undo/redo、导出和重启恢复；`localStorage` 只能作为原型或可迁移缓存。
  - 保存后的资产通过正式 Catalog/Registry 链路出现在 Components 面板，页面实例使用稳定资产引用；插入后实例可覆盖公开变量并向 Slot 提供内容。
  - 专注模式不显示与当前组件无关的页面噪音，但不能另造一套选择、坐标、规则或拖放实现。
  - 增加资产 Schema、迁移、绑定、Revision、导出契约测试，以及真实浏览器中的创建、编辑、保存、刷新、复用和错误恢复场景。

### STUDIO-027：默认布局未同时展示 Outline 与 Components 面板

- **来源**：第四批反馈 7
- **类型 / 优先级 / 状态**：Workbench layout / information architecture / P1 / Ready for Verification
- **影响范围**：Workbench 默认 Layout、Panel Contribution、布局持久化与 migration、左右 Activity Bar
- **实际行为**：Page Outline 与 Components 作为同一 Tab Group 中的互斥 Tab，用户无法一边查看页面结构一边从组件库拖入新节点。
- **期望行为**：默认工作区从左到右为“左侧栏、Page Outline、Components、Editor、Inspector、右侧栏”；Outline 与 Components 同时可见，Components 紧邻 Outline 右侧，两个面板默认等宽。
- **实现证据**：默认 Layout 已拆为 `tabs.primary` 与 `tabs.components` 两个相邻独立区域，初始 size 均为 `0.16`；Components 关闭后使用独立目标重开。`useWorkbenchLayout` 从 v2 升级至 v3，并将旧版 `tabs.primary` 中的 Outline/Components 一次性迁移为等宽并列区域。Workbench 契约测试覆盖默认顺序、等宽与重开目标。
- **验收条件**：
  - 全新工作区或 Reset Layout 后，六个区域按上述顺序出现；Page Outline 与 Components 不再默认合并为互斥 Tab。
  - Outline 和 Components 使用同一默认宽度、相同最小宽度和一致的 seam；用户可独立调整二者宽度。
  - 默认 Layout Schema 具有稳定 ID 和版本；旧持久化布局通过显式 migration 保留用户有效调整，不被静默重置。
  - 1024px、1440px、1920px 和 2560px 下 Editor 始终保留可用主区域；较窄窗口使用有文档记录的折叠或最小宽度策略。
  - 关闭、重开、停靠、恢复和 Reset Layout 后，两个 Panel 不会意外重新合并、交换顺序或产生双重分隔线。
  - 左右侧栏入口准确反映各自 Panel 的显隐状态，并与 `STUDIO-025` 使用同一命令状态源。

### STUDIO-028：缺少多页面根节点、新建页面入口与页面编辑 Tab

- **来源**：第四批反馈 8；产品模型见 [Studio Authoring Model](../product/studio-authoring-model.md#2-多页面工作区)
- **类型 / 优先级 / 状态**：Missing capability / document model / P1 / In Progress
- **影响范围**：Workspace 项目模型、Page Outline、Editor Tab、页面创建与命名、Revision、路由和持久化
- **实际行为**：当前 Workspace 只加载一个 `PageDocument`；界面没有可发现的新建页面按钮，Page Outline 只有单页面根，Editor 顶部也不能为多个页面分别打开 Tab。
- **期望行为**：一个项目可包含多个页面；Page Outline 的第一层是多个页面根节点，每个已打开页面在 Editor 顶部拥有独立 Tab，新建页面入口在页面上下文中清晰可见。
- **第四批实现证据**：Page Outline 已显示多个页面根，并在搜索框旁提供新建页面按钮；Editor Header 可同时打开、切换和关闭多个页面 Tab。页面具有稳定 ID、合法初始根结构和独立本地 revision，页面与 Tab 会话均可在刷新后恢复；切换页面复用同一个 Preview iframe，通过文档 ID 区分跨页面 revision 回退，并按“页面 + 断点”缓存内容高度，不再销毁 iframe、回到“正在加载”或先把 Canvas 高度清零。新增页面可使用与主页面相同的 Canvas、Outline、Inspector、组件拖放和结构移动逻辑。
- **剩余边界**：多页面编辑闭环当前使用 Studio 工作区本地持久化；Workspace Server 仍以单个主 `PageDocument` 为正式 Revision/History/Export 对象。项目级 Page Schema、服务端多页面 Revision 和项目导出完成前保持 In Progress。
- **验收条件**：
  - Page Outline 顶部提供可键盘访问、带 tooltip 的“新建页面”按钮，并支持命名、稳定 page ID 与安全的默认根结构。
  - Outline 第一层展示项目中的全部页面，每个页面是独立根节点；展开页面后才展示其内部节点。
  - 单击页面根会激活并打开对应 Editor Tab；多个页面可以同时保持打开，每个 page ID 至多一个 Tab。
  - Editor Tab 支持激活、关闭和恢复；关闭 Tab 只关闭视图，不删除页面，未保存或失败状态有明确反馈。
  - 切换页面时 Canvas、Outline 选中、Inspector、undo/redo、History 和 Preview 都绑定当前页面，不泄漏上一页面的 selection 或 Revision。
  - 页面新建、重命名、复制、删除和排序经过项目级 Command/Rule/Revision；删除具有确认和可恢复策略。
  - 定义并验证 `WorkspaceDocument → pages[] → PageDocument` 或等价正式 Schema，提供单页面项目的迁移路径；禁止用多个互不关联的 `localStorage` 文档代替项目模型。
  - 重启 Workspace Server、刷新 Studio、导出项目后，页面顺序、打开 Tab、当前页和每页内容按各自持久化边界正确恢复。
  - 增加多页面 Schema、迁移、Command、Revision、路由、Tab 恢复和真实浏览器编辑切换测试。

### STUDIO-029：Command Palette 搜索框及 Overlay 层叠与 Spectrum 不一致

- **来源**：第四批反馈 2
- **类型 / 优先级 / 状态**：Visual consistency / overlay defect / P2 / Ready for Verification
- **影响范围**：Command Palette、Spectrum UI 门面、Overlay Root、Page Outline 层叠与高亮
- **实际行为**：反馈基线中的 Command Palette 使用与 Spectrum 表单不同的搜索框外观；Overlay 打开时，底层 Tree 节点左侧方块及文字仍可能穿透或高亮，破坏模态层级。
- **实现证据**：当前工作区改动已将 Command Palette 接入 Studio `SearchField` 门面，并为 Overlay 建立更高层级；尚未在真实浏览器、Light/Dark 和不同停靠布局下完成视觉验收。
- **期望行为**：Command Palette 搜索框与 Studio 其他 Spectrum SearchField 使用同一结构、Token 和状态；Overlay 完全隔离底层 Tree 的 hover、focus、selection 与文本绘制。
- **验收条件**：
  - 搜索框的高度、边框、背景、圆角、图标、clear button、placeholder、focus ring、disabled 和错误状态与 Spectrum 门面一致。
  - 打开 Palette 后，键盘焦点进入搜索框并被正确约束；关闭后返回触发元素，`Escape` 和 clear 行为一致。
  - Overlay 位于独立、文档化的层级；Page Outline 的 kind 方块、文字、selection、focus ring、drop indicator 和 tooltip 都不能绘制在其上方。
  - 底层 Tree 在 Overlay 打开时不响应 hover、点击、拖动或键盘操作，关闭后状态不出现幽灵高亮。
  - 在 Light/Dark、窄/宽 Outline、滚动状态及 Panel 最大化后进行真实浏览器复验；视觉证据通过前保持 `Ready for Verification`，不得直接关闭。

### STUDIO-030：编辑目标缺少可扩展的 Spectrum 右键菜单

- **来源**：后续用户反馈；产品模型见 [Studio Authoring Model](../product/studio-authoring-model.md#6-上下文编辑菜单)
- **类型 / 优先级 / 状态**：Missing capability / extensibility / P1 / Ready for Verification
- **影响范围**：Page Outline、Editor Tab、Components、Canvas、组件专注工作台、Studio UI 门面、Command 与插件贡献边界
- **实际行为**：反馈基线没有右键编辑菜单；用户只能寻找散落在各 Panel 的按钮，且扩展新的目标或动作时没有统一注册、条件解析和分组模型。
- **实现证据**：
  - 新增 `ContextMenuRegistry`，贡献项通过稳定 ID、目标类型、Section、排序、`when` 条件和 `build` 函数解析；支持通配目标、嵌套 Submenu、disabled、异步动作和动态注销。
  - Studio UI 门面使用 React Spectrum S2 的 `MenuTrigger`、`Menu`、`MenuSection`、`SubmenuTrigger`、`MenuItem`、图标、描述和快捷键提示呈现菜单，并负责定位、Escape、Overlay 焦点与关闭后的焦点恢复。
  - Page 根与 Tab、Outline 节点、注册/已保存/自定义组件卡片、Canvas 空白与命中节点、组件专注工作台的根、Slot、节点和 Building Block 已接入统一右键入口。Canvas 右键先经 Preview hit-test 判定节点，未命中时退回 Canvas 菜单。
  - 菜单 Registry 不持有 Studio Session；Surface 只暴露当前目标实际具备的 capability，删除节点继续调用本地结构变更或服务端 `node.remove` Command，undo/redo、页面和视图动作复用原有业务路径。
  - `tests/contracts/studio-context-menu.test.ts` 覆盖目标过滤、Section/排序、条件贡献、注销、嵌套项以及各编辑 Surface 的右键接入。Chrome 冒烟已确认 Outline 节点、注册组件卡片和 Canvas 命中节点展示不同菜单。
- **验收条件**：
  - 右键 Page 根/Tab、Outline/Canvas 节点、注册组件、已保存/自定义组件、Canvas 空白和组件专注工作台目标时，只显示该目标当前支持的动作。
  - 菜单视觉、Section、Submenu、图标、描述、快捷键提示、disabled 和 Overlay 行为由 Spectrum Menu 门面提供，不在各 Feature 复制原生菜单。
  - 鼠标右键、键盘 Context Menu 键与 `Shift+F10` 使用同一目标解析；`Escape` 关闭，焦点返回原触发对象，菜单不干扰左键选择和拖放。
  - 节点删除、页面操作、undo/redo 和视图操作复用既有权限、Rule、Command、Revision 与错误边界；异步失败有可诊断反馈。
  - 第三方或后续模块可以注册、排序、按目标状态隐藏/禁用并注销贡献，不需要修改 Menu Renderer；重复贡献 ID 被拒绝。
  - 关键动作保留按钮、Command Palette 或键盘入口，右键菜单不是唯一可访问路径。
  - 在 Light/Dark、页面编辑/组件专注模式、滚动/缩放 Canvas 及不同停靠布局下完成真实浏览器矩阵后方可关闭。

## 7. 修复批次与依赖

### Batch A：恢复可信的核心链路

1. **STUDIO-002**：修复 Preview 握手、opaque-origin 开发加载和画布选择。
2. **STUDIO-003**：在可信 Preview 连接上复验 Inspector / Revision / Preview 同步，移除伪操作控件。
3. **STUDIO-016**：保证工作区面板始终可恢复。
4. **STUDIO-001**：接通 Export 完成“编辑 → 验证 → Revision → 导出”闭环。

### Batch B：页面结构操作

1. **STUDIO-004**：组件插入、Slot 命中、结构拖放和撤销。
2. **STUDIO-005**：Page / Component 搜索。
3. **STUDIO-006**：Outline 折叠、键盘导航和搜索联动。

### Batch C：Workbench 和高密度布局整治

1. **STUDIO-011**：先修正 Titlebar 结构性布局错误。
2. **STUDIO-009 + STUDIO-012**：同时处理 Split 归一化、Panel seam 和 resize hit target。
3. **STUDIO-013 + STUDIO-014 + STUDIO-015**：使用共享的窄面板响应和溢出策略处理 Tree / Component Grid。
4. **STUDIO-010**：在 seam 规则稳定后统一滚动条。

### Batch D：视觉系统和设置面

1. **STUDIO-017**：建立 Settings 路由/对话框和 Catalog 数据流。
2. **STUDIO-007**：基于 Settings 与语义颜色 Token 实现 Light / Dark / System。
3. **STUDIO-008**：替换 Unicode 图标并统一尺寸、tooltip 和无障碍名称。

### Batch E：Authoring Model 与工作区信息架构

1. **STUDIO-004**：先稳定缩放后的拖动几何和“组件只可拖入”交互契约，避免新编辑器复用错误坐标逻辑。
2. **STUDIO-027**：建立 Outline 与 Components 同时可见的默认布局，并完成 Layout migration。
3. **STUDIO-028**：定义项目级多页面 Schema、页面 Command、Editor Tab 和单页面迁移。
4. **STUDIO-026**：在正式项目资产模型上完成自定义组件专注工作台、同构结构树、变量与 Slot 闭环。
5. **STUDIO-029**：按 Spectrum 与 Overlay 层级矩阵完成视觉复验。
6. **STUDIO-030**：完成上下文菜单的目标、键盘、焦点、Command 与扩展贡献矩阵复验。

## 8. 本轮复盘与流程改进

### 8.1 已发现的开发流程问题

- 过早将“存在代码”记录为“能力完成”，没有经过用户可见交互验收。
- 一些占位 UI 使用了可点击或可拖动的视觉暗示，但没有实际行为。
- Preview 协议有 Schema 和单元测试，但缺少覆盖真实 sandbox origin、iframe 生命周期和点击交互的浏览器级验证。
- Workbench 测试覆盖单次关闭/停靠，但没有覆盖“关闭最后一个 Tab”和多次重组后的布局归一化。
- 响应式检查主要围绕顶层 viewport，没有覆盖 IDE 面板被拖到极窄宽度时的容器级布局。

### 8.2 新的交付门禁

从本文档建立后，Studio 功能只有在以下条件都满足时才可标记为完成：

1. 领域和协议契约测试通过。
2. TypeScript 检查和生产构建通过。
3. 关键用户路径有组件或浏览器级交互测试，不只测纯函数。
4. 在默认、最小可用和常见宽屏尺寸下复验。
5. 所有显示为可操作的按钮、输入框、箭头和拖动光标都有对应行为；尚未实现的能力必须明确禁用并说明原因。
6. 按 Issue 内的验收条件完成用户复验，再将状态改为 Closed。

## 9. 处理记录

| 日期       | 事件                                                                   | 结果                                                                                                                                                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-23 | 用户对首个 Studio 编辑版进行验收                                       | 提交 17 项功能、视觉和布局问题                                                                                                                                                                                                                                                                                            |
| 2026-07-23 | 核对 App、Canvas、Preview、Inspector、Outline、Workbench Layout 和 CSS | 建立 STUDIO-001～STUDIO-017，明确根因、依赖与验收条件                                                                                                                                                                                                                                                                     |
| 2026-07-23 | 修复 STUDIO-002 的 opaque-origin 开发加载子问题                        | Preview Host 明确允许 `Origin: null`；模块加载、构建、类型检查和测试通过，Issue 保持 Open 等待完整交互复验                                                                                                                                                                                                                |
| 2026-07-23 | 完成 STUDIO-001～017 开发修复批次                                      | 接通 Export / Catalog / Settings / Theme / Inspector / 插入 / 搜索 / Tree 键盘链路；修复 Preview 可恢复握手、Workbench 恢复与归一化、seam、窄面板和统一图标；全仓类型检查、Studio/Preview 生产构建、18 个测试文件 77 项测试通过。因当前环境无可用内置浏览器，统一进入 Ready for Verification，等待真实浏览器 UAT 后关闭。 |
| 2026-07-23 | 第二轮用户验收与问题重分类                                             | STUDIO-003、004、008 重开；新增第二轮追踪文档 STUDIO-R2-001～005，明确已有节点移动、Tooltip 时序、variant 视觉覆盖和 Dock Overlay 视觉问题。                                                                                                                                                                              |
| 2026-07-23 | 完成第二轮整改开发门禁                                                 | STUDIO-003、004、008 再次进入 Ready for Verification；实现和测试证据详见第二轮追踪文档。                                                                                                                                                                                                                                  |
| 2026-07-23 | 第三批用户反馈去重与稳定 ID 整理                                       | 插入位置、Outline 移动和 Component Slot 归并到 STUDIO-004；Dock 反馈延续为 STUDIO-018；其余反馈去重后建立 STUDIO-019～025。轮次编号只用于 UAT，不再创建 `STUDIO-R3-*`。                                                                                                                                                   |
| 2026-07-23 | 核对第三批整改实现                                                     | `4165e71`、`f22f34f`、`90afce7` 和 `f7fd334` 提供 History Restore、display metadata、Slot、Saved components、i18n、分组和 Workbench 实现证据；功能项按开发门禁进入 Ready for Verification，仍依赖视觉判断的 STUDIO-004、018、022、024、025 保持 In Progress。                                                             |
| 2026-07-23 | 第四批创意与问题反馈归类                                               | Outline 视口聚焦归并到 STUDIO-002；组件仅拖入和缩放后蓝色指示器复发归并到 STUDIO-004；建立 STUDIO-026～029 跟踪自定义组件专注编辑、默认双面板布局、多页面模型和 Command Palette / Overlay 一致性。                                                                                                                        |
| 2026-07-23 | 建立长期 Authoring Model 记录                                          | 新建 `docs/product/studio-authoring-model.md`，记录多页面根节点、Editor Tab、自定义组件资产、变量/Slot 以及同构结构树边界；这些内容是产品契约，不伪装成已完成能力或正式 UAT。                                                                                                                                             |
| 2026-07-23 | 完成第四批用户可见实现                                                 | Overlay 改为视口坐标层并覆盖 50%～200% 缩放矩阵；Components 保持纯拖拽；默认 Outline/Components 等宽并列并迁移 v2 布局；新增多页面根、创建入口、Editor Tab 和独立 Preview 会话；组件专注页补齐同构结构树与 Slot 移动。Typecheck、ESLint、Stylelint、130 项测试及 Studio/Preview/全仓构建通过。                            |
| 2026-07-23 | 完成后续编辑体验修正                                                   | Preview 中布局节点增加 72px 基础高度、空布局增加 96px 插入面；Editor Tab 切换复用 iframe 并支持跨文档 revision 回退；组件专注页按结构树、组件库、画布、配置拆为四列。Typecheck、ESLint、Stylelint、132 项测试及 Studio/Preview/全仓构建通过，等待真实浏览器视觉复验。                                                     |
| 2026-07-23 | 消除页面与组件专注切换闪屏                                             | Canvas 高度改为按页面和断点缓存，页面切换不再清零；组件专注页覆盖在保留 DOM 的主工作台上；Preview 初始化前不再渲染示例页面，加载提示等待组件文档首帧后再切换为空状态。Chrome 实测确认主 iframe 身份保持、加载与空状态连续。                                                                                               |
| 2026-07-23 | 接入可扩展 Spectrum 上下文菜单                                         | 建立目标感知的 Context Menu Registry 与 UI 门面，覆盖 Page、节点、组件、Canvas 和组件专注工作台；复用现有 capability / Command 路径，并通过 135 项测试与 Chrome Outline、组件卡片、Canvas 节点冒烟。完整浏览器矩阵前保持 Ready for Verification。                                                                         |

后续每次状态变更都应在本表追加记录，而不覆盖历史。
