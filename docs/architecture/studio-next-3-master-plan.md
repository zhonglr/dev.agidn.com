# Studio Next 3.0 全面升级总纲

> 状态：Proposed for implementation
> 创建日期：2026-07-24
> 目标版本：`3.0.0`
> 数据策略：硬重置；不读取、不迁移、不兼容任何 `2.x` 项目、Revision、协议或浏览器项目缓存
> 基础决策：[ADR-0005：Studio Next 的三项不可破坏边界](../adr/0005-studio-next-constitutional-boundaries.md)

## 0. 文档职责

本文是 Studio Next 3.0 的产品、领域、编辑器、服务、扩展和实施总纲，回答以下问题：

1. 升级后用户面对的产品是什么。
2. 项目、页面、组件资产、实例和运行状态如何建模。
3. Outline、Canvas、Inspector、Preview、History 和 Problems 如何共享一个编辑上下文。
4. 所有修改如何验证、预览、提交、回滚和解释。
5. 内置功能、插件和未来 AI 如何通过同一受控扩展体系工作。
6. 哪些现有实现必须删除，以及按什么顺序完成破坏性切换。
7. 每一阶段用什么自动化、浏览器矩阵和产品验收证明完成。

本文定义目标，不宣称相关能力已经实现。实施状态仍以[项目状态](../project/status.md)和代码为准。在 S1 正式启动前，V2 活动任务只处理阻断基线运行和数据安全的问题，不再扩展会被 3.0 删除的新功能。

## 1. 总体判断

现有项目已经建立三项应保留的核心资产：

- 严格、独立、可运行时校验的文档 Schema。
- 所有持久化修改经过 `Command → Rule → Patch → Revision`。
- Canvas、Workbench、Preview 与领域模型之间已有明确分层意识。

当前限制并不主要来自功能数量，而来自系统仍以单个 PageDocument 为中心：

- 多页面和部分编辑状态由 Studio 本地模型承担。
- Project Asset 是附加 Registry，不是可独立编辑、事务化和追踪的项目事实。
- `StudioSession` 同时承担查询、选择、页面、命令、拖拽、历史和错误状态。
- Canvas 同时扮演设计表面和运行预览，输入语义容易混淆。
- Inspector 直接消费 Registry 和 Session，没有独立 Property Model。
- Preview Protocol 同时承载渲染、选中、命中、几何和拖放投影，职责持续膨胀。
- 单页 Revision 很难表达页面、组件资产、Token 和 Integration 的跨资产原子修改。

当前代码热点也印证了这一点：`studio-session.tsx` 约 900 行、`panels.tsx` 约 1,600 行、`CanvasViewport.tsx` 约 900 行。行数本身不是缺陷，但三者分别集中多个不同生命周期和变更原因，继续增加功能会放大状态串扰、过期响应和重复业务分支。

3.0 不在这些边界上继续打补丁。目标是把产品从“带项目能力的页面编辑器”升级为：

> 以项目资产图为事实来源、以语义命令为唯一写入方式、同时服务人类和机器客户端的可视化 UI 规格开发环境。

## 2. 基础宪法

### 2.1 三项不可破坏边界

以下规则由 ADR-0005 固化，任何阶段均不得以兼容性、交付速度或插件需求为由绕过：

1. **不引入自由坐标、任意 Transform 和任意样式。**
2. **不允许扩展、插件、AI 或 UI 直接写项目事实。**
3. **不把 Inspector 做成 Schema 字段的机械倾倒。**

### 2.2 十二条系统原则

1. **项目优先于页面**：页面是项目资产，不再隐式代表整个 Workspace。
2. **资产具有稳定身份**：页面、组件、Token、Policy 和 Integration 使用稳定 ID，不以文件路径、数组位置或展示名称充当身份。
3. **定义与实例分离**：组件资产是 Source，页面中的使用是 Instance，差异是显式 Override。
4. **设计与运行分离**：Authoring Mode 修改项目；Preview Mode 只运行临时状态。
5. **选择即上下文**：Tree、Canvas、Inspector、Problems、History 和命令面板共享同一 Selection Model。
6. **直接操作与精确编辑并存**：Canvas 表达空间和结构意图，Inspector 表达准确值，两者生成相同 Command。
7. **非法状态尽量不可表达**：Schema 拒绝未知结构，Capability 隐藏不适用动作，Rule 拒绝上下文非法操作。
8. **一项用户意图对应一个事务**：拖放、批量修改、Pattern 插入和 Apply Override 都产生一条可解释 Revision。
9. **乐观状态不是事实**：本地 Projection 可快速显示、可随时丢弃；服务端事务是唯一提交结果。
10. **扩展贡献能力而不接管内核**：扩展通过 Registry 和 Capability 提供内容，不能分叉数据流。
11. **编辑器状态与项目事实隔离**：布局、选择、展开、可见、锁定、viewport 和草稿不污染项目文档。
12. **删除优于兼容**：旧字段、别名、双写、fallback、迁移器和隐藏兼容路径不进入 3.0。

## 3. 目标用户心智模型

### 3.1 六类一等对象

```text
Workspace Project
├── Page Assets
├── Component Assets
├── Design System Assets
│   ├── Token Collections
│   └── Layout / Responsive Policies
├── Integration Assets
├── Pattern Recipes
└── Project Settings / Routes
```

用户不再把所有对象理解为 Canvas 上的“图层”。不同对象拥有不同生命周期：

| 对象 | 作用 | 是否运行时节点 | 是否可独立 Revision | 是否可实例化 |
| --- | --- | --- | --- | --- |
| Page | 页面组合与路由内容 | 否，拥有根节点 | 是 | 否 |
| Component Asset | 可复用结构与公开接口 | 否，拥有根节点 | 是 | 是 |
| Registered Component | 真实代码组件定义 | 是 | 由代码/Registry 管理 | 是 |
| Layout Node | 结构和布局语义 | 是 | 随所属资产 | 否 |
| Pattern | 一次性结构配方 | 否 | 是 | 插入时展开 |
| Integration | 事件、Operation 和数据流 | 否 | 是 | 被页面/组件引用 |

### 3.2 六个主要编辑 Surface

| Surface | 回答的问题 |
| --- | --- |
| Project Navigator | 项目中有哪些页面、组件、设计系统和 Integration？ |
| Structure | 当前资产由什么组成，父子和 Slot 关系是什么？ |
| Library | 当前上下文允许使用哪些 Layout、组件、资产和 Pattern？ |
| Design Canvas | 当前结构与响应式结果如何，哪里可以合法放置？ |
| Inspector | 当前目标最重要、可修改、继承或出错的属性是什么？ |
| Problems / History | 什么不合法、发生过什么、如何定位和恢复？ |

Workbench 允许重排这些 Surface，但概念职责不可混合。Library 不是 Project Navigator，Structure 不是文件浏览器，Inspector 不是 JSON 编辑器，Preview 不是带编辑 Chrome 的第二块 Canvas。

## 4. 状态分层

系统使用五层状态，禁止用一个全局 Store 混合：

```text
Project Facts
    正式项目、资产、引用、Revision

Authoring Session
    活动资产、打开的 Editor、草稿、乐观事务、Undo 能力

View Session
    Selection、Tree 展开、Editor visibility/pick lock、Viewport、面板布局

Runtime Session
    Preview 中的 hover/open/loading/error/form values/navigation

Interaction State
    pointer、drag、geometry snapshot、drop intent、projection、animation
```

| 状态 | 所有者 | 是否持久化为项目事实 | 是否产生 Revision |
| --- | --- | --- | --- |
| Page/Component 节点 | Workspace Engine | 是 | 是 |
| 资产接口与实例 Override | Workspace Engine | 是 | 是 |
| Selection / Tree 展开 | Editor Kernel | 否 | 否 |
| Editor visibility / pick lock | View Session | 否 | 否 |
| Canvas scale / offset / breakpoint | View Session | 否 | 否 |
| Inspector 未提交草稿 | Authoring Session | 否 | 否 |
| Preview 组件运行状态 | Runtime Host | 否 | 否 |
| Drop Projection | Interaction Engine | 否 | 否 |
| Workbench Layout Profile | User Preference | 否 | 否 |

任何状态在进入实现前必须先归入上表某一层。无法确定所有者的状态不得加入共享 Context。

## 5. 3.0 项目与资产模型

### 5.1 顶层模型

`PageDocument` 不再代表整个项目。3.0 引入项目清单和独立资产文档：

```ts
interface WorkspaceProject {
  schemaVersion: "3.0.0";
  projectId: ProjectId;
  name: string;
  projectRevision: number;
  pages: AssetReference<"page">[];
  components: AssetReference<"component">[];
  designSystems: AssetReference<"design-system">[];
  integrations: AssetReference<"integration">[];
  patterns: AssetReference<"pattern">[];
  routes: RouteDefinition[];
  settings: ProjectSettings;
}

type ProjectAssetDocument =
  | PageAssetDocument
  | ComponentAssetDocument
  | DesignSystemDocument
  | IntegrationDocument
  | PatternDocument;
```

项目清单只保存资产身份、顺序、引用和当前 Head，不复制资产内容。

### 5.2 Revision 模型

每个资产具有独立 `assetRevision`，项目具有单调 `projectRevision`：

```text
Project Revision 42
├── Page home              @ asset revision 18
├── Page pricing           @ asset revision 7
├── Component pricing-card @ asset revision 12
└── Design system main     @ asset revision 5
```

一次事务可以修改一个或多个资产。提交成功时：

1. 所有目标资产先在内存中应用命令。
2. Schema、引用、Capability、Rule 和依赖图全部验证。
3. 所有资产和 Project Head 原子持久化。
4. `projectRevision` 只增加一次。
5. 返回正式 Patch、影响清单、诊断变化和选择建议。

任意子步骤失败，项目保持原状态。

### 5.3 页面资产

```ts
interface PageAssetDocument {
  kind: "page";
  assetId: PageAssetId;
  assetRevision: number;
  name: string;
  routeRef?: RouteId;
  root: LayoutNode;
  metadata?: SemanticMetadata;
}
```

页面只负责页面组合。路由身份、页面文件路径和 Editor Tab 状态不进入节点树。

### 5.4 组件资产

```ts
interface ComponentAssetDocument {
  kind: "component";
  assetId: ComponentAssetId;
  assetRevision: number;
  interfaceVersion: number;
  name: string;
  root: AuthoringNode;
  variables: ComponentVariableDefinition[];
  slots: ComponentSlotDefinition[];
  variants: ComponentVariantDefinition[];
}
```

组件资产公开有限接口。页面实例不能通过内部 Node ID 任意覆盖资产内部结构。

### 5.5 组件实例

```ts
interface ComponentInstanceNode {
  id: NodeId;
  kind: "component-instance";
  source:
    | {
        kind: "registered";
        componentId: RegisteredComponentId;
        definitionVersion: number;
      }
    | {
        kind: "project";
        assetId: ComponentAssetId;
        interfaceVersion: number;
      };
  variant?: VariantId;
  props?: Record<string, RegisteredValue>;
  variableOverrides?: Record<VariableId, RegisteredValue>;
  slotOverrides?: Record<SlotId, AuthoringNode[]>;
  styleBindings?: Record<StyleSlotId, TokenReference>;
  placement?: Placement;
  responsive?: ResponsivePolicyReference;
  accessibility?: AccessibilitySpec;
  interactions?: InteractionBinding[];
}
```

项目组件实例始终解析当前 Project Revision 中对应资产的 Head。可重复导出依赖 Project Revision 快照，而不是在每个实例复制源结构。

### 5.6 Source、Instance 与 Override

Inspector 必须明确显示每个值的来源：

```text
Source default
    ↓
Variant value
    ↓
Instance override
    ↓
Effective value
```

每个可覆盖字段支持：

- 查看 Source。
- 查看 Effective Value。
- 设置实例 Override。
- 单字段 Revert。
- 整实例 Revert。
- 打开 Source 进入组件专注编辑器。
- 在满足接口和影响分析条件时，将 Override Apply 到 Source。

Apply to Source 是跨资产事务，必须展示受影响页面和实例，不得把页面实例内部状态直接写回组件资产。

### 5.7 Pattern

Pattern 是版本化插入配方，不是运行时节点：

- 插入前根据当前 Catalog、Token 和 Policy 实例化。
- 作为一个事务插入普通 Layout、Registered Component 或 Project Component Instance。
- 插入后节点可独立编辑，不继续继承 Pattern。
- Pattern 更新不隐式修改既有页面。
- 需要持续继承的结构必须建模为 Component Asset，不得借 Pattern 模拟 Prefab。

## 6. 统一命令、事务与历史

### 6.1 Command Envelope

所有客户端提交相同的序列化信封：

```ts
interface WorkspaceCommandEnvelope {
  protocolVersion: "3.0.0";
  commandId: CommandId;
  projectId: ProjectId;
  baseProjectRevision: number;
  baseAssetRevisions: Record<AssetId, number>;
  actor: {
    kind: "human" | "plugin" | "mcp" | "system";
    id: string;
  };
  reason?: string;
  commands: WorkspaceCommand[];
}
```

Studio、CLI、Plugin 和未来 MCP 不拥有不同写入协议。

### 6.2 处理管线

```text
Command Schema
  → Target Resolution
  → Capability Check
  → Pure Command Handler
  → Candidate Asset Graph
  → Schema Validation
  → Registry / Reference Validation
  → Rule Engine
  → Dependency / Impact Analysis
  → Atomic Patch Set
  → Persistence Journal
  → Project Revision
```

Patch 是引擎输出，不是公共写入 API。客户端不得自行构造 Patch 请求。

### 6.3 原子事务

以下操作必须是单个事务：

- 一次 Drop 或键盘移动。
- Pattern 插入。
- 多选批量属性修改。
- 创建组件资产并用实例替换选中结构。
- Apply Override to Source。
- 删除资产并更新所有获准引用。
- 重命名公开变量并更新兼容引用。
- Logic Editor 中一次连接创建及其必要参数初始化。

### 6.4 Draft、Projection 与 Commit

```text
User Input
  → Local Draft
  → Local Validity / Simulation
  → Optimistic Projection
  → Server Transaction
      ├── accepted → formal revision replaces projection
      └── rejected → projection removed + field/target diagnostics
```

- 输入框可以保留本地 Draft，失焦、Enter 或 debounce boundary 后提交。
- Slider/drag 连续反馈不产生连续 Revision。
- 服务端拒绝必须恢复正式值，同时保留用户输入和具体原因，允许修正后重试。
- 过期响应必须通过 request ID、projectRevision 和 session epoch 丢弃。

### 6.5 History

History 记录用户意图，不只展示 Patch 数量：

```text
Moved “Primary CTA” into Hero / actions
Changed 6 cards to radius.card
Applied “Featured” override to Pricing Card source
Restored project revision 38
```

每项包含：

- Actor 和来源。
- 人类可读摘要。
- 受影响资产和节点。
- Command 与 Patch。
- Rule/diagnostic 变化。
- 时间、Revision 和可恢复状态。

Undo/Redo/Restore 都创建新的单调 Project Revision。它们不把 Head 指针静默移回旧状态。

## 7. Editor Kernel

### 7.1 拆除巨型 Session

`StudioSessionProvider` 被以下稳定服务替代：

```text
Editor Kernel
├── Workspace Client
├── Active Asset Service
├── Selection Service
├── Property Service
├── Command Gateway
├── History Service
├── Diagnostics Service
├── View Session Service
├── Runtime Session Service
└── Interaction Service
```

React 组件只能订阅所需服务的只读 Snapshot，并通过公开 Action 调用。Panel 不直接拼装 HTTP 请求、生成随机命令或导入纯领域 reducer。

### 7.2 Selection Model

```ts
type SelectionTarget =
  | { kind: "project"; projectId: ProjectId }
  | { kind: "asset"; assetId: AssetId }
  | { kind: "node"; assetId: AssetId; nodeId: NodeId }
  | { kind: "slot"; assetId: AssetId; nodeId: NodeId; slotId: SlotId }
  | { kind: "property"; target: PropertyOwner; path: PropertyPath }
  | { kind: "diagnostic"; diagnosticId: DiagnosticId };

interface SelectionSnapshot {
  primary?: SelectionTarget;
  items: SelectionTarget[];
  anchor?: SelectionTarget;
  origin: "canvas" | "structure" | "inspector" | "problems" | "history" | "command";
  epoch: number;
}
```

规则：

- Tree、Canvas、Inspector 和 Problems 使用同一个稳定目标。
- 切换资产时旧选择失效，不允许写入新资产。
- 多选只允许兼容目标集合；Inspector 显示属性交集和 mixed value。
- Selection 属于 View Session，不创建 Revision。
- 选择视口外节点时执行 Reveal；用户主动平移或缩放可立即接管。

### 7.3 Action Model

所有入口解析同一个 Action Registry：

```text
Toolbar
Context Menu
Command Palette
Keyboard Shortcut
Tree Row Action
Inspector Action
```

Action 定义包含稳定 ID、标题、适用上下文、Capability、快捷键、执行函数、危险级别和焦点返回策略。不得在每个 Surface 分别实现 Delete、Duplicate、Focus、Open Source 或 Revert。

## 8. Property Model 与 Inspector

### 8.1 独立 Property Descriptor

```ts
interface PropertyDescriptor {
  id: PropertyId;
  appliesTo: TargetPredicate;
  path: PropertyPath;
  group: PropertyGroupId;
  label: LocalizedText;
  description?: LocalizedText;
  editor: PropertyEditorDefinition;
  valueSource: "source" | "variant" | "override" | "computed";
  capability: CapabilityRequirement;
  validation: PropertyValidation[];
  createCommand: PropertyCommandFactory;
  order: number;
  advanced?: boolean;
}
```

Property Descriptor 可以来自：

- 公共 Node 属性。
- Layout Contract。
- Registered Component Definition。
- Project Component Interface。
- Token / Policy Registry。
- Integration Registry。
- 受信插件贡献。

Schema 不直接生成 Inspector。

### 8.2 字段状态

每个字段必须区分：

```text
editable
read-only
not-applicable
unsupported
pending
invalid
inherited
overridden
mixed
conflicted
```

字段 UI 必须显示值来源、禁用原因、Rule 错误、影响范围和 Revert/Apply 能力。

### 8.3 信息层级

默认 Inspector 顺序：

1. Identity / Selection Summary。
2. Content。
3. Layout / Placement。
4. Appearance / Variant / Token。
5. Responsive。
6. Interaction。
7. Accessibility。
8. Advanced / IDs / Versions / Diagnostics。

不适用区段不显示；空区段不显示；搜索可以跨折叠区段定位字段。

### 8.4 多选

多选 Inspector：

- 只显示共同适用属性。
- 不同值显示 Mixed，而不是选择其中一个值冒充当前状态。
- 修改共同属性产生一个跨节点事务。
- 不允许批量修改的字段明确说明原因。
- 选中 Source 和 Instance 等不同生命周期对象时，不提供虚假的共同编辑能力。

### 8.5 Inspector Pin

用户可以锁定一个 Inspector 到特定目标，用另一个 Inspector 跟随 Selection。Pin 属于 Workbench Session，不影响项目事实。

## 9. Design Canvas 与 Runtime Preview

### 9.1 两种明确模式

```text
Authoring Mode
  选择、结构拖放、Slot、空容器、辅助线、诊断和属性编辑

Preview Mode
  真实 hover、press、form、navigation、loading/error 和 Integration 行为
```

模式切换必须改变：

- 顶部模式标识和 Canvas Chrome。
- 输入路由。
- Preview Protocol Capability。
- Inspector 可编辑性。
- Runtime Session 生命周期。

Preview Mode 不产生项目 Command；退出时 Runtime Session 默认重置。

### 9.2 共用 Renderer，分离 Host Capability

```text
Deterministic Render Core
├── Authoring Host Adapter
│   ├── geometry
│   ├── hit test
│   ├── slot zones
│   └── selection metadata
└── Runtime Host Adapter
    ├── interaction runtime
    ├── state simulation
    ├── navigation
    └── runtime diagnostics
```

两种模式复用同一组件 Runtime 和 Project Snapshot，不维护两套视觉实现。

### 9.3 版本化 Preview Session

每次连接具有：

- `sessionId`
- `sessionEpoch`
- `projectRevision`
- `assetId`
- `assetRevision`
- `mode`
- `breakpoint`
- `capabilities`

任何来自旧 Epoch、旧 Revision、旧资产或错误模式的消息一律丢弃。

### 9.4 响应式设计

Canvas 支持：

- Desktop / Tablet / Mobile。
- 单视口编辑。
- 最多三个视口并排比较。
- 当前属性来自 base 还是 breakpoint override 的可视提示。
- 内容溢出、断点缺失和布局不稳定诊断。

并排视口共享 Selection，但各自拥有独立 Geometry Snapshot。修改仍是一个项目事务。

## 10. 结构树与编辑器辅助状态

### 10.1 Structure 不是扁平 Layers

Structure 必须展示：

- Layout 的真实父子关系。
- Component Instance 边界。
- Project Component 的公开 Slot。
- Source / Instance / Override 标记。
- Diagnostic、隐藏、锁定和运行态提示。
- 搜索命中的祖先路径。

组件内部未公开结构在页面编辑器中不可直接展开修改；通过 Open Source 进入组件专注编辑器。

### 10.2 Editor Visibility 与 Pick Lock

每个节点可以具有两项 View Session 状态：

- Editor Visibility：只在 Authoring Canvas 暂时隐藏。
- Pick Lock：保持显示，但 Canvas 命中时跳过该节点。

它们：

- 不写入项目。
- 不影响 Runtime Preview。
- 不与正式 `visibility` / responsive visibility 共用图标或字段。
- 可以按资产保存为个人 Workspace Session。

### 10.3 Component Focus Editor

组件资产使用与页面相同的 Editor Kernel、Structure、Canvas、Inspector 和 Drag Controller，只切换 Active Asset 和允许的 Property/Action。

Header 显示：

```text
Back / Breadcrumb | Component identity | Interface version | Save/Validation state
```

支持：

- 隔离背景。
- 可选 Context Preview。
- 变量、Slot、Variant 接口编辑。
- 依赖与实例影响分析。
- 循环引用防护。
- 破坏性接口修改 Gate。

禁止复制一套 `ComponentCanvas`、`ComponentTree` 或专用 Command Engine。

## 11. Interaction Engine 与语义拖放

### 11.1 单一流水线

```text
Pointer / Touch / Pen / Keyboard Sensor
  → Drag Session
  → Epoch Geometry Snapshot
  → Semantic Target Resolver
  → Capability + Slot Policy
  → Drop Intent
  → Local Placeholder / Projection
  → Workspace Command
  → Formal Revision
```

### 11.2 必须删除的旧语义

- HTML5 Drag and Drop 不是 3.0 热路径。
- DataTransfer MIME 不能作为 Studio 内部状态总线。
- 不通过发送整个 Ghost Document 来预览 Drop。
- 不允许 Canvas 和 Structure 分别实现 Drop Policy。
- `dragend` 不得自行终止正在提交的 Projection。

### 11.3 Semantic Magnetism

拖动期间系统只表达领域意图：

```text
before node
after node
inside layout
into named slot
replace single-value slot
```

不表达自由坐标。非法目标：

- 不显示为普通可放置区域。
- 必要时显示具体原因，如 Slot 类型、容量、布局深度或循环引用。
- 可以提供合法修复建议，但修复也必须成为显式事务。

### 11.4 空容器与 Slot

Authoring Host 必须提供独立 Slot Zone，不依赖空 DOM 元素偶然产生的尺寸。Zone 包含：

- 稳定 target ID。
- 接受类型。
- min/max item。
- 当前容量。
- 几何区域。
- 优先级和嵌套深度。

### 11.5 动画

- Projection 在正式 Revision 到达前保持。
- 正式 Revision 接管后只允许一次 FLIP 交接。
- reduced motion 下取消空间动画，但不取消结构反馈。
- 迟到解析、过期 Preview 消息和旧 Geometry Snapshot 不得覆盖当前目标。

## 12. Diagnostics 与 Problems

### 12.1 统一 Diagnostic

```ts
interface Diagnostic {
  id: DiagnosticId;
  source: "schema" | "registry" | "rule" | "runtime" | "integration" | "plugin";
  severity: "error" | "warning" | "info";
  code: string;
  message: LocalizedMessage;
  target: SelectionTarget;
  propertyPath?: PropertyPath;
  assetRevision: number;
  fixes?: DiagnosticFix[];
}
```

### 12.2 诊断闭环

Problems 中选择 Diagnostic 后：

1. 激活目标资产。
2. 展开 Structure 祖先。
3. 选择节点或属性。
4. Reveal 到安全视口。
5. 展开 Inspector 对应区段。
6. 显示可用 Fix。

Fix 是 Command Factory，不是直接 Patch。

### 12.3 运行时诊断

Runtime Preview 的异常、未解析 Action、组件崩溃和数据绑定错误使用相同 Diagnostic 外形，但明确标记 Runtime Session，不冒充正式项目 Rule 错误。

## 13. Workbench 与人机体验

### 13.1 默认任务布局

提供少量受支持预设：

- Page Design。
- Component Authoring。
- Responsive Review。
- Logic / Integration。
- Debug / Problems。

默认 Page Design：

```text
Activity Bar | Structure | Library | Design Canvas | Inspector | Activity Bar
```

Project Navigator 通过 Activity Bar 打开，可替换左侧任务区域；不再长期堆叠所有低频资产管理面板。

### 13.2 布局层级

```text
Built-in Task Layout
  → User Layout Profile
      → Workspace Session Overrides
```

Layout 具有独立版本和 migration，但它只迁移编辑器偏好，不迁移项目数据。未知 Panel 或 Plugin 缺失时恢复为合法布局。

### 13.3 一致输入语法

- 单击：选择。
- 双击 / Enter：打开 Source 或进入专注编辑。
- `F`：Frame Selection。
- Space + drag / middle pointer：平移。
- Wheel / pinch：缩放。
- `Alt+Arrow`：结构内移动。
- Context Menu / `Shift+F10`：同一 Action Menu。
- `Cmd/Ctrl+K`：Command Palette。
- Escape：取消当前 Interaction、Draft 或 Overlay，按层级逐级退出。

快捷键在文本输入、Menu、Dialog 和 Runtime Preview 获得焦点时正确暂停。

### 13.4 反馈语言

每项操作具有稳定阶段：

```text
idle → draft/dragging → validating → committing → saved
                                      └→ rejected/recoverable
```

保存、冲突、长任务和 Validation 使用稳定状态区域，不只依赖 Toast。看起来可操作的控件必须有动作；无动作的说明文本不使用按钮视觉。

### 13.5 可访问性

- Tree、Grid、Tab、Menu、Dialog、Toolbar 使用正确语义。
- Pointer 操作提供键盘等价路径。
- Drag 使用可访问目标选择和状态播报。
- 焦点在 Panel 移动、Dialog、Context Menu 和资产切换后可预测恢复。
- reduced motion、高对比度和 200% UI 缩放进入正式验收矩阵。

## 14. 扩展体系

### 14.1 三类扩展

| 类型 | 内容 | 安全边界 |
| --- | --- | --- |
| Project Data Extension | Component Asset、Pattern、Token、Policy | 纯数据，严格 Schema |
| Trusted Build-time Plugin | Panel、Action、Property、Diagnostic、Renderer Adapter | 编译时安装，受公开 API 和模块边界约束 |
| External Client | CLI、MCP、自动化 | 只通过版本化 API 和 Command |

3.0 不执行项目内任意脚本，也不承诺加载不受信第三方编辑器代码。

### 14.2 Contribution Registries

受支持的贡献点：

- `PanelContribution`
- `ActionContribution`
- `PropertyContribution`
- `PropertyEditorContribution`
- `DiagnosticContribution`
- `CatalogContribution`
- `RendererContribution`
- `StatusContribution`
- `RouteContribution`

每项贡献声明：

- 稳定 ID 和版本。
- 所需 Capability。
- 适用 Target Predicate。
- 生命周期与卸载。
- 是否影响项目事实。
- 对应 Command Factory。

### 14.3 Capability

扩展拿到的是窄接口：

```text
read project snapshot
read selection
resolve property descriptors
request action
submit command transaction
publish ephemeral diagnostic
open panel/dialog/route
```

扩展拿不到：

- 可变项目对象。
- Revision Store 写句柄。
- Workspace 文件系统路径。
- Canvas DOM 或 Preview 内部 DOM 的任意写权限。
- 绕过 Rule Engine 的 Patch API。

### 14.4 AI / MCP

未来 AI 作为 External Client：

1. 读取裁剪后的项目、Catalog、Property 和 Diagnostic 上下文。
2. 提交 Proposed Command Transaction。
3. 服务端执行 Simulation 和 Impact Analysis。
4. Studio 展示语义 Diff、原因、影响资产和规则结果。
5. 人确认后提交正式事务。

AI 不获得“编辑 JSON”或“修改文件”特权。

## 15. 目标包与依赖边界

### 15.1 目标包结构

```text
packages/
├── project-schema/          3.0 Project、Asset、Node、Reference；零内部依赖
├── project-codec/           精确 3.0 解析与稳定序列化；无旧版本迁移
├── component-registry/      Registered Component 与 Editor Contract
├── design-system/           Token、Policy、Mode 与解析
├── asset-graph/             引用图、循环、影响和 Source/Instance 解析
├── rule-engine/             跨资产与节点规则
├── layout-engine/           Tree、Slot、Geometry、Target 与 Projection
├── command-engine/          Command Schema、纯 Handler、Patch Set
├── workspace-engine/        跨资产 Transaction、Revision、Undo/Redo
├── property-model/          Property Descriptor、状态和 Command Factory
├── editor-kernel/           Selection、Action、Session 与 Command Gateway
├── render-core/             确定性项目快照渲染
├── editor-protocol/         Studio ↔ Authoring/Runtime Host
├── api-protocol/            Studio/CLI/MCP ↔ Workspace Server
├── context-exporter/        Project Revision 快照导出
├── studio-ui/               编辑器 UI 门面
└── studio-workbench/        Layout、Panel Host 与布局偏好
```

包名可以在 S0 末根据实现验证微调，但职责和依赖方向不可回退。

### 15.2 依赖方向

```text
project-schema
    ↓
registry / design-system / asset-graph
    ↓
rule / layout / command / property
    ↓
workspace-engine / render-core
    ↓
protocols / editor-kernel / application services
    ↓
Studio / Preview Hosts / Workspace Server / CLI / MCP
```

强制规则：

- `project-schema` 不依赖任何内部包、React、DOM、Node 或网络。
- `command-engine` 不依赖持久化、HTTP、React 或具体 UI。
- `property-model` 不依赖 React 控件；UI 通过 Editor Definition 映射。
- `editor-kernel` 不拥有正式项目写权限，只依赖 Command Gateway。
- `render-core` 不依赖 Studio、Selection 或 Workbench。
- Transport 只依赖 Application Port，不直接依赖 Engine 或文件系统。
- App 之间不互相 import。

### 15.3 Workspace Server

继续采用模块化单体，但应用服务升级为项目级：

```text
transport/
application/
  project-service
  asset-service
  transaction-service
  history-service
  diagnostics-service
  export-service
domain/
  composition root only
infrastructure/
  project repository
  revision journal
  filesystem adapters
  websocket publisher
```

### 15.4 当前 package / app 处置矩阵

`Keep` 表示职责稳定且只需适配；`Rewrite` 表示保留产品概念但重写公开契约；`Replace` 表示新包通过门禁后删除旧包；`Delete` 表示目标系统不再需要。

| 当前目标 | 处置 | 3.0 目标 |
| --- | --- | --- |
| `document-schema` | Replace | `project-schema`；项目和全部资产的精确 3.0 契约 |
| `document-codec` | Replace | `project-codec`；不含旧版本迁移 |
| `document-engine` | Replace | `workspace-engine`；跨资产事务和 Project Revision |
| `project-assets` | Replace | `asset-graph` + 正式 Asset Documents |
| `command-engine` | Rewrite | Workspace Command、跨资产 Patch Set、纯 Handler |
| `rule-engine` | Rewrite | 节点规则升级为项目、引用、接口和实例规则 |
| `component-registry` | Rewrite | 保留 Definition 思想，加入 Property/Runtime/Capability Contract |
| `design-tokens` | Replace | `design-system`；Token、Mode、Policy 一体化 |
| `layout-engine` | Rewrite | 保留 Tree/Drop Policy 算法，加入 Geometry/Projection/Sensor 契约 |
| `react-renderer` | Replace | `render-core`；解析 Project Snapshot 和 Project Component Instance |
| `preview-protocol` | Replace | `editor-protocol`；Authoring/Runtime Capability 分离 |
| `api-protocol` | Rewrite | v3 Project/Asset/Transaction/WebSocket |
| `context-exporter` | Rewrite | 指定 Project Revision 的资产图裁剪与稳定导出 |
| `studio-workbench` | Keep | 增加 Task Layout、Profile、migration 和缺失贡献恢复 |
| `apps/studio` | Rewrite | Workbench 外壳保留，业务状态迁入 Editor Kernel |
| `apps/preview-host` | Rewrite | 共用 Render Core 的 Authoring/Runtime Host Adapter |
| `apps/workspace-server` | Rewrite | 项目级 application services、repository 和 journal |
| 现有 CLI | Rewrite | 只接受 3.0 Project 和 v3 Transaction |
| V2 reset / compatibility verification | Delete | S9 用 3.0 legacy-absence gate 取代 |

处置规则：

- Rewrite/Replace 不允许通过兼容 Adapter 把 2.0 形状带入 3.0 包。
- 可复用算法必须先提取成不依赖旧协议的纯函数，再进入新包。
- Replace 目标只有在新包通过对应阶段退出门禁后删除；主干运行时始终只有一条 Active Path。
- Keep 只表示产品职责保留，不代表无需补充 3.0 边界测试。

## 16. 3.0 API 与协议

### 16.1 HTTP

```text
GET  /v3/project
GET  /v3/assets
GET  /v3/assets/:assetId
GET  /v3/catalog
GET  /v3/history
GET  /v3/diagnostics
POST /v3/transactions/simulate
POST /v3/transactions
POST /v3/history/undo
POST /v3/history/redo
POST /v3/history/restore
POST /v3/export
```

不保留 `/v1`、`/v2` alias 或内容协商 fallback。

### 16.2 WebSocket

```text
project.headChanged
asset.changed
diagnostics.changed
transaction.progress
runtime.status
catalog.changed
server.resyncRequired
```

所有消息带：

- Protocol Version。
- Project ID。
- Project Revision。
- Message ID。
- Causation/Correlation ID。
- 必要时 Asset ID 和 Asset Revision。

断线恢复先比较 Project Revision；无法补齐增量时明确要求重新获取 Snapshot，不猜测本地状态。

### 16.3 Authoring / Runtime Host Protocol

协议按 Capability 分组：

```text
session.*
document.*
selection.*
geometry.*
drag.*
runtime.*
diagnostic.*
```

Authoring Host 不接受 runtime action 命令，Runtime Host 不接受 selection mutation 或 drop projection 命令。

## 17. 持久化与恢复

### 17.1 项目目录

目标逻辑结构：

```text
project.ui.json
assets/
  pages/
  components/
  design-systems/
  integrations/
  patterns/
.agidn/
  revisions/
  journal/
  cache/
```

具体文件拆分由 Repository Adapter 决定，不能泄漏到领域 ID 或客户端协议。

### 17.2 原子性

跨资产事务使用 write-ahead journal：

1. 写入候选资产临时文件。
2. fsync 必要内容。
3. 写入事务 journal。
4. 原子替换资产和 Project Head。
5. 标记 journal committed。
6. 清理临时文件。

启动时只接受完整 committed transaction；不完整事务回滚或隔离并产生明确恢复诊断。

### 17.3 硬重置

3.0 首次启动：

- 只接受 `3.0.0` Project。
- 发现旧单页输入、旧 Revision Store 或旧浏览器项目键时显示“版本不受支持”，不迁移。
- 开发 Fixture 和测试数据从零生成。
- 提供目标明确的 reset 工具删除已知旧路径，不使用宽泛目录删除。
- 用户 UI 偏好可以独立评估是否保留；任何包含项目事实或资产内容的浏览器键全部删除。

## 18. 可观测性与性能预算

### 18.1 Correlation

一次用户操作贯穿：

```text
actionId
  → commandId
  → transactionId
  → preview requestId
  → projectRevision
```

开发诊断可以按这一链路查看耗时和失败位置，不依赖散落的 `console.log`。

### 18.2 初始规模基线

正式性能测试至少覆盖：

- 20 个 Page Asset。
- 100 个 Component Asset。
- 单资产 2,000 个节点。
- 10,000 条跨资产引用。
- 三个并排响应式视口。

### 18.3 交互预算

在基线开发机与 Chrome 稳定版上：

- 选择到 Canvas/Tree/Inspector 反馈：P95 小于 50ms。
- 拖动本地 Projection：保持 60fps，P95 单帧小于 16.7ms。
- 本地 Command Simulation：P95 小于 50ms。
- 本机 Workspace 正式事务确认：P95 小于 250ms。
- 2,000 节点 Tree 搜索和展开：P95 小于 100ms。

未达到预算时先测量和定位，不用降低 Schema 严格性或绕过事务作为优化手段。

## 19. 测试与验收体系

### 19.1 测试金字塔

1. Schema contract：合法/非法项目、资产、节点和协议。
2. Pure engine：Command、Rule、Asset Graph、Property、Layout。
3. Transaction integration：跨资产原子性、冲突、Undo/Redo、恢复。
4. Protocol contract：HTTP、WebSocket、Authoring/Runtime Host。
5. Component contract：Definition、Runtime、Property 和 Slot 一致性。
6. Browser E2E：真实 Pointer、Keyboard、iframe、缩放和响应式。
7. Visual regression：Selection、Slot、Override、Diagnostic 和主题状态。
8. Accessibility：axe、键盘路径、焦点恢复、屏幕阅读器语义。
9. Fault injection：服务离线、过期响应、写盘中断、Preview 崩溃。
10. Performance：规模 Fixture、帧预算和内存泄漏。

### 19.2 必须证明的核心不变量

- 旧 `2.x` 数据和协议全部拒绝。
- 普通节点无法表达任意 CSS、坐标或 Transform。
- UI、插件和 MCP 没有 Patch/Store 直写路径。
- 一项用户意图最多产生一次 Project Revision。
- 失败事务不留下半个资产更新。
- Source 更新在同一 Project Revision 中确定性影响实例。
- Preview Runtime State 不进入项目。
- Selection/View/Drag 状态不产生 Revision。
- Property Descriptor 与 Command/Rule 能力一致。
- 多选 Mixed Value 不被错误覆盖。
- 迟到消息不能覆盖当前资产、模式、Revision 或 Drag Epoch。
- 所有可见编辑动作都能通过键盘完成或有明确等价路径。

### 19.3 正式 UAT 场景

3.0 产品验收至少完成：

1. 从空项目创建 Home、Pricing 和 Checkout 三个页面。
2. 创建 Pricing Card 组件资产，定义变量、Slot 和 Variant。
3. 在两个页面实例化，设置不同 Override。
4. 修改 Source，观察实例继承；Revert 一个 Override。
5. Apply 一个 Override 到 Source，确认影响分析和单事务。
6. 在 50%～200% 和三断点下完成 Pointer/Keyboard 拖放。
7. 切换 Preview，验证运行交互不修改项目；退出后状态清除。
8. Problems 定位到具体资产、节点和 Inspector 字段并执行 Fix。
9. 多选组件批量修改 Token，Undo/Redo 后保持一致。
10. 服务重启、断线重连、历史恢复和指定 Revision 导出。
11. 安装一个受信测试插件，贡献 Property/Action/Panel，但无法直写项目。
12. MCP 模拟 Proposed Transaction，审查后提交或拒绝。

## 20. 破坏性删除清单

删除发生在对应替代能力通过退出门禁后；3.0 不允许以下路径继续共存：

| 当前目标 | 3.0 处理 |
| --- | --- |
| 单页 `PageDocument` 作为 Workspace 根 | 替换为 Project + Asset Documents |
| `document-schema` 2.0 | 删除，替换为精确 3.0 `project-schema` |
| 带迁移职责的 `document-codec` | 删除，3.0 codec 不含旧版本迁移 |
| 单页 `document-engine` / Revision Store | 替换为跨资产 `workspace-engine` |
| `/v1` API 和对应协议 | 删除，不保留 alias |
| Preview Protocol 2.0 | 删除，按 Authoring/Runtime Capability 重建 |
| `StudioSessionProvider` 巨型 Context | 删除，替换为 Editor Kernel 服务 |
| Studio 本地多页面项目模型 | 删除，页面进入正式 Project |
| `agidn.studio.v2.pages` 等项目缓存 | 删除，不读取 |
| 当前附加式 `project-assets` 写法 | 重建为正式 Asset Graph 与 Asset Documents |
| 点击插入 Pattern | 删除，统一进入 Drag/Command/Transaction |
| HTML5 DnD / DataTransfer MIME 热路径 | 删除，替换为 Pointer/Keyboard Sensor |
| 整文档 Drop Ghost | 删除，替换为局部 Placeholder/Projection |
| Canvas/Outline 两套目标解析 | 删除，统一 Interaction/Layout Engine |
| Inspector 中针对节点种类的业务分支 | 删除，统一 Property Descriptor |
| UI 组件自行 import 领域 reducer | 删除，只调用 Command Gateway |
| 运行状态写入正式文档的任何字段 | 删除，移入 Runtime Session |
| 旧 Fixture、导出包、Revision、浏览器资产 | 删除，从零建立 3.0 Foundation Project |
| 旧文档中的活跃设计说明 | 实施完成后归档，不保留并列事实来源 |

## 21. 分阶段实施

### S0：锁定宪法与新基线

交付：

- 接受 ADR-0005。
- 审核本文并冻结 3.0 核心名词。
- 建立 Architecture Decision Map、删除 Manifest 和依赖边界测试。
- 除 P0 数据安全外，停止扩展 2.0 功能。

退出条件：

- 三项宪法有自动化静态边界或契约测试方案。
- 每个现有包明确标记 Keep、Rewrite、Replace 或 Delete。
- 后续阶段无待定的项目/资产/实例基本语义。

### S1：从零建立 3.0 Project Schema

交付：

- `project-schema`、`project-codec`。
- Project、Page、Component、Design System、Pattern 最小 Schema。
- Source/Instance/Override 和稳定 ID。
- 全新 Foundation Project Fixture。
- 2.0 精确拒绝测试。

删除：

- 2.0 Fixture、Schema、Codec fallback、旧浏览器项目数据读取。

退出条件：

- 新 Foundation Project 可稳定序列化并完成全引用验证。
- 普通节点无法表达三项宪法禁止内容。

### S2：Workspace Engine、持久化与 v3 API

交付：

- 跨资产事务和 Project Revision。
- Asset Revision、引用图、影响分析。
- Journal、重启恢复、Undo/Redo/Restore。
- `/v3` API 和 WebSocket Head 同步。

删除：

- 单页 Revision Store、旧 application service、`/v1` 协议。

退出条件：

- 跨两个资产的成功和失败事务均证明原子性。
- 写盘中断和服务重启不会产生半提交状态。

### S3：Editor Kernel、Selection、Action 与 Property

交付：

- Workspace Client、Active Asset、Selection、Action、Property、Command Gateway。
- Registry-driven Inspector。
- Diagnostic 定位闭环。
- 多选基础和 Mixed Value。

删除：

- `StudioSessionProvider`。
- Panel 内 HTTP/Command 拼装。
- Inspector 节点类型业务分支和伪控件。

退出条件：

- Canvas、Structure、Inspector、Problems 共享一个 Selection Target。
- 所有属性修改通过 Property Command Factory 和 Command Gateway。

### S4：Authoring / Preview 模式与协议重建

交付：

- Deterministic Render Core。
- Authoring Host 和 Runtime Host Capability。
- Preview Runtime Session。
- Epoch/Revision/Asset 隔离。
- 单视口和三视口响应式比较。

删除：

- 混合职责的 Preview 2.0 消息。
- Preview 中任何隐式项目修改。

退出条件：

- Preview 完整运行交互且退出后项目和运行状态边界清晰。
- 旧模式、旧资产或旧 Revision 消息无法污染当前会话。

### S5：Component Asset 与 Override 闭环

交付：

- Component Focus Editor。
- 变量、Slot、Variant 接口。
- Source/Instance/Override、Revert、Apply、影响分析。
- 嵌套组件与循环诊断。
- Project Component Runtime。

删除：

- 附加 Registry 式 Composite 原型。
- 本地自定义组件、Saved Component 和重复专注 Workbench。

退出条件：

- Source 修改、实例继承、Override 和跨资产 Undo/Redo 全部可重复。
- 刷新、重启、历史恢复和导出不丢失组件资产。

### S6：Interaction Engine 与 Canvas 重建

交付：

- Pointer/Touch/Pen/Keyboard Sensor。
- Geometry Snapshot、Slot Zone、Semantic Target。
- 局部 Placeholder/Projection、自动滚动和一次 FLIP。
- Structure 与 Canvas 共用 Drag Controller。

删除：

- HTML5 DnD、DataTransfer MIME、整文档 Ghost、双目标解析。

退出条件：

- 50%～200%、三断点、跨 Slot、跨父级、快速连续拖动全部稳定。
- Drag 不创建 Revision，Drop 恰好创建一个 Revision。

### S7：Workbench 与专业体验

交付：

- Task Layout、Layout Profile 和 migration。
- Editor visibility、pick lock、Inspector Pin。
- 可读 History、稳定状态区、完整快捷键和焦点恢复。
- Light/Dark/High Contrast、reduced motion。

删除：

- 无职责边界的常驻低频 Panel。
- 重复 Context Menu/Toolbar/shortcut 动作实现。

退出条件：

- Page Design、Component Authoring、Responsive Review 三种任务布局通过浏览器 UAT。
- Pointer 与 Keyboard 主流程能力等价。

### S8：扩展与外部客户端

交付：

- Contribution Registries 和 Capability API。
- 插件边界测试和测试插件。
- Proposed Transaction Simulation / Review。
- MCP 只读上下文和受控 Proposed Command。

删除：

- 任何扩展直写 Store、Patch、DOM 或项目文件的路径。

退出条件：

- 测试插件可扩展 UI/Property/Diagnostic，但无法突破三项宪法。
- MCP 提议可审查、可拒绝、可提交、可撤销。

### S9：硬化、删除完成与 3.0 验收

交付：

- 全仓 E2E、Visual、Accessibility、Fault、Performance 门禁。
- 指定浏览器和基线 Commit 的正式 UAT。
- 3.0 文档、API、示例和 Context Package。
- 旧文档归档和最终删除审计。

退出条件：

- 第 19 节全部核心不变量和 UAT 场景通过。
- 第 20 节所有旧运行路径删除。
- 仓库中不存在 2.x 项目读取、协议 alias、双写或迁移代码。

## 22. 调度规则

1. 按 S0 → S9 执行；基础 Schema、Engine、Kernel 未稳定前不以视觉功能插队。
2. 每阶段建立独立 Cycle，包含基线 Commit、退出条件、测试和 UAT。
3. 允许在实现层并行准备，但同一事实来源不得存在两个 Active Owner。
4. 替代能力未通过门禁前可以保留旧代码维持仓库可运行；门禁通过的同一 Cycle 必须删除旧路径。
5. 不建立 V2 → V3 migration、adapter、alias、dual read、dual write 或 hidden fallback。
6. 任何“暂时直接写 Store/JSON/Patch”的实现都不得合入主干。
7. 新需求先判断属于 Project Fact、Authoring、View、Runtime 还是 Interaction State。
8. 新组件必须同时交付 Definition、Runtime、Property、Slot、Rule、Preset 和测试。
9. 新扩展点必须先证明无法绕过 ADR-0005。
10. 每阶段结束运行 typecheck、unit、contract、integration、build、lint、docs check；涉及 UI 时增加真实浏览器矩阵。

## 23. 成功标准

升级成功不以“面板更多”判断，而以以下结果判断：

- 用户可以理解 Project、Source、Instance、Override、Design 和 Preview 的区别。
- 多页面、多组件资产和设计系统在同一个项目事务与 Revision 体系内工作。
- 直接拖动、Inspector 精确编辑、批量修改和外部客户端产生一致命令语义。
- 任意失败都能定位到资产、节点、属性和事务阶段，并可恢复。
- Studio 可以扩展 Panel、Action、Property、Diagnostic 和 Renderer，而不形成第二套写入系统。
- 大项目下选择、拖动、编辑和预览保持稳定性能。
- 数据、运行状态、视图状态和交互状态各有唯一所有者。
- 旧系统被真正删除，而不是隐藏在兼容层后继续增加维护成本。
- 三项不可破坏边界在 Schema、模块依赖、API、插件和产品验收中都有证据。

最终产品应表现为一个统一系统：人类看到的是专业、直接、可预测的编辑体验；机器看到的是严格、可解释、可事务化的项目规格；两者操作的是同一组事实，而不是两套互相同步的世界。
