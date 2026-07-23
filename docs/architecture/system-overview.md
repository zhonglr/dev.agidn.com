# AI 友好的低代码网页设计器：系统架构

> 产品定位、核心功能与 MVP 验收标准参见 [产品设计](../product/ai-low-code-designer.md)，Studio 工作区与画布参见 [Studio Workbench](./studio-workbench.md)，具体技术选型参见 [技术决策汇总](./technical-decisions.md)。当前进度和实施顺序分别见 [项目状态](../project/status.md) 与 [项目路线图](../project/roadmap.md)。

## 1. 架构目标

本项目采用 TypeScript Monorepo 和前后端分离架构，将独立 PageDocument、可视化编辑器、工作区后端、渲染器与未来 MCP 适配器彻底分开。

架构必须保证：

> Studio、Workspace Server 和未来 MCP 都不能直接修改页面数据；所有变更统一经过 `Command → Rule Engine → Patch → Document Revision`。

核心约束包括：

- PageDocument 是页面组合的唯一事实来源，并且不依赖任何消费者。
- 普通节点的数据结构不能表达任意 CSS 或绝对坐标。
- 人类拖拽与未来 MCP 修改使用同一套 Command 和验证流程。
- 编辑器中的组件来自真实代码组件注册表。
- `document-schema` 不依赖 React、DOM、后端、Registry、AI、MCP 或编辑器 UI。
- 浏览器编辑器不能直接读写用户的项目代码。
- 前端负责交互与乐观预览，后端负责最终验证、事务、版本和持久化。

首选基础技术栈：

- TypeScript
- React
- pnpm workspace
- Vite
- TypeBox 运行时验证（JSON Schema 2020-12，见 [ADR-0001](../adr/0001-typebox-schema-compiler.md)）

具体状态管理、拖拽和 UI 组件库属于实现选择，不应影响核心领域模型。

## 2. 顶层目录

以下清单反映当前仓库；标注“规划 / 后置”的模块尚未创建，只在本文保留目标位置：

```text
agidn-ui-builder/
├── apps/
│   ├── studio/                 可视化编辑器
│   ├── preview-host/           隔离运行真实组件
│   ├── workspace-server/       文档、注册表、验证与工作区后端
│   └── mcp-server/             后续 MCP 适配器（后置，未创建）
│
├── packages/
│   ├── document-schema/        零业务依赖的 PageDocument 协议
│   ├── document-codec/         序列化、版本和迁移
│   ├── design-tokens/          Design Token 模型与解析
│   ├── component-registry/     真实代码组件注册
│   ├── rule-engine/            所有强制规则
│   ├── command-engine/         所有客户端的统一操作协议
│   ├── document-engine/        页面文档、历史和事务
│   ├── react-renderer/         Schema 到 React 的渲染
│   ├── context-exporter/       Schema Context Package 导出
│   ├── api-protocol/           Studio 与后端的通信协议
│   ├── preview-protocol/       Studio 与 Preview 的版本化消息协议
│   ├── studio-workbench/       可复用 Workbench 布局模型和容器
│   ├── layout-engine/          受控布局模型（规划，当前布局规则在 rule-engine）
│   ├── pattern-registry/       页面模式（规划）
│   ├── studio-ui/              编辑器通用 UI（规划，当前门面在 apps/studio）
│   └── mcp-protocol/           后续 MCP 请求与 Command 协议（后置，未创建）
│
├── examples/
│   ├── golden-pricing/         Golden Page、Token、组件定义和非法 Command 示例
│   └── sample-components/      示例真实组件库
│
├── tests/
│   ├── contracts/              Schema、协议与模块边界契约测试
│   ├── integration/            模块集成测试
│   ├── invalid-cases/          非法操作矩阵 fixture
│   ├── visual/                 渲染视觉回归（规划）
│   └── e2e/                    完整拖拽、保存和导出流程（规划）
│
├── docs/                       文档中心，固定入口见 docs/README.md
│
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## 3. 基础领域模块

### 3.1 `packages/document-schema`

这是项目最底层、最重要的模块。它只定义合法 PageDocument 的形状，不负责渲染、持久化、引用解析或操作来源。

```text
packages/document-schema/
├── src/
│   ├── document.ts             页面文档
│   ├── node.ts                 基础节点
│   ├── component-node.ts       代码组件节点
│   ├── layout-node.ts          布局节点
│   ├── responsive.ts           响应式声明
│   ├── interaction.ts          交互行为
│   ├── data-binding.ts         数据绑定
│   ├── accessibility.ts        无障碍语义
│   ├── state.ts                Loading、Error 等状态
│   ├── ids.ts                  强类型 ID
│   ├── schema-version.ts       Schema 版本
│   ├── validation.ts           基础类型验证
│   └── index.ts
├── schemas/                    生成的 JSON Schema
└── tests/
```

页面组件节点示例：

```ts
interface ComponentNode {
  id: NodeId;
  kind: "component";
  role: SemanticRole;
  componentRef: ComponentRef;
  props: RegisteredProps;
  slots: SlotContent;
  responsive?: ResponsivePolicy;
  interactions?: Interaction[];
  accessibility?: AccessibilitySpec;
}
```

本模块必须保持零内部业务依赖，并禁止依赖或包含：

- React 和 DOM。
- 编辑器界面状态。
- 任意 CSS 字符串。
- `x`、`y`、`top`、`left` 等普通节点坐标。
- AI SDK 或具体模型接口。
- 具体代码生成逻辑。
- Component、Token 和 Policy 的具体实现；文档只保存其引用。

### 3.2 `packages/document-codec`

该模块只依赖 `document-schema`，负责序列化、反序列化、协议版本和显式迁移。存储方式、数据库和网络协议不进入该包。

### 3.3 `packages/design-tokens`

```text
packages/design-tokens/src/
├── token.ts
├── token-types.ts
├── token-reference.ts
├── semantic-tokens.ts
├── token-collections.ts
├── token-modes.ts
├── resolver.ts
├── validation.ts
└── index.ts
```

只允许有明确类型和语义的 Token：

```ts
type TokenType =
  | "color"
  | "spacing"
  | "radius"
  | "typography"
  | "shadow"
  | "size";
```

页面保存的是引用：

```text
color.action.primary
spacing.section
radius.card
```

页面不能直接保存 `#635BFF`、`17px` 等原始设计值。

## 4. 真实组件系统

### 4.1 `packages/component-registry`

该模块负责把真实代码组件转换为编辑器和 AI 都能理解的注册信息。

```text
packages/component-registry/src/
├── manifest.ts                 组件注册清单
├── component-definition.ts
├── prop-definition.ts
├── slot-definition.ts
├── variant-definition.ts
├── state-definition.ts
├── component-rules.ts
├── registry.ts
├── loader.ts
├── validator.ts
├── generators/
│   ├── typescript-parser.ts    从 TypeScript 提取 Props
│   ├── manifest-generator.ts
│   └── schema-generator.ts
└── index.ts
```

项目组件在自己的代码旁声明注册文件：

```text
src/components/Button/
├── Button.tsx
├── Button.test.tsx
└── Button.ui.ts
```

注册示例：

```ts
export const buttonDefinition = defineComponent({
  component: Button,
  name: "Button",
  source: "@app/ui/Button",

  props: {
    variant: enumProp(["primary", "secondary", "danger"]),
    size: enumProp(["sm", "md", "lg"]),
    disabled: booleanProp()
  },

  slots: {
    label: textSlot({ required: true }),
    leadingIcon: componentSlot({ accepts: ["Icon"] })
  },

  rules: [
    requireAccessibleName(),
    forbidNestedInteractiveContent()
  ]
});
```

组件注册信息为编辑器和 AI 提供：

- 正确的 import。
- 合法 Props 及默认值。
- 合法 Slots 和子节点类型。
- 组件变体和状态。
- 无障碍要求。
- 使用规则和禁止事项。

### 4.2 `packages/pattern-registry`（规划，未实现）

该模块尚未创建，以下为目标设计。它管理经过验证的高层页面模式，而不是单纯的组件集合。

```text
packages/pattern-registry/src/
├── pattern.ts
├── pattern-slot.ts
├── pattern-variant.ts
├── pattern-rules.ts
├── registry.ts
├── serializer.ts
└── index.ts
```

首批模式可以包括：

- Marketing Hero
- Pricing Section
- Login Form
- Filterable Table
- Empty State
- Checkout Summary

每个模式必须声明用途、必要槽位、可选槽位、响应式规则、状态和内容限制。

## 5. 布局与规则模块

### 5.1 `packages/layout-engine`（规划，未实现）

该模块尚未拆分；当前布局节点定义位于 `document-schema`，布局规则由 `rule-engine` 强制执行。以下为目标设计：

```text
packages/layout-engine/src/
├── primitives/
│   ├── section.ts
│   ├── container.ts
│   ├── stack.ts
│   ├── row.ts
│   ├── grid.ts
│   └── overlay.ts
├── policies/
│   ├── nesting-policy.ts
│   ├── sizing-policy.ts
│   ├── alignment-policy.ts
│   ├── responsive-policy.ts
│   └── overflow-policy.ts
├── anchors/
│   ├── anchor.ts
│   ├── placement.ts
│   └── collision-strategy.ts
├── validation.ts
└── index.ts
```

本模块不提供通用的坐标或定位接口：

```ts
// 不允许存在这样的通用布局字段
interface ForbiddenLayout {
  position: string;
  top: number;
  left: number;
}
```

Overlay 只能通过用途和锚点表达：

```ts
interface OverlaySpec {
  purpose: "badge" | "decoration" | "content-overlay";
  anchor: Anchor;
  boundary: "parent" | "viewport";
  offsetToken: SpacingTokenRef;
}
```

### 5.2 `packages/rule-engine`

所有不可逃逸的限制集中在规则引擎中，不能散落在 React 事件处理代码里。

```text
packages/rule-engine/src/
├── rule.ts
├── rule-context.ts
├── rule-result.ts
├── engine.ts
├── rules/
│   ├── require-section-container.ts
│   ├── forbid-raw-style-values.ts
│   ├── forbid-absolute-position.ts
│   ├── validate-overlay-anchor.ts
│   ├── validate-token-reference.ts
│   ├── validate-component-props.ts
│   ├── validate-slot-content.ts
│   ├── validate-responsive-layout.ts
│   ├── limit-layout-depth.ts
│   └── require-accessibility-name.ts
├── suggestions/
│   ├── token-suggestions.ts
│   ├── layout-suggestions.ts
│   └── component-suggestions.ts
└── index.ts
```

规则结果不仅返回通过或失败，还应提供机器可读的错误和合法替代项：

```ts
interface RuleViolation {
  code: "RAW_SPACING_FORBIDDEN";
  nodeId: NodeId;
  severity: "error";
  message: string;
  suggestions: [
    { tokenRef: "spacing.sm" },
    { tokenRef: "spacing.md" }
  ];
}
```

## 6. 统一操作与文档模块

### 6.1 `packages/command-engine`

Studio 和未来 MCP 等所有客户端必须使用完全相同的 Command。

```text
packages/command-engine/src/
├── command.ts
├── command-result.ts
├── handlers/
│   ├── insert-node.ts
│   ├── move-node.ts
│   ├── remove-node.ts
│   ├── set-prop.ts
│   ├── set-token-reference.ts
│   ├── change-layout.ts
│   ├── set-responsive-policy.ts
│   └── set-semantic-role.ts
├── pipeline/
│   ├── normalize.ts
│   ├── authorize.ts
│   ├── validate.ts
│   ├── apply.ts
│   └── report.ts
└── index.ts
```

本模块不提供 `setCss()`、`setPosition()` 等逃逸命令。

### 6.2 `packages/document-engine`

```text
packages/document-engine/src/
├── document-store.ts
├── transaction.ts
├── patch.ts
├── history.ts
├── undo-redo.ts
├── snapshot.ts
├── migration.ts
├── serialization.ts
└── index.ts
```

文档引擎保存：

```text
当前 PageDocument 快照
+
产生该快照的 Command/Patch 历史
```

该设计用于支持：

- 撤销和重做。
- 客户端变更审查。
- Schema 版本迁移。
- 追踪操作来源和理由。
- 回滚单次事务，而不是回滚整个文件。

## 7. 渲染与编辑器

### 7.1 `packages/react-renderer`

该模块把页面 Schema 渲染为真实 React 组件。

```text
packages/react-renderer/src/
├── renderer.tsx
├── node-renderer.tsx
├── component-renderer.tsx
├── layout-renderer.tsx
├── token-provider.tsx
├── responsive-provider.tsx
├── interaction-runtime.ts
├── registry-adapter.ts
└── index.ts
```

渲染器只读，不能直接修改 PageDocument。

### 7.2 `apps/preview-host`

真实项目组件可能包含复杂依赖，因此应在 iframe 或独立运行环境中隔离渲染。

```text
apps/preview-host/src/
├── bootstrap.tsx
├── preview-app.tsx
├── message-protocol.ts
├── component-loader.ts
├── error-boundary.tsx
└── asset-loader.ts
```

Studio 通过消息协议传入页面 Schema。Preview Host 返回：

- 节点尺寸和边界。
- 渲染错误。
- 点击与选中事件。
- 内容溢出结果。
- 响应式渲染状态。

### 7.3 `apps/studio`

当前实现的主要边界如下（目标演进结构见 [前端开发规范](../contributing/frontend.md)，细节以代码为准）：

```text
apps/studio/src/
├── App.tsx / main.tsx        应用组装与 Provider
├── canvas/                   坐标、手势、Preview 连接和画布 Overlay
├── components/
│   ├── ui/                   唯一通用 UI 门面（见 ADR-0004）
│   └── studio/               Studio 领域组件
├── context-menu/             目标感知的上下文菜单贡献 Registry
├── i18n/                     文案与 locale runtime
├── themes/                   Studio chrome 主题插件
├── studio-session.tsx        文档会话与服务调用
├── structure-drag.ts         结构拖放（DragController / DropResolver）
└── workbench-layout.ts       Workbench 布局接入
```

必须严格区分编辑器状态与页面文档：

```text
Editor State                    Page Document
────────────────────────────    ────────────────────────────
当前选中节点                    页面节点
缩放比例                        组件引用
打开的面板                      Token 引用
拖拽中的临时状态                布局、行为和状态
```

编辑器 UI 状态不能混入页面 Schema。

Studio 不使用写死的左中右页面结构。Workbench Shell 根据版本化布局树渲染嵌套 Split、Tab Group 和 Panel Host，支持面板调整尺寸、移动、停靠、折叠、关闭与持久化恢复。内置面板通过 Panel Registry 注册，默认布局只是可替换配置。

画布使用独立 Canvas Viewport。触控板 pinch、双指平移、指针中心缩放和 Fit 命令只改变 Preview Surface 与 Interaction Overlay，不缩放 Studio Chrome 和其他面板。详细模型和验收标准见 [Studio Workbench 架构](./studio-workbench.md)。

### 7.4 `packages/studio-ui`（规划，未创建）

该包尚未创建；当前通用 UI 门面位于 `apps/studio/src/components/ui/`，契约和迁移门槛见 [Studio UI 系统](./studio-ui-system.md) 与 [ADR-0004](../adr/0004-studio-ui-facade-and-spectrum-to-rac.md)。只有出现第二个真实消费者时才提升为独立 package。它只包含编辑器自身使用的通用界面组件，不包含用户正在设计的业务组件，也不承载页面规则。

## 8. 后端、导出与未来 MCP

### 8.1 `packages/context-exporter`

```text
packages/context-exporter/src/
├── exporter.ts
├── reference-resolver.ts
├── context-selector.ts
├── serializers/
│   ├── document-serializer.ts
│   ├── component-serializer.ts
│   ├── token-serializer.ts
│   ├── policy-serializer.ts
│   └── action-serializer.ts
└── manifest-writer.ts
```

导出结果的文件内容与规则见 [Schema Context Package](../api/context-package.md)。

Exporter 只能读取文档和引用注册表，不能修改 PageDocument。它只导出当前页面实际需要的上下文。

### 8.2 `packages/api-protocol`

定义 Studio、Preview Host 和 Workspace Server 之间带版本的 HTTP、WebSocket 与 `postMessage` 消息。所有请求和响应都必须通过运行时 Schema 验证。

### 8.3 `apps/workspace-server`

Workspace Server 是浏览器编辑器与本地项目之间的后端边界，采用模块化单体而不是早期微服务。

```text
apps/workspace-server/src/
├── server.ts
├── api/
├── application/
│   ├── document-service/
│   ├── catalog-service/
│   ├── validation-service/
│   ├── history-service/
│   └── export-service/
├── infrastructure/
│   ├── filesystem/
│   ├── sqlite/
│   └── preview-process/
└── transport/
    ├── http.ts
    └── websocket.ts
```

Workspace Server 负责：

1. 文档加载、验证、事务、版本和持久化。
2. 组件、Token、Pattern 和 Policy 注册表读取。
3. Preview Host 生命周期管理。
4. Schema Context Package 导出。
5. 项目文件访问和安全边界。

它不能绕过 Command Engine，也不能把存储或网络状态写入 PageDocument。

### 8.4 `apps/mcp-server`（后置）

MCP Server 是 Workspace Server 应用服务的适配器，不拥有独立文档写入逻辑。

```text
apps/mcp-server/src/
├── resources/
│   ├── document-resource.ts
│   ├── component-resource.ts
│   └── token-resource.ts
└── tools/
    ├── get-document.ts
    ├── get-node.ts
    ├── get-document-context.ts
    ├── list-components.ts
    ├── list-tokens.ts
    ├── validate-commands.ts
    └── apply-commands.ts
```

只读工具可以直接返回版本化快照；写入工具必须携带 `baseRevision`、通过相同 Rule Engine，并默认进入用户审查流程。

## 9. 模块依赖关系

```text
                    document-schema
                           ↑
             ┌─────────────┼─────────────┐
             │             │             │
      document-codec  command-engine  document-engine
             ↑             ↑             ↑
             └─────── rule-engine ───────┘
                           ↑
       ┌───────────────────┼───────────────────┐
       │                   │                   │
component-registry   design-tokens      policy/pattern registry
       ↑                   ↑                   ↑
       └────────── workspace application core ┘
                           ↑
       ┌───────────────────┼───────────────────┐
       │                   │                   │
    studio            context-exporter     react-renderer
                           ↑
                    future mcp-server
```

依赖边界必须满足：

- `document-schema` 不依赖任何内部业务包。
- `document-codec` 只依赖 `document-schema`。
- 核心包不依赖 `apps/studio`。
- `rule-engine` 不依赖 React。
- `react-renderer` 不能修改页面文档。
- `context-exporter` 不能修改页面文档。
- `workspace-server` 不能绕过 Command Engine。
- `mcp-server` 只能调用 Workspace Server 的应用服务。
- `component-registry` 不能直接写入任意 CSS。
- `apps/studio` 只负责组合和交互，不作为规则事实来源。

## 10. 核心数据流

### 10.1 人类拖拽

```text
用户拖动 PricingCard
        ↓
Canvas 计算目标 Slot
        ↓
生成 InsertNodeCommand
        ↓
Command Engine 标准化
        ↓
Rule Engine 检查组件、Slot、Token 和布局
        ↓
生成 Document Patch
        ↓
Studio 乐观更新本地投影
        ↓
Workspace Server 使用 baseRevision 再次验证并提交事务
        ↓
返回新 revision，Studio 确认或回滚
        ↓
React Renderer 更新预览
```

### 10.2 未来 MCP 修改

```text
MCP Proposed Commands + baseRevision
        ↓
MCP Protocol 验证格式
        ↓
Command Engine 标准化
        ↓
Rule Engine 检查
        ↓
Workspace Server 生成待审查 Patch
        ↓
用户确认后提交新 Revision
```

MCP 只是后置客户端，只替换操作输入端，之后必须经过与人类操作相同的验证和写入路径。

## 11. 测试结构

### 11.1 契约测试

- PageDocument 能稳定序列化和反序列化。
- JSON Schema 与 TypeScript 类型保持一致。
- 不同版本 Schema 能正确迁移。
- API 和未来 MCP Command 不能包含未知操作或未知字段。

### 11.2 规则测试

- 任意样式值无法写入。
- 普通节点无法绝对定位。
- Overlay 必须包含用途、锚点和边界。
- 未注册组件无法插入。
- 非法 Slot 无法接收节点。
- 响应式规则缺失时阻止写入或给出修复建议。

### 11.3 渲染测试

- 同一 Schema 在不同断点下正确渲染。
- Token 切换不会破坏结构。
- 组件状态能够稳定复现。
- Preview Host 的节点边界与实际 DOM 一致。

### 11.4 Context Package 导出测试

- 输出只包含当前任务必要上下文。
- 所有组件引用都能找到真实 import。
- 所有 Token 引用都能解析。
- `constraints.json` 包含适用的禁止事项。
- `manifest.json` 包含协议版本和内容 Hash。

### 11.5 端到端测试

- Studio 乐观 Command 和 Workspace Server 提交使用相同规则。
- 版本冲突能够被检测并回滚本地投影。
- 从拖拽到文档保存和 Context Package 导出的完整流程可重复执行。
- 未来 MCP Command 不能绕过样式、布局和审查规则。

## 12. 推荐开发顺序

以下为启动期确定的实施顺序，大部分步骤已完成；当前完成度以 [项目状态](../project/status.md) 为准。

1. `document-schema`
2. `document-codec`
3. `design-tokens`
4. `component-registry`
5. `layout-engine`
6. `rule-engine`
7. `command-engine`
8. `document-engine`
9. `workspace-server`
10. `react-renderer` 与 Preview Host
11. 人类优先的最简 Studio
12. `context-exporter`
13. 后续 `mcp-protocol` 与 `mcp-server`

第一阶段不应优先制作复杂或精美的画布，而应先通过 JSON、类型检查和单元测试证明：

- 非法样式无法写入。
- 普通节点无法绝对定位。
- 未注册组件无法插入。
- 非法 Slot 无法接收节点。
- Studio Command 与 Workspace Server 使用同一验证流程。
- PageDocument 能稳定导出完整 Schema Context Package。

## 13. 架构决策总结

本项目的关键不是目录数量，而是约束必须存在于最底层领域模块中。

Studio、Workspace Server、渲染器、导出器和未来 MCP 都围绕独立 PageDocument 协作。任何上层模块都不能通过增加自由 CSS、坐标、临时组件或隐藏状态绕开规则。

最终应形成以下稳定关系：

```text
人类在 Studio 中表达意图
        ↓
PageDocument 独立、精确地记录页面
        ↓
Rule Engine 负责阻止逃逸
        ↓
Workspace Server 负责验证、版本和持久化
        ↓
Context Exporter 生成最小、完整的 Schema 包
        ↓
下游 AI 消费 Schema；未来 MCP 可提交受控 Command
```
