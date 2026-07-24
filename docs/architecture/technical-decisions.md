# AI 友好的低代码网页设计器：技术决策汇总

> 最后更新：2026-07-24

> 产品设计参见 [产品设计](../product/ai-low-code-designer.md)，模块和目录设计参见 [系统架构](./system-overview.md)，Studio 与画布参见 [Studio Workbench](./studio-workbench.md)。最初的开工条件已归档为 [实施准备基线](../archive/2026-07-22-implementation-readiness.md)，当前进度以 [项目状态](../project/status.md) 为准。

## 1. 文档目的

本文档记录项目的关键技术选型、选择理由、边界和暂不实施的能力。

决策状态分为：

- **已确定**：架构和 MVP 实现必须遵循。
- **MVP 默认**：先按推荐方案实现，出现实际证据后可以通过 ADR 调整。
- **后置**：当前只保留扩展接口，不在 MVP 中实现。

技术选型发生变化时，应新增 ADR 记录原因、替代方案和迁移影响，不能只修改代码而不更新决策。

## 2. 已确定的核心决策

### TD-001：页面与组件的事实来源

**状态：已确定**

采用分层事实来源：

```text
组件内部实现                → 组件源码负责
页面使用哪些组件            → Page Schema 负责
组件如何组合和排列          → Page Schema 负责
页面状态、交互和响应式意图  → Page Schema 负责
最终页面代码                → 下游 AI 或确定性工具依据 PageDocument 实现
```

MVP 不支持任意修改生成代码后再自动反向同步回 Schema。

需要手写扩展时，必须通过以下方式之一进入系统：

- 注册真实组件。
- 使用受控 Slot。
- 使用注册的 Hook 或行为适配器。
- 扩展 Component Definition。

不接受“Schema 和代码自由双向同步”作为首版目标，因为它会引入难以验证的 AST 反向解析和双重事实来源。

### TD-002：所有客户端使用统一修改链路

**状态：已确定**

所有页面修改统一经过：

```text
Human Action / Future MCP Commands
                ↓
             Command
                ↓
           Rule Engine
                ↓
              Patch
                ↓
        Document Transaction
```

Studio、Renderer、Workspace Server 和未来 MCP 都不能直接绕过 Command Engine 修改 PageDocument。

### TD-002A：PageDocument 独立和前后端分离

**状态：已确定**

`document-schema` 是零内部业务依赖的纯协议包，不依赖 Studio、React、后端、Registry、AI 或 MCP。PageDocument 不能包含任何客户端临时状态、存储状态或运行时对象。

MVP 采用浏览器 Studio 与本地 Workspace Server 分离：前端负责交互和乐观预览，后端负责最终验证、事务、版本和持久化。

### TD-003：封闭式样式系统

**状态：已确定**

页面样式只能来自：

1. Design Token。
2. Component Variant。
3. Layout Policy。

禁止 Page Schema 保存：

- 任意颜色值。
- 任意像素值。
- 任意 CSS 字符串。
- 任意 `className`。
- Tailwind arbitrary values。
- 未登记的局部样式对象。

### TD-004：封闭式布局与绝对定位

**状态：已确定**

普通内容节点只能通过 Section、Container、Stack、Row 和 Grid 布局。

普通节点不允许保存 `x`、`y`、`top`、`left` 或通用 `position`。叠加场景只能通过受控 Overlay 表达，并必须声明：

- 用途。
- 锚点。
- 定位边界。
- Token 化偏移。
- 碰撞策略（适用时）。

### TD-005：Web Components 的定位

**状态：已确定**

Web Components：

- 不作为核心组件标准。
- 不进入 Page Schema。
- 不作为 MVP 前置条件。
- 后续可以通过 Runtime Adapter 接入。

核心 Schema 和组件注册协议保持框架无关，MVP 只实现 React Runtime Adapter。

## 3. MVP 默认技术栈

### TD-006：Monorepo 与构建工具

**状态：已调整（2026-07-24）**

```text
包管理与工作区    pnpm workspace
任务编排          根 package.json scripts（pnpm --parallel / --filter）
语言              TypeScript
Studio            React
开发与构建        Vite
```

核心包采用 ESM。具体运行时和 TypeScript 版本在初始化仓库时统一锁定，禁止不同包自行选择不兼容版本。

Turborepo 未采用：当前只有 typecheck、test、build、lint 等少量根脚本，没有证据表明需要额外任务编排与缓存层；出现真实需求时通过新 ADR 引入。

### TD-007：Schema 定义与运行时验证

**状态：已确定**

采用：

```text
跨进程协议        JSON Schema 2020-12
TypeScript 编写   TypeBox
运行时验证        TypeBox Schema Compiler
```

运行时验证器选型已由 [ADR-0001](../adr/0001-typebox-schema-compiler.md) 确定为 TypeBox Schema Compiler。

不能只使用 TypeScript Interface，因为静态类型无法验证：

- 本地文件内容。
- Studio 与 Workspace Server 的通信。
- 未来 MCP 返回的 Proposed Commands。
- Schema 版本迁移后的数据。

### TD-008：Command 与 Patch 格式

**状态：MVP 默认**

对外暴露领域 Command，对内使用基于节点 ID 的结构化 Patch。

示例：

```ts
type MoveNodeCommand = {
  type: "node.move";
  nodeId: NodeId;
  targetParentId: NodeId;
  targetSlot: SlotName;
  beforeNodeId?: NodeId;
};
```

不把通用 RFC 6902 JSON Patch 直接暴露给外部客户端，也不使用数组索引作为节点身份。

### TD-009：节点身份与排序

**状态：MVP 默认**

- Node ID：UUIDv7。
- Command ID：UUIDv7。
- 单用户 MVP：子节点数组保存顺序。
- 移动操作：通过 Node ID 和 `beforeNodeId` 表达。
- 暂不引入 fractional indexing。

### TD-010：组件注册方式

**状态：MVP 默认**

`*.ui.ts` 人工声明是组件注册的权威来源，TypeScript AST 分析只用于：

- 生成 Props 定义初稿。
- 检查源码 Props 与注册定义是否漂移。
- 生成待确认的组件注册建议。

AST 自动分析不能替代人工声明，因为它无法可靠推断业务语义、Slot、组合限制和无障碍规则。

### TD-011：首个组件运行时

**状态：MVP 默认**

- 首个运行时：React。
- 首个渲染包：`react-renderer`。
- Vue：后续 Runtime Adapter。
- Web Components：后续可选 Runtime Adapter。

React 类型不能进入 `document-schema`、`rule-engine`、`command-engine` 和 API/MCP 协议。

### TD-012：真实组件预览

**状态：已由 [ADR-0005](../adr/0005-studio-canvas-direct-dom-rendering.md) 取代**

Canvas 在 Studio React 树内直接挂载 `PageRenderer`，渲染为同一文档中的原生 DOM。项目
不启动独立 Preview Host，不使用 iframe、跨窗口消息或每用户预览服务器。

Canvas Runtime 负责：

- 加载真实项目组件。
- 应用项目 Token 和主题。
- 渲染 Page Schema。
- 通过 DOM API 提供节点边界、命中和内容高度。
- 复用 Studio 的 Vite HMR。

该决策的约束：

- 只有注册并受信的声明式组件可以进入 Runtime。
- Renderer 保持只读，编辑仍走 Command 与 Revision。
- 响应式基于 Canvas 容器宽度，不基于顶层 viewport。
- 若未来执行不可信代码，另建隔离运行时，不能恢复旧桥接协议。

### TD-013：Token 的运行时输出

**状态：MVP 默认**

```text
Design Token
    ↓
CSS Custom Property
    ↓
Component Variant / Layout Class
```

Page Schema 只保存 Token 引用。渲染器负责将引用转换为受控 class 或 CSS Custom Property。

目标项目可以使用 Tailwind、CSS Modules 或其他样式技术，但必须通过注册的组件变体和 Token 映射使用，不能向 Schema 暴露任意 class。

### TD-014：响应式模型

**状态：MVP 默认**

- 固定 `mobile`、`tablet`、`desktop` 三种语义模式。
- 页面级结构主要编译为 Media Query。
- 可复用组件可以优先使用 Container Query。
- 节点不能创建任意数字断点。
- 具体断点值由 Layout Policy 统一管理。

Schema 保存响应式意图，而不是 CSS 查询字符串。

### TD-015：拖拽引擎

**状态：重建中（2026-07-24）**

Studio 已把 Tree Index、Drop Policy、二维 Grid 和嵌套目标解析抽取到框架无关的 `@agidn/layout-engine`。Canvas Sensor 当前仍使用 HTML Drag and Drop；迁移到 Pointer/Touch/Keyboard Sensor、Geometry Snapshot 和 Preview Projection 的设计见 [Canvas 拖拽与布局引擎重建设计](./canvas-drag-layout-engine.md)。

`dnd-kit` 是 Sensor Adapter 的推荐候选，但尚未引入。若验证后采用，仍必须隔离在 Studio Adapter 边界后。

项目自身负责：

- Slot 合法性。
- 插入位置计算。
- 布局和语义规则。
- Command 生成。
- 非法操作建议。

第三方拖拽库的类型不能进入 Page Schema 或 Command 协议。

### TD-016：状态管理

**状态：已调整（2026-07-23）**

```text
Page Document    自研 Document Engine + Command Reducer
Editor UI State  React Context + 功能级状态（Studio Session）
远程服务数据     独立 Query Cache（需要时引入）
```

Zustand 未引入：当前编辑器状态由 React Context 和功能级 `useState` 承载；出现真实性能或规模证据时再评估轻量 Store。

页面文档、拖拽临时状态、面板状态和服务端缓存不能混入同一个 Store。

### TD-017：本地持久化

**状态：已调整（2026-07-23）**

项目目录中的 PageDocument 文件是正式来源。实际持久化布局为：

- Revision、History 和 undo/redo 状态保存在文档同目录的 `.revision-store/`，格式见 [Revision Store](../api/revision-store.md)。
- Schema Context Package 导出到文档同目录的 `.ui-context/`。
- 正式 Composite/Pattern 资产保存在项目 `assets.json`，由 Workspace Server 严格校验并通过 Catalog 与 Context Package 输出。
- 旧 Saved/Custom 浏览器资产原型已删除；禁止建立迁移缓存或第二套 `localStorage` 资产事实来源。
- Studio 多页面仍是待升级的本地页面模型，由 `STUDIO-028` 跟踪；它不得承载 Composite/Pattern 资产。

原 `.ai-ui/` 项目目录方案未采用。浏览器不能直接写项目文件，必须通过 Workspace Server。

### TD-018：Studio 与 Workspace Server 通信

**状态：MVP 默认**

- HTTP：查询、保存、获取注册表、提交 Command 和导出文档。
- WebSocket：文件变化、预览状态和后台任务进度。
- 所有消息都使用 JSON Schema 验证。
- 所有消息都带协议版本。
- MVP 不引入 GraphQL。

### TD-019：Schema Context Package 导出

**状态：MVP 默认**

系统导出版本化的 Schema Context Package，文件内容与导出规则的权威定义见 [Schema Context Package](../api/context-package.md)。

`document.json` 是页面唯一事实来源，其他文件只解析引用。导出器不能修改 PageDocument，也不能把 AI 厂商字段写入文档。

### TD-020：Workspace Server 权限

**状态：MVP 默认**

Workspace Server 默认允许读写：

- 当前页面文件。
- PageDocument 文件和文档历史。
- 注册表声明的项目资源。
- 明确配置的预览与导出目录。

默认禁止访问或修改：

- 组件库内部实现。
- Design Token 定义。
- 项目配置。
- 依赖清单。
- 构建配置。

浏览器请求不能扩大 Workspace Server 的文件权限。未来 MCP 判断必须修改受保护区域时，应生成单独提案并等待用户批准。

### TD-021：页面文本模型

**状态：MVP 默认**

首版支持：

- 纯文本。
- 有限的语义文本节点。
- 有限的 inline mark，例如强调、链接和代码。

首版不允许任意 HTML，也不实现完整富文本编辑器，避免通过文本内容重新引入任意结构和样式。

### TD-022：测试工具

**状态：已调整（2026-07-23）**

```text
核心包单元测试    Vitest
Schema 契约测试   Vitest + JSON fixtures
规则测试          Table-driven tests
Studio 组件测试   Vitest（无 Testing Library）
端到端测试        未建立（已知缺口）
视觉回归          未建立（已知缺口）
无障碍检查        未建立（已知缺口）
组件示例          未建立
```

Testing Library、Playwright、axe-core 和 Storybook 均未安装。缺少浏览器级交互测试已在首轮 UAT 中造成漏检，属于 [项目状态](../project/status.md) 记录的未完成项；引入前不再需要新选型，直接按原计划评估 Playwright。

规则测试必须包含大量负向用例，证明非法状态无法创建，而不能只测试合法页面能够渲染。

### TD-022A：Studio Workbench 布局

**状态：已确定**

Studio 使用数据驱动、可版本化和可持久化的 Workbench 布局树，不使用写死的左中右三栏。布局节点支持嵌套 Split、Tab Group 和 Panel Host。

面板必须通过 Panel Registry 注册，并支持可访问的尺寸调整、移动、停靠、标签合并、折叠、关闭和恢复。Workbench State 与 PageDocument 完全分离。

### TD-022B：Canvas Viewport 与缩放边界

**状态：已确定**

画布使用独立 Viewport Controller。只有 Preview Surface 和 Interaction Overlay 应用 scale/translation，Studio Shell、工具栏、面板和文字不参与缩放。

触控板 pinch、双指平移、指针中心缩放、Fit Page 和 Fit Selection 是首版 Canvas 基线。直接 DOM 节点边界、Selection Overlay、拖放命中和辅助线共用单一坐标转换服务。

详细决策见 [ADR-0003](../adr/0003-studio-workbench-and-canvas-viewport.md)。

## 4. 后置决策

### TD-023：多人实时协作

**状态：后置**

MVP 不引入 Yjs 或其他 CRDT。

当前只保证：

- 节点具有稳定 ID。
- 所有操作使用 Command。
- Patch 带来源和版本。
- Document Engine 不依赖单一 UI Store。

确认多人实时协作是核心需求后，再设计 Yjs Adapter 和冲突规则。

### TD-024：云端后端

**状态：后置**

以下能力不属于本地 MVP：

- 用户和团队系统。
- 云端数据库。
- 项目权限。
- 实时协作服务器。
- 对象存储。
- 设计审批工作流。

### TD-025：桌面应用

**状态：后置**

MVP 采用：

```text
浏览器 Studio + 本地 Node Workspace Server
```

后续根据分发、安全和文件访问需求，再决定 Tauri、Electron 或保持浏览器方案。

### TD-026：插件系统

**状态：后置**

首版必须建立内部 Contribution Registry，为 Panel、Command、Inspector、Route 和 Status Item 提供稳定扩展点，并优先用内置功能验证这些接口。

后置的是公开第三方插件 API、插件市场、远程安装和任意代码权限系统。未来只考虑受权限控制的扩展点：

- 新增规则。
- 新增 Runtime Adapter。
- 新增 Context Provider。
- 新增只读检查器。
- 新增 Studio 面板、命令和 Inspector 区块。

插件不能绕过 Schema、Token、Rule Engine 和组件注册表。

### TD-027：其他框架运行时

**状态：后置**

Vue、Web Components 和其他框架通过独立 Runtime Adapter 支持。它们不能迫使核心 Schema 增加框架专用字段。

### TD-028：MCP 与 AI 操作

**状态：后置**

MVP 不提供 AI 生成设计入口。未来 MCP Server 作为 Workspace Server 应用服务的 Adapter，提供文档读取、Context Package、Command 验证和受审查写入。

MCP 不拥有独立持久化或规则逻辑；写入必须携带 `baseRevision` 并通过与 Studio 相同的 Command Engine 和 Rule Engine。

## 5. MVP 技术组合摘要

```text
工作区             pnpm workspace（根 scripts 编排，无 Turborepo）
语言               TypeScript
Studio             React + Vite
工作台             数据驱动 Workbench Layout + Panel Registry
画布               独立 Canvas Viewport + 统一坐标转换
核心协议           JSON Schema 2020-12
Schema 编写        TypeBox
运行时验证         TypeBox Schema Compiler（ADR-0001）
拖拽               自研 DragController / DropResolver
页面状态           自研 Command/Document Engine
编辑器状态         React Context + 功能级状态（Studio Session）
画布运行时         Studio 内 React Renderer + 直接 DOM
Token 输出         CSS Custom Properties
本地通信           HTTP（WebSocket 待实现）
上下文导出         Schema Context Package
单元/契约测试      Vitest
端到端测试         未建立（已知缺口）
无障碍检查         未建立（已知缺口）
多人协作           MVP 不实现
Web Components     后续可选 Runtime Adapter
```

## 6. 开工前技术验证（已完成）

本节原为开工前的验证清单。Schema 验证器选型、组件注册和规则引擎验证已在 M0～M1 完成；早期 Preview Host 隔离结论已被 [ADR-0005](../adr/0005-studio-canvas-direct-dom-rendering.md) 取代。原始开工基线见 [实施准备基线](../archive/2026-07-22-implementation-readiness.md)。

## 7. ADR 索引

长期决策以 [ADR 索引](../adr/README.md) 为准。本文中标注“已调整”的条目记录 MVP 默认与最终实现之间的差异；后续技术选型变化继续通过新 ADR 记录，不再回填本节。
