# Studio 验收问题追踪

> 创建日期：2026-07-23  
> 来源：Studio 第一轮用户验收（UAT）  
> 验收基线：`2eeb35f` 及其之前的 Studio / Preview / Workbench 实现  
> 追踪范围：17 项用户反馈，对应原始编号 0～16

本文档是 Studio 当前用户可见问题的事实来源。`TODO.md` 记录路线，`CURRENT_STATUS.md` 记录已交付能力，本文档则记录“已实现但未通过用户验收”、“仅有占位 UI”与“明确缺失”的项目。代码已存在、类型检查通过或单元测试通过，都不等于用户验收通过。

## 1. 管理规则

### 1.1 状态

| 状态 | 含义 |
| --- | --- |
| Open | 问题已确认，尚未开始修复 |
| In Progress | 已有负责人和实现分支，正在修复 |
| Ready for Verification | 已通过开发检查，等待按本文验收条件复验 |
| Closed | 验收条件全部通过，已记录修复提交和测试证据 |
| Blocked | 受上游协议、产品决策或其他 Issue 阻塞 |

### 1.2 优先级

| 优先级 | 判定标准 |
| --- | --- |
| P0 | 核心编辑链路无法使用，或会造成工作区不可恢复 |
| P1 | 重要能力缺失或显著影响专业工具使用效率 |
| P2 | 不阻断核心任务，但影响一致性、可读性或长时间使用体验 |

### 1.3 关闭要求

每个 Issue 关闭时必须同时记录：

- 修复提交。
- 自动化测试位置和结果。
- 用户可见交互的复验结果。
- 如果改动协议、布局 Schema 或设计系统，同步更新架构文档或 ADR。

## 2. Issue 总览

| ID | 原始编号 | 类型 | 优先级 | 状态 | 标题 |
| --- | ---: | --- | --- | --- | --- |
| STUDIO-001 | 0 | Missing integration | P1 | Open | Export 按钮未连接导出流程 |
| STUDIO-002 | 1 | Functional bug | P0 | Open | 画布点击无法稳定选中 Preview 节点 |
| STUDIO-003 | 2 | Functional bug / incomplete capability | P0 | Open | Inspector 控件与 Preview 更新链路不可靠 |
| STUDIO-004 | 3 | Missing capability | P1 | Open | 组件无法点击或拖放到页面 |
| STUDIO-005 | 4 | Missing capability | P2 | Open | Page 和 Component 搜索框不执行过滤 |
| STUDIO-006 | 5 | Missing capability | P2 | Open | Page Outline 节点无法折叠或展开 |
| STUDIO-007 | 6 | Product gap | P2 | Open | Studio 只有暗色主题 |
| STUDIO-008 | 7 | Visual usability | P1 | Open | 图标语义不清且尺寸不一致 |
| STUDIO-009 | 8 | Workbench layout defect | P1 | Open | 面板停靠后产生零碎且不规则的嵌套网格 |
| STUDIO-010 | 9 | Visual usability | P2 | Open | 面板滚动条过粗且与界面密度不匹配 |
| STUDIO-011 | 10 | Layout defect | P1 | Open | Titlebar 的网格定义与子元素数量不匹配 |
| STUDIO-012 | 11 | Layout defect | P1 | Open | 面板边界和分隔缝宽度不一致 |
| STUDIO-013 | 12 | CSS defect | P1 | Open | Tree kind 标识在窄面板中被压缩 |
| STUDIO-014 | 13 | CSS defect | P1 | Open | Component Grid 文字在窄面板中溢出 |
| STUDIO-015 | 14 | CSS/layout defect | P1 | Open | 结构树行在窄面板中不能稳定占满可见宽度 |
| STUDIO-016 | 15 | Recoverability bug | P0 | Open | 关闭某区域最后一个 Tab 后无法重新打开面板 |
| STUDIO-017 | 16 | Missing capability | P1 | Open | Token / Registry / Settings 管理入口缺失 |

## 3. 功能 Issue

### STUDIO-001：Export 按钮未连接导出流程

- **原始编号**：0
- **类型 / 优先级 / 状态**：Missing integration / P1 / Open
- **影响范围**：Titlebar、Studio Session、Workspace Export API、导出结果反馈
- **实际行为**：点击 Titlebar 中的 `Export` 按钮没有任何反应。
- **代码证据**：`apps/studio/src/App.tsx` 中 `.export-button` 只有文本和样式，没有 `onClick`；`StudioSessionValue` 也没有 export 操作。Workspace Server 已提供 `POST /v1/export`，因此这是 Studio 集成缺失，不是服务端能力缺失。
- **期望行为**：按钮打开轻量导出对话框，默认导出当前 Revision，并显示进行中、成功或失败状态。
- **验收条件**：
  - 点击后有明确的对话框或导出界面，不进行静默操作。
  - 请求使用当前已确认 Revision，并通过 API 协议验证。
  - 成功时显示输出位置和 manifest 摘要；失败时提供可重试的错误信息。
  - 包含 Studio 交互测试和 Workspace HTTP 集成测试。

### STUDIO-002：画布点击无法稳定选中 Preview 节点

- **原始编号**：1
- **类型 / 优先级 / 状态**：Functional bug / P0 / Open
- **影响范围**：Canvas Viewport、sandboxed iframe、Preview 协议、Selection Overlay、Inspector
- **实际行为**：画布中的元素可见，但鼠标点击后不会稳定更新当前选中节点、Outline 选中态和 Inspector。
- **代码证据**：
  - iframe 使用 `sandbox="allow-scripts"`，Preview 文档因此是 opaque origin；开发服务需要明确处理 `Origin: null`。
  - `CanvasViewport` 依赖 `preview.ready` 后才发送 `preview.hitTest`，但 iframe `onLoad` 会将 `previewReady` 重置为 `false`。如果 `preview.ready` 早于父页 `onLoad` 处理，就会丢失就绪状态。
  - 当前没有 ready 超时、重试、心跳或用户可见的“Preview 未连接”状态。
- **期望行为**：画布点击通过统一坐标服务命中最深层可编辑节点，并在任意缩放、平移和断点下同步 Outline、Overlay 和 Inspector。
- **验收条件**：
  - Preview 握手只有一个明确的状态机，不受 `load` / `ready` 时序影响。
  - 连接失败时 Canvas 显示错误和重试入口，而不是静默忽略点击。
  - Desktop、Tablet、Mobile 以及 50%、100%、150% 缩放下点击选择正确。
  - 点击、空格拖动平移和触控板手势不互相触发。
  - 增加覆盖 opaque-origin sandbox 的浏览器级交互测试。

### STUDIO-003：Inspector 控件与 Preview 更新链路不可靠

- **原始编号**：2
- **类型 / 优先级 / 状态**：Functional bug / incomplete capability / P0 / Open
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

### STUDIO-004：组件无法点击或拖放到页面

- **原始编号**：3
- **类型 / 优先级 / 状态**：Missing capability / P1 / Open
- **实际行为**：Component Grid 的卡片显示抓取光标，但无法拖动，点击也不会向页面插入组件。
- **代码证据**：`ComponentsPanel` 中的 button 没有 `onClick`、`draggable`、drag payload 或键盘插入命令；`StudioSessionValue` 也没有 `node.insert` / `node.move` 提交方法。CSS 却使用 `cursor: grab`，导致错误的功能暗示。
- **期望行为**：点击使用可预测的默认位置插入；拖动时仅显示符合 Slot Policy 的合法落点和插入位置。
- **验收条件**：
  - Component Grid 同时支持点击插入、指针拖放和键盘操作。
  - Preview 回传可命中的父节点、Slot 和 before-node 意图，Studio 生成 `node.insert` / `node.move` Command。
  - 非法 Slot 不允许放置，并显示原因；不允许绕过 Rule Engine。
  - 插入成功后选中新节点，并可 undo/redo。
  - 覆盖布局 children 和命名 Slot 两种结构。

### STUDIO-005：Page 和 Component 搜索框不执行过滤

- **原始编号**：4
- **类型 / 优先级 / 状态**：Missing capability / P2 / Open
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
- **类型 / 优先级 / 状态**：Missing capability / P2 / Open
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
- **类型 / 优先级 / 状态**：Product gap / P2 / Open
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
- **类型 / 优先级 / 状态**：Visual usability / P1 / Open
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
- **类型 / 优先级 / 状态**：Workbench layout defect / P1 / Open
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
- **类型 / 优先级 / 状态**：Visual usability / P2 / Open
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
- **类型 / 优先级 / 状态**：Layout defect / P1 / Open
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
- **类型 / 优先级 / 状态**：Layout defect / P1 / Open
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
- **类型 / 优先级 / 状态**：CSS defect / P1 / Open
- **实际行为**：工具面板缩窄时，16×16 的节点类型标识会被 Flex 压缩到难以识别。
- **代码证据**：`.tree-kind` 只设置 `width` 和 `height`，没有 `flex: 0 0 16px` / `flex-shrink: 0`；`.tree-arrow` 存在同样风险。
- **期望行为**：类型标识和展开箭头保持固定视觉尺寸，只允许文本区域压缩。
- **验收条件**：
  - 图标与箭头都设置固定 flex basis 和 `flex-shrink: 0`。
  - 文本容器使用 `min-width: 0`和 ellipsis，完整名称通过 tooltip 可访问。
  - 在 180px 面板宽度和至少 6 层缩进下仍可识别节点类型。

### STUDIO-014：Component Grid 文字在窄面板中溢出

- **原始编号**：13
- **类型 / 优先级 / 状态**：CSS defect / P1 / Open
- **实际行为**：当 Component 面板较窄时，如 `PricingCard` 等较长名称超出 button 边界。
- **代码证据**：Grid 固定为两列，button 虽有 `min-width: 0`，但文字不在独立的可压缩容器中，也没有 wrap、ellipsis 或容器查询降为单列。
- **期望行为**：组件名称始终保留在卡片内，格子数根据 Panel Host 宽度响应，而不是根据顶层窗口响应。
- **验收条件**：
  - 使用 container query 或等价的面板宽度规则在一列/两列间切换。
  - 长名称使用可预测的单行 ellipsis 或最多两行截断，完整名称在 tooltip 中可见。
  - 180px～480px 面板宽度下无水平滚动和文字越界。

### STUDIO-015：结构树行在窄面板中不能稳定占满可见宽度

- **原始编号**：14
- **类型 / 优先级 / 状态**：CSS/layout defect / P1 / Open
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
- **类型 / 优先级 / 状态**：Recoverability bug / P0 / Open
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
- **类型 / 优先级 / 状态**：Missing capability / P1 / Open
- **实际行为**：界面没有 Token、Component Registry、Policy 或其他项目设置的可用入口；Activity Bar 的齿轮按钮无响应，Inspector 的 Token 字段为禁用按钮。
- **代码证据**：Settings 按钮没有 `onClick`；Studio 没有 Settings route / dialog，也没有调用已存在的 `GET /v1/catalog`。当前 Token Registry 只存在于项目 JSON、服务端 Catalog 和 Preview 渲染链路中，没有用户界面。
- **期望行为**：按照产品约束，Token 和 Registry 等全局配置进入独立 Settings 页面或对话框，不长期占用画布主工作区。
- **验收条件**：
  - Settings 按钮可键盘访问，并打开独立路由或模态对话框。
  - 至少提供 Theme、Token Browser、Component Registry Browser 和 Workspace 连接状态。
  - Token / Component 数据来自受协议验证的 Catalog API，不在 Studio 中再维护静态副本。
  - 未开放的写操作明确标记为只读，不伪装成可点击控件。
  - API token / 密钥等敏感配置不出现在画布常驻界面，且不写入 PageDocument。

## 6. 修复批次与依赖

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

## 7. 本轮复盘与流程改进

### 7.1 已发现的开发流程问题

- 过早将“存在代码”记录为“能力完成”，没有经过用户可见交互验收。
- 一些占位 UI 使用了可点击或可拖动的视觉暗示，但没有实际行为。
- Preview 协议有 Schema 和单元测试，但缺少覆盖真实 sandbox origin、iframe 生命周期和点击交互的浏览器级验证。
- Workbench 测试覆盖单次关闭/停靠，但没有覆盖“关闭最后一个 Tab”和多次重组后的布局归一化。
- 响应式检查主要围绕顶层 viewport，没有覆盖 IDE 面板被拖到极窄宽度时的容器级布局。

### 7.2 新的交付门禁

从本文档建立后，Studio 功能只有在以下条件都满足时才可标记为完成：

1. 领域和协议契约测试通过。
2. TypeScript 检查和生产构建通过。
3. 关键用户路径有组件或浏览器级交互测试，不只测纯函数。
4. 在默认、最小可用和常见宽屏尺寸下复验。
5. 所有显示为可操作的按钮、输入框、箭头和拖动光标都有对应行为；尚未实现的能力必须明确禁用并说明原因。
6. 按 Issue 内的验收条件完成用户复验，再将状态改为 Closed。

## 8. 处理记录

| 日期 | 事件 | 结果 |
| --- | --- | --- |
| 2026-07-23 | 用户对首个 Studio 编辑版进行验收 | 提交 17 项功能、视觉和布局问题 |
| 2026-07-23 | 核对 App、Canvas、Preview、Inspector、Outline、Workbench Layout 和 CSS | 建立 STUDIO-001～STUDIO-017，明确根因、依赖与验收条件 |

后续每次状态变更都应在本表追加记录，而不覆盖历史。
