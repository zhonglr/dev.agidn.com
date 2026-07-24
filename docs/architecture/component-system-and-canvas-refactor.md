# 组件系统与 Canvas 联合重构方案

> 状态：In Progress（C0–C3、C5 基础契约已落地；C4、C6 继续实施）
> 最后更新：2026-07-24
> 适用范围：Component Registry、PageDocument、Rule/Command Engine、React Renderer、Studio Canvas Runtime、Inspector、自定义组件资产与 Canvas

本文整理当前组件清单、公用与私有属性、插槽和运行时能力，并定义组件系统与 Canvas 从零重建的目标模型、模块边界、破坏性切换阶段和验收标准。本文同时记录已经落地的重构边界；当前运行事实仍以[项目状态](../project/status.md)、代码和自动化测试为准。

拖拽状态机、Geometry Snapshot、碰撞、投影和动画的专项设计继续以[Canvas 拖拽与布局引擎重建设计](./canvas-drag-layout-engine.md)为准。本文负责确定 Canvas 所消费的组件、Slot、布局和 Inspector 契约，避免两项重构形成新的重复事实来源。

## 1. 结论摘要

本次重构应先回答“什么是布局、什么是基础组件、什么是组合组件”，再扩展组件数量。推荐采用四层模型：

```text
Page / Custom Component Asset
├── Layout Primitives
│   └── Section / Container / Stack / Row / Grid / Overlay
├── Code Primitives
│   └── Button / Link / Heading / Text / Image / Icon / Badge / Card / Divider
├── Composite Components
│   └── Navigation / PricingCard / FAQItem / 项目自定义组件
└── Patterns
    └── Hero / Pricing Section / FAQ Section / Header / Footer
```

关键决策建议如下：

1. `Section / Container / Stack / Row / Grid / Overlay` 在新系统中只作为 Layout Node，不再注册为普通代码组件。
2. `Button` 等基础代码组件由一个可序列化的 Component Definition V2 描述 Props、Slots、Variants、Token、Events、Accessibility 和 Editor 元数据。
3. 删除旧 `Navigation / PricingCard / FAQItem` 实现；如新系统仍需要这些能力，则使用新基础组件和 Layout 从零建立 Composite Component。
4. 页面 Pattern 是可插入、可展开编辑的结构模板，不是新的运行时节点种类。
5. `props` 只保存组件私有业务属性；布局放置、响应式、Token、交互和无障碍使用统一的公共字段。
6. Canvas 只消费 `NodeContract + SlotContract + GeometrySnapshot`，不得为具体组件写命中、拖放或 Inspector 分支。
7. Editor Simulation State 属于 Editor Session，不进入正式 PageDocument；正式文档只保存可导出、可验证的页面事实。
8. 删除当前 `localStorage` 自定义组件和 Saved Components，不导入、不转换、不保留引用。
9. 新系统不提供旧 Schema、Catalog、Component Ref、Revision 或浏览器缓存的兼容层、迁移器、别名和 fallback。

### 1.1 已确认的硬重置约束

本次重构采用一次性破坏性切换，以下原则已经确认，不再作为待选方案：

- 新系统只接受重构后定义的精确 Schema 版本。
- 任何旧 PageDocument、Component Definition、Custom Component、Saved Component、Revision State 和导出上下文均视为无效数据。
- 旧数据不进入新测试 Fixture，不作为新组件 Preset，也不用于验证视觉兼容。
- 旧 `componentRef` 不建立 alias；旧字段不保留 deprecated 读取路径。
- Workspace Server 不尝试恢复旧 Revision；Studio 不读取旧 `localStorage`。
- 重构实施时通过有明确目标清单的 Reset 工具删除旧数据，不能依赖人工逐项清理，也不能使用宽泛目录删除。
- 本文的“当前系统盘点”只用于识别应删除的问题和避免重犯，不构成迁移输入。

硬重置的数据范围包括：

| 范围                                           | 处理                                                           |
| ---------------------------------------------- | -------------------------------------------------------------- |
| 原 Golden Pricing Page 与旧 Catalog 数据       | 已删除，用新 Schema 创建最小 Foundation Project                |
| `examples/sample-components` 旧定义            | 已删除，不复用旧 Definition                                    |
| Workspace Revision State、History 和旧项目文档 | 删除，不恢复                                                   |
| Studio `agidn.studio.*` 本地数据               | 清除，包括页面、Saved Components、自定义组件、工作区缓存和偏好 |
| 旧导出 Context Package 与生成缓存              | 删除并由新系统重新生成                                         |
| 旧 Schema Adapter、兼容 Decoder、字段 fallback | 不实现；已有路径随新基线切换删除                               |

源码基础设施可以在重构期间复用，但只有通过新契约、测试和验收的实现才能进入新基线。

### 1.2 三项设计准入原则

所有新 Layout、Primitive、Composite、Pattern 和公共字段必须同时满足：

| 原则       | 含义                                                                                  | 拒绝示例                                                        |
| ---------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 足够基础   | 单一职责、跨业务可复用、不能再合理拆分为编辑器节点                                    | 把 Pricing、FAQ、Header 等业务语义放进 Primitive                |
| 足够稳定   | 严格 Schema、确定性默认值、明确 Props/Slots/Events、无隐藏优先级                      | 同一内容同时由 Prop 和 Slot 决定、接受任意 CSS 或任意 Token 键  |
| 足够可扩展 | 通过 Registry、Capability、Composition 和稳定 ID 扩展，不修改 Canvas/Inspector 主流程 | 每增加一个组件就给 Canvas、Inspector 或 Rule Engine增加类型分支 |

具体准入 Gate：

1. 能组合完成的能力不新增 Node Kind。
2. 能由公共字段表达的能力不新增私有 Prop。
3. 能由 Composite 表达的业务模块不新增 Primitive。
4. 新组件必须同时交付 Definition、Runtime、Preset、Rule、Inspector 映射和测试。
5. Canvas 只读取通用 Node、Slot 和 Geometry 契约。
6. Schema 默认拒绝未知字段；扩展必须先进入正式契约。
7. 新基线不因旧数据形状降低接口纯度。

### 1.3 当前实施状态（2026-07-24）

本次硬重置已经完成以下落地项：

- 删除 `examples/golden-pricing`、其 Revision/Context 生成物和 `examples/sample-components`。
- 固化并可重复验证 [V2 破坏性重置清单](./v2-reset-manifest.md)。
- 建立只接受 `2.0.0` 的 PageDocument、Command、Patch、API、Canvas Runtime、Revision Store、Workbench Layout 和 Component Registry。
- 从 Component Node 删除 `state` 与任意 `tokens`，加入 `styleBindings`、`placement`、`visibility`。
- 从零建立 9 个 Primitive Definition、Runtime 和最小 [`examples/foundation/page.ui.json`](../../examples/foundation/page.ui.json)。
- 删除旧组件 Runtime/CSS、`node.setToken`、主题/Workbench 旧存储回退和快捷键旧格式解析。
- Studio 浏览器持久化统一进入 `agidn.studio.v2.*`，不会读取旧键。
- V1 文档、Catalog 与 Command 都有拒绝测试；旧 Preview 消息协议已经完整删除。
- Layout Engine、直接 DOM 命中和 Canvas Ghost Projection 已接入当前 Canvas，拖拽只提交一次且不再存在跨窗口迟到响应。
- 公共 `name / role / placement / visibility / accessibility / interactions`、Variant 和 Token Binding 已全部进入 V2 Command、Rule、Patch 与 Revision 链路。
- Inspector 已按 Component Definition、Token/Action Catalog 和父布局能力生成；9 个 Primitive 的 Preset 均可生成可合法插入的节点。
- 旧 Saved/Custom 浏览器资产原型、专用 Workbench、拖拽 MIME、入口、样式和测试已删除。
- 建立 `@agidn/project-assets` 与 [`examples/foundation/assets.json`](../../examples/foundation/assets.json)：Composite/Pattern 进入 Workspace 加载校验、Catalog 和 Context Export；Pattern 以单个 Revision 事务展开为普通节点。

尚未完成的内容集中在 C4 的完整 Geometry/Pointer/局部 Projection，以及 C6 的 Composite 实例运行时、资产 Revision 写入 API 和复用 Canvas 的专注编辑器。后续能力包仍按 C7 推进，不得重新引入任何 V1 输入或旧资产导入。

## 2. 重置前系统盘点

### 2.1 重置前持久化节点

重置前的 `PageNodeSchema` 有两类节点：

```text
LayoutNode
├── id / name / role
├── layout / width / gapToken / align / columns / overlay
└── children[]

ComponentNode
├── id / name / role / componentRef
├── variant / state
├── props / tokens
├── slots
├── interactions
└── accessibility
```

以下内容是删除审计，不是当前 Schema。当前定义见 [`packages/document-schema/src/index.ts`](../../packages/document-schema/src/index.ts)。

- `tokens` 接受任意属性名，Component Definition 没有声明组件实际支持哪些 Token。
- `interactions` 接受全局事件集合，组件没有声明自己能发出哪些事件。
- `state` 被持久化，但当前运行时没有统一定义它是初始状态、预览状态还是业务状态。
- Component Definition 只有 Props、Slots、Variants、States 和少量无障碍提示，不能完整生成 Inspector。
- 每个节点作为父布局 Item 时的宽度、伸展、Grid span 和响应式可见性没有统一模型。

### 2.2 已删除的 15 个注册组件

重置前的 Catalog 和 `examples/sample-components` 共定义 15 个组件。下表只保留删除审计，不代表任何旧实现会进入新系统：

| 当前组件      | 分类       | 私有 Props                        | Slots                                | Variants                          | States                     | 新系统决定                                 |
| ------------- | ---------- | --------------------------------- | ------------------------------------ | --------------------------------- | -------------------------- | ------------------------------------------ |
| `Button`      | actions    | `label*`、`iconOnly`、`disabled`  | `leading`、`content`、`trailing`     | primary、secondary、danger、ghost | default、disabled、loading | 删除旧实现；按新 Primitive 契约重新实现    |
| `Link`        | actions    | `label*`、`href*`、`external`     | 无                                   | default、muted                    | default、disabled          | 删除旧实现；按新 Primitive 契约重新实现    |
| `Heading`     | typography | `text*`、`level*`                 | 无                                   | display、title、section           | default                    | 删除旧实现；按新 Primitive 契约重新实现    |
| `Text`        | typography | `text*`                           | 无                                   | body、muted、emphasis             | default                    | 删除旧实现；按新 Primitive 契约重新实现    |
| `Image`       | media      | `src*`、`alt*`                    | 无                                   | default、rounded                  | default、loading、error    | 删除旧实现；按新 Primitive 契约重新实现    |
| `Icon`        | media      | `name*`、`decorative`             | 无                                   | default、success、danger          | default                    | 删除旧实现；新实现只使用公共 accessibility |
| `Badge`       | content    | `label*`                          | 无                                   | default、accent、success          | default                    | 删除旧实现；按新 Primitive 契约重新实现    |
| `Card`        | content    | 无                                | `content*`                           | default、outlined、elevated       | default、loading           | 删除旧实现；按新 Primitive 契约重新实现    |
| `Navigation`  | navigation | `label*`                          | `items*: Link[]`                     | header、footer                    | default、collapsed         | 删除；需要时从零建立 Composite             |
| `Container`   | layout     | `width`                           | `content*`                           | default                           | default                    | 删除普通组件；新系统只提供 Layout Node     |
| `Stack`       | layout     | 无                                | `content*`                           | default                           | default                    | 删除普通组件；新系统只提供 Layout Node     |
| `Row`         | layout     | 无                                | `content*`                           | default                           | default                    | 删除普通组件；新系统只提供 Layout Node     |
| `Grid`        | layout     | 无                                | `content*`                           | default                           | default                    | 删除普通组件；新系统只提供 Layout Node     |
| `PricingCard` | commerce   | `planName*`、`price*`、`featured` | description、features、action、badge | default、featured                 | default、loading、disabled | 删除；需要时从零建立 Composite             |
| `FAQItem`     | content    | `question*`、`answer*`            | 无                                   | default                           | closed、open               | 删除；需要时从零建立 Composite             |

`*` 表示旧定义中的必填项。原始输入已经删除；当前唯一 Catalog 是 [`examples/foundation/components.json`](../../examples/foundation/components.json)，只包含 9 个从零定义的 Primitive。

### 2.3 重置前插槽

| 组件          | Slot          | 接受内容           | 数量   |
| ------------- | ------------- | ------------------ | ------ |
| `Button`      | `leading`     | `Icon`             | 0–1    |
| `Button`      | `content`     | `Text`             | 0–1    |
| `Button`      | `trailing`    | `Icon`             | 0–1    |
| `Card`        | `content`     | 任意节点           | 至少 1 |
| `Navigation`  | `items`       | `Link`             | 至少 1 |
| `Container`   | `content`     | 任意节点           | 至少 1 |
| `Stack`       | `content`     | 任意节点           | 至少 1 |
| `Row`         | `content`     | 任意节点           | 至少 1 |
| `Grid`        | `content`     | 任意节点           | 至少 1 |
| `PricingCard` | `description` | `Text`             | 1      |
| `PricingCard` | `features`    | `Text`             | 至少 1 |
| `PricingCard` | `action`      | `Button` 或 `Link` | 1      |
| `PricingCard` | `badge`       | `Badge`            | 0–1    |

### 2.4 当前 Inspector 能力

当前 Inspector 实际只允许编辑：

- Component Definition 中注册的私有 `props`。
- `variant`。

当前只读或尚未开放：

- `tokens` 只读展示。
- `name`、`role`、`state`、`interactions`、`accessibility` 没有完整公共编辑器。
- Layout Node 只显示说明，没有完整布局与响应式属性面板。
- Slots 通过结构树和拖放间接编辑，没有统一 Slot Inspector。

实现见 [`apps/studio/src/panels.tsx`](../../apps/studio/src/panels.tsx)。

### 2.5 当前重复事实来源

重构前必须显式消除以下重复：

| 重复                                            | 当前风险                              | 目标                                               |
| ----------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Layout Node 与 `Container/Stack/Row/Grid` 组件  | 同一布局有两套 Schema、规则和拖放行为 | 只保留 Layout Node                                 |
| `PricingCard.featured` 与 featured variant      | 两个值可能冲突                        | 只保留 variant                                     |
| `Icon.decorative` 与 `accessibility.decorative` | 无障碍语义分叉                        | 只保留 accessibility                               |
| `Navigation.label` 与 `accessibility.label`     | ARIA 名称分叉                         | 只保留 accessibility                               |
| `Button.label` 与 `content` Slot                | 两个内容源且有隐式优先级              | Primitive 只保留 label，富内容另建组件或显式模式   |
| `Button.disabled` 与 disabled state             | 运行配置和编辑器模拟态混在一起        | disabled Prop 表示运行配置；Simulation State 移出文档 |
| Page Canvas 与资产编辑器的拖放实现              | 容易产生两套规则和命中行为            | 共用 Drag Controller 与 Layout Engine              |
| Catalog Slot Policy 与客户端手写规则            | 预览合法、提交拒绝或反之              | Registry Snapshot 驱动统一 Drop Policy             |

## 3. 目标组件分层

### 3.1 Layout Primitives

Layout Primitive 是 PageDocument 的结构语义，不是 React 组件目录中的普通组件：

| Layout      | 责任               | 核心属性                                     |
| ----------- | ------------------ | -------------------------------------------- |
| `section`   | 页面级语义区段     | role、width、section spacing                 |
| `container` | 内容宽度边界       | width                                        |
| `stack`     | 单轴垂直排列       | gap、align                                   |
| `row`       | 单轴横向排列与换行 | gap、align、wrap policy                      |
| `grid`      | 响应式二维排列     | gap、align、responsive columns               |
| `overlay`   | 受控叠加           | purpose、anchor、boundary、offset、collision |

Layout Primitive 由 Layout Engine、Renderer 和 Rule Engine 共同实现，但契约只有一份。不得用普通组件 Slot 模拟核心 Layout，也不得把任意 CSS Grid 坐标写入普通组件 Props。

### 3.2 Code Primitives

第一阶段只从零实现能够长期稳定复用、不能再拆成编辑器节点的最小代码组件：

| Primitive | 必要私有 Props                   | Slots                     | 支持事件               |
| --------- | -------------------------------- | ------------------------- | ---------------------- |
| `Button`  | `label*`、`disabled`、`iconOnly` | leadingIcon、trailingIcon | press                  |
| `Link`    | `label*`、`href*`、`external`    | 无                        | press                  |
| `Heading` | `text*`、`level*`                | 无                        | 无                     |
| `Text`    | `text*`                          | 无                        | 无                     |
| `Image`   | `src*`、`alt*`                   | 无                        | 可选 load、error，后置 |
| `Icon`    | `name*`                          | 无                        | 无                     |
| `Badge`   | `label*`                         | 无                        | 无                     |
| `Card`    | 无                               | content*                  | 无                     |
| `Divider` | 无；方向由 Variant 表达          | 无                        | 无                     |

本阶段不因为“组件库看起来不够多”而增加 Avatar、Carousel、Modal、Tabs 等组件。新增 Primitive 必须满足：

1. 具有跨业务场景稳定语义。
2. 不能合理表达为现有 Layout 与 Primitive 的组合。
3. Props、Slots、Events 和无障碍契约可以稳定定义。
4. Canvas Runtime、Inspector、Rule、文档契约和测试能够同时交付。

### 3.3 Composite Components

Composite Component 是项目资产，由 Layout 与 Primitive 组成，并公开有限 Variables、Slots 和 Variants：

- `Navigation`
- `PricingCard`
- `FAQItem`
- 用户创建的项目自定义组件

Composite 不需要为每个业务组件编写新的 Canvas 命中或 Inspector。实例只公开资产定义允许覆盖的 Variables 和 Slots，内部节点在专注工作台中编辑。

建议的新实现结构：

```text
PricingCard
└── Card
    └── Stack
        ├── Badge slot
        ├── Text(planName)
        ├── Text(price)
        ├── description slot
        ├── action slot
        └── features slot
```

### 3.4 Patterns

Pattern 是一次性插入后成为普通节点树的模板，不保留不可见运行时边界：

- Site Header
- Hero
- Feature Section
- Pricing Section
- FAQ Section
- Footer

用户选择 Pattern 时，系统通过一个事务插入整棵合法节点树。之后所有节点可独立编辑。若需要保持封装和复用，应创建 Composite Component，而不是 Pattern。

### 3.5 后续能力包

表单、反馈和数据展示组件在基础模型稳定后按能力包引入：

| 能力包       | 候选组件                                                        | 前置条件                                |
| ------------ | --------------------------------------------------------------- | --------------------------------------- |
| Forms        | Form、TextField、TextArea、Select、Checkbox、RadioGroup、Switch | Binding Schema、表单事件和校验模型      |
| Feedback     | Alert、Progress、Spinner、EmptyState                            | 异步状态和可访问性规范                  |
| Navigation   | Breadcrumb、Tabs、Pagination                                    | 路由/选择状态模型                       |
| Media        | Video、Avatar、Gallery                                          | Asset 管理与加载策略                    |
| Data display | Table、List、Stat                                               | Collection Binding、重复项和键模型      |
| Overlay      | Dialog、Popover、Tooltip                                        | Overlay Runtime、焦点管理和 Portal 边界 |

这些组件不得在依赖的领域模型完成前以“只有外观”的方式加入 Catalog。

## 4. 公共属性与私有属性规范

### 4.1 系统只读字段

所有 Component Node 都有以下只读字段：

| 字段           | 说明                                          |
| -------------- | --------------------------------------------- |
| `id`           | 项目内稳定节点 ID                             |
| `kind`         | 固定为 `component`                            |
| `componentRef` | Component Registry 或 Custom Asset 的稳定引用 |

Studio 可显示和复制这些字段，但普通 Inspector 不允许直接修改。

### 4.2 公共可编辑字段

| 分组          | 字段            | 规则                                  |
| ------------- | --------------- | ------------------------------------- |
| General       | `name`          | 编辑器内部名称，不影响渲染内容        |
| Semantics     | `role`          | 只能选择 Definition 声明的 roles      |
| Appearance    | `variant`       | 只能选择 Definition 声明的 variants   |
| Style         | `styleBindings` | 只能绑定 Definition 声明的 Token Slot |
| Layout item   | `placement`     | 由父 Layout 类型决定可用字段          |
| Responsive    | `visibility`    | 按受支持断点控制可见性                |
| Behavior      | `interactions`  | 只能绑定 Definition 声明的 events     |
| Accessibility | `accessibility` | 公共 label、describedBy、decorative   |

“公共”表示使用统一机制和 Inspector 分组，不表示每个组件都显示全部字段。具体可见性由 Component Definition 和父 Layout Capability 决定。

### 4.3 私有 Props

私有 `props` 必须只描述组件自身的内容或运行配置，例如：

- Button 的 `label`、`disabled`。
- Link 的 `href`、`external`。
- Heading 的 `text`、`level`。
- Image 的 `src`、`alt`。

以下内容不得进入私有 Props：

- 通用颜色、圆角、阴影和字体。
- 节点在父容器中的对齐、伸展或 Grid span。
- 通用可访问名称。
- Canvas 选中、hover、拖拽或 Editor Simulation State。
- 任意 CSS 字符串。
- Command、Revision、请求 ID 等编辑器状态。

### 4.4 私有 Slots

Slot 是组件结构 API，不是任意 children：

```ts
interface SlotDefinitionV2 {
  displayName: LocalizedLabel;
  valueType: "nodes";
  accepts: readonly ComponentSelector[];
  minItems: number;
  maxItems?: number;
  required: boolean;
}
```

Slot 必须满足：

- 有稳定机器名和本地化显示名。
- 空 Slot 在 Canvas 中仍提供可命中的 Geometry Zone。
- `accepts`、数量、嵌套深度和循环引用由统一 Drop Policy 验证。
- Runtime Component 不能把多个公开 Slot 渲染到同一个不可区分的 DOM 区域。
- 新基线建立前可以直接重定义 Slot，不迁移旧实例；新基线发布后的接口变更必须显式版本化或阻止破坏性保存。

### 4.5 Token Slot

Component Definition 必须显式声明可绑定的 Token，而不是继续接受任意键：

```ts
interface TokenSlotDefinition {
  displayName: LocalizedLabel;
  tokenTypes: readonly ("color" | "spacing" | "radius" | "typography" | "shadow" | "size")[];
}
```

建议统一公共命名：

| Token Slot     | 类型       | 说明         |
| -------------- | ---------- | ------------ |
| `textColor`    | color      | 文字或前景色 |
| `surfaceColor` | color      | 表面背景色   |
| `borderColor`  | color      | 边框色       |
| `radius`       | radius     | 圆角         |
| `shadow`       | shadow     | 阴影         |
| `typography`   | typography | 字体样式     |

Spacing、尺寸和布局 Gap 优先由 Layout Primitive 管理。只有组件内部确实公开该设计接口时，才声明组件级 spacing 或 size Token Slot。

### 4.6 Editor Simulation State

目标模型中，default、hover、focus、pressed、loading、error 等设计态由 Studio Session 保存：

```ts
interface ComponentSimulationState {
  nodeId: string;
  state: string;
}
```

它不进入 PageDocument、不创建 Revision、不参与导出。组件实际运行状态由 Props、Bindings 和 Runtime 决定。新 Schema 直接删除 `ComponentNode.state`，不读取也不转换包含该字段的旧文档。

### 4.7 Layout Item 与响应式属性

每个节点都可能是某个 Layout 的 Item，因此需要独立于组件 Props 的受控模型：

```ts
interface LayoutItemSpec {
  width?: "auto" | "fit" | "fill";
  grow?: boolean;
  alignSelf?: "auto" | "start" | "center" | "end" | "stretch";
  gridSpan?: {
    mobile?: 1 | 2 | 3 | 4 | 6 | 12;
    tablet?: 1 | 2 | 3 | 4 | 6 | 12;
    desktop?: 1 | 2 | 3 | 4 | 6 | 12;
  };
}

interface ResponsiveVisibility {
  mobile?: boolean;
  tablet?: boolean;
  desktop?: boolean;
}
```

可用属性由父 Layout 决定：

- Stack/Row 可以设置 grow 和 alignSelf。
- Grid 可以设置 gridSpan。
- Page root 或非布局父节点不显示无效 Placement 属性。
- 排序以 children/slot 数组顺序为事实来源，不额外保存重复 order。

该字段作为新 Schema 基线的一部分一次性实现，不为当前数据增加过渡字段或兼容读取路径。

## 5. Component Definition V2

### 5.1 单一可序列化契约

推荐扩展 `@agidn/component-registry`，不为 Inspector、Canvas 和 Renderer 分别建立组件描述：

```ts
interface ComponentDefinitionV2 {
  schemaVersion: "2.0.0";
  name: string;
  version: string;
  source: string;
  displayName: LocalizedLabel;
  description?: LocalizedLabel;
  category: "action" | "typography" | "media" | "surface" | "composite";

  roles: readonly string[];
  props: Readonly<Record<string, PropDefinitionV2>>;
  slots: Readonly<Record<string, SlotDefinitionV2>>;
  variants: Readonly<Record<string, VariantDefinition>>;
  tokenSlots: Readonly<Record<string, TokenSlotDefinition>>;
  events: Readonly<Record<string, EventDefinition>>;
  accessibility: AccessibilityContract;
  editor: EditorMetadata;
}
```

该对象必须可序列化，不能直接包含 React Component、DOM 节点、函数闭包或 Studio UI 元素。真实运行组件继续由独立 `RuntimeComponentRegistry` 解析。

### 5.2 Prop Definition

当前 Prop 只有 string、boolean、number、enum。V2 首阶段补齐编辑与验证所需元数据：

```ts
interface PropDefinitionV2 {
  type: "string" | "boolean" | "number" | "enum";
  displayName: LocalizedLabel;
  description?: LocalizedLabel;
  required: boolean;
  defaultValue?: string | number | boolean;
  values?: readonly (string | number)[];
  valueDisplayNames?: Readonly<Record<string, LocalizedLabel>>;
  editor?: {
    control: "text" | "textarea" | "number" | "checkbox" | "select" | "url" | "asset";
    group: "content" | "behavior" | "advanced";
    placeholder?: LocalizedLabel;
  };
  validation?: {
    min?: number;
    max?: number;
    step?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}
```

默认值必须由 Registry 提供。`createComponentNode` 不再把所有必填字符串都填成相同的 “New content”，而是使用组件声明的合法创建 Preset。

### 5.3 Event Definition

```ts
interface EventDefinition {
  displayName: LocalizedLabel;
  arguments: Readonly<Record<string, "string" | "number" | "boolean">>;
}
```

Rule Engine 需要同时验证：

1. 组件是否声明该 Event。
2. Action 是否存在。
3. Event 输出参数与 Action 输入参数是否兼容。
4. 用户提供的常量参数是否合法。

### 5.4 Editor Metadata

Editor Metadata 只描述通用 Studio 如何呈现组件，不包含自定义 JSX：

```ts
interface EditorMetadata {
  icon: string;
  group: string;
  keywords?: readonly string[];
  defaultPreset: string;
  presets: Readonly<Record<string, ComponentCreatePreset>>;
  canSaveAsComposite?: boolean;
}
```

Preset 生成合法初始 Props、Variant 和必要 Slot 内容。所有入口，包括 Components Panel、键盘插入、AI Command 和测试，都复用同一 Node Factory。

## 6. Runtime 与 Canvas 契约

### 6.1 Runtime Adapter

Runtime Component 必须：

- 将 `hostProps` 附着到唯一、稳定的根 DOM 元素。
- 不吞掉 `data-node-id`、`data-node-kind` 和 Component Ref。
- 为每个公开 Slot 提供稳定 Slot Anchor。
- 即使 Slot 为空，也能让 Geometry Collector 获取可见或最小可命中的矩形。
- 只通过 Runtime Context 派发已声明事件。
- 不直接访问 Studio Session、Command Engine 或 Canvas 状态。

建议的 Runtime 接口：

```ts
interface RuntimeComponentPropsV2 {
  node: ComponentNode;
  resolvedProps: Readonly<Record<string, unknown>>;
  hostProps: NodeHostProps;
  slots: Readonly<Record<string, RuntimeSlot>>;
  style: ResolvedComponentStyle;
  simulationState?: string;
  emit: (eventName: string, argumentsValue?: Record<string, unknown>) => void;
}

interface RuntimeSlot {
  name: string;
  hostProps: SlotHostProps;
  children: React.ReactNode;
  isEmpty: boolean;
}
```

### 6.2 Geometry Snapshot

Studio Canvas Runtime 从同文档 DOM 直接采集统一 Geometry Snapshot：

```ts
interface GeometrySnapshot {
  layoutEpoch: number;
  nodes: Record<
    NodeId,
    {
      rect: Rect;
      parentId?: NodeId;
      depth: number;
    }
  >;
  zones: Array<{
    id: string;
    ownerNodeId: NodeId;
    collection: CollectionRef;
    rect: Rect;
    contentRect?: Rect;
    layout: "stack" | "row" | "grid" | "slot";
    items: GeometryItem[];
  }>;
}
```

Canvas 不再使用“命中一个 DOM 节点后猜测中间区域是哪个 Slot”的方式。命名 Slot、空 Slot、Layout content box 和 Grid 行列都成为明确 Zone。

### 6.3 Projection

拖拽期间：

1. Drag Controller 采样指针。
2. Layout Engine 使用 Registry/Policy Snapshot 过滤合法 Zone。
3. Resolver 生成 `DragPlan`。
4. Canvas Projection Renderer 只投影受影响集合。
5. 用户 Drop 后只提交一次正式 Command。
6. 服务端接受后，用正式 Revision 替换投影；拒绝则回滚并显示稳定错误。

Component Props、Runtime 组件类型和业务名称不得进入 DragPlan。DragPlan 只表达 Source、Target、Placeholder 和受影响节点。

## 7. Studio Inspector 目标结构

Inspector 由 Node Schema、Component Definition 和父 Layout Capability 共同生成：

```text
Inspector
├── General
│   ├── Name
│   └── Role
├── Content
│   └── Component private Props
├── Appearance
│   ├── Variant
│   └── Declared Token Slots
├── Layout
│   └── Parent-controlled Placement
├── Responsive
│   └── Visibility / Grid Span
├── Behavior
│   └── Declared Events → Actions
├── Accessibility
│   └── Label / Description / Decorative
└── Advanced
    ├── Node ID
    └── Component Ref / Version
```

规则如下：

- 不为 Button、PricingCard 等组件编写独立 Inspector JSX。
- Prop Definition 决定控件类型、必填、默认值和校验提示。
- 无效字段不显示，而不是显示后让服务端拒绝。
- 修改仍然生成 Command，不允许 Inspector 直接改 Session 中的文档克隆。
- 多字段修改可以形成一个事务，避免每个输入字符创建正式 Revision。
- Slot 内容在 Tree/Canvas 中编辑；Inspector 只显示 Slot 契约、数量和跳转入口。

## 8. 项目级 Composite 资产

旧 `localStorage` 自定义组件、Saved Component 和变量/Slot 字符串绑定原型已经删除，不参与新模型构建。当前正式基础契约位于 `@agidn/project-assets`，项目事实来源为 `assets.json`：

```ts
interface CompositeAsset {
  id: string;
  kind: "composite";
  version: number;
  root: PageNode;
  publicProps: Record<string, {
    definition: PropDefinition;
    bindings: Array<{ targetNodeId: string; property: string }>;
  }>;
  publicSlots: Record<string, {
    definition: SlotDefinition;
    targetNodeId: string;
    targetSlot?: string;
  }>;
  variants: Record<string, CompositeVariant>;
}
```

当前已经实现：

- Workspace 启动时严格校验 `assets.json`，Catalog 与 Context Package 均输出同一份资产快照。
- Composite 使用稳定资产 ID 和整数接口版本；依赖由内部 `componentRef` 推导，不持久化冗余依赖字段。
- 校验资产键与 ID、模板节点 ID、公开 Prop/Slot 绑定、必填默认值及直接/间接循环引用。
- Pattern 插入时刷新模板节点 ID，并作为一组 Command 在一个 Revision 中展开为普通 PageNode。
- Foundation 基线仅提供一个用于验证契约的 Composite 和一个最小 Pattern，不恢复旧 Navigation、PricingCard 或 FAQItem。
- Asset upsert/remove 使用严格 Command/Patch，并与 PageDocument Command 共享一个原子项目事务。
- `PageDocument + ProjectAssets` 作为完整 `3.0.0` Project Revision 快照进入 History、undo/redo/restore、原子文件持久化和严格 HTTP API；旧 `2.0.0` Document-only 状态不会被读取或迁移。

仍需完成：

- 更完整的跨资产依赖影响分析与接口版本变更诊断。
- 复用 Page Canvas 的专注编辑器。不得恢复已经删除的旧 Component Workbench，也不得建立临时 `localStorage` 资产格式。

## 9. 模块职责

```text
Component source / Custom assets
              │
              ▼
Component Registry V2 ──────► Inspector schema
      │       │                    │
      │       ├──────────────► Drop Policy Snapshot
      │       │                    │
      ▼       ▼                    ▼
Rule Engine  Node Factory     Studio Drag Controller
      │                            │
      ▼                            ▼
Command → Patch → Revision    Layout Engine
      │                            │
      └──────────────┬─────────────┘
                     ▼
             Direct DOM Runtime
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
    React Renderer      Geometry / Projection
```

| 模块                 | 负责                                        | 不负责                         |
| -------------------- | ------------------------------------------- | ------------------------------ |
| `document-schema`    | 节点公共数据形状、版本                      | 具体组件清单、React、Inspector |
| `component-registry` | 可序列化组件契约、Preset、版本              | DOM、Canvas 状态               |
| `rule-engine`        | Props/Slots/Token/Event/布局最终验证        | UI 呈现                        |
| `command-engine`     | 所有正式修改和事务                          | 拖拽逐帧投影                   |
| `layout-engine`      | Zone、碰撞、排序、DragPlan                  | 持久化和业务 Props             |
| `react-renderer`     | 确定性节点渲染、Runtime Adapter             | Studio 工作区                  |
| `studio/canvas`      | 直接 DOM Runtime、Geometry、Projection      | 最终业务验证                   |
| `studio`             | Selection、Inspector、Drag Sensor、错误反馈 | 绕过 Command 改文档            |
| `workspace-server`   | Catalog Snapshot、资产、Revision、持久化    | 浏览器手势                     |

## 10. 破坏性重建计划

### Phase C0：建立 Reset 边界（已完成）

交付：

- 用 ADR 固定 Layout 唯一身份、Editor Simulation State 外移、四层组件模型和不兼容旧数据的决策。
- 建立显式 Reset Manifest，逐项列出允许删除的仓库数据、Workspace 状态、浏览器键和生成物。
- 增加受限 Reset 工具，只删除 Manifest 中的精确目标；禁止使用工作区根目录、通配目录或未解析环境变量作为删除目标。
- 删除当前 15 个旧 Component Definition、旧 Runtime 映射、旧 Foundation Page/Catalog 和相关快照。
- 删除 Workspace Revision State、History、Saved Components、Custom Components 和 `agidn.studio.*` 浏览器数据。
- 删除旧 Schema Decoder、字段 fallback、Component Ref alias 和兼容测试。

Reset Manifest 至少覆盖：

```text
Repository
├── examples/golden-pricing/**
├── examples/sample-components/**
└── 只服务于旧组件模型的 fixtures / snapshots

Workspace runtime
├── current PageDocument
├── Revision State / History
├── generated Context Package
└── component/catalog cache

Browser origin
└── agidn.studio.*
```

退出条件：

- 启动 Workspace 后不存在任何旧页面、组件资产或 Revision。
- Studio 本地存储中不存在旧项目、Saved Component、Custom Component 或布局缓存。
- 旧 Schema 文档只能得到稳定的 `UNSUPPORTED_SCHEMA_VERSION`，不能进入运行时。
- 代码库中不存在 V1 Adapter、Legacy Loader 或旧 Component Ref alias。

### Phase C1：建立全新 Component Definition V2（已完成）

交付：

- 从空 Registry 开始实现 Token Slot、Event、Prop 默认值、Editor Metadata 和 Preset。
- 首批只注册目标 9 个 Primitive，不复制旧 Definition 对象。
- Node Factory 只消费新 Preset。
- Rule Engine、Inspector Schema 和 AI Export 只消费同一 V2 Snapshot。
- Catalog API 只返回 V2，不协商、不降级。

退出条件：

- 每个 Primitive 都能从 Definition 生成合法默认节点。
- Inspector、Rule 和 AI Export 读取同一份 Definition。
- 任何 V1 Catalog 输入都被拒绝。

### Phase C2：建立全新 Document Schema 与 Command（已完成）

交付：

- 定义只接受精确新版本的 PageDocument Schema。
- 一次性加入 `styleBindings`、`placement`、`visibility` 和新的公共属性结构。
- 直接删除持久化 `state`、任意 Token 键和其他旧字段。
- 从空 Command 集重建相应 Command、Patch 和 Rule，不增加 legacy command handler。
- 创建新的最小 Foundation Project；其内容不要求与旧 Pricing Page 视觉或结构一致。

退出条件：

- 新 Foundation Project 只使用新 Layout 与 Primitive。
- 所有公共字段只能通过新 Command 修改。
- 旧 PageDocument、旧 Command 和未知字段均被稳定拒绝。

### Phase C3：重建 Renderer 与 Inspector（已完成代码基线，待浏览器验收）

交付：

- 按新 Runtime Contract 实现 9 个 Primitive。
- 实现 Runtime Slot Anchor 和 Geometry 标记。
- 建立数据驱动 Inspector 分组。
- 完成 Props、Variant、Token、Placement、Responsive、Interaction、Accessibility 编辑闭环。
- 删除旧 Runtime 组件、组件专属 Inspector 分支和只读 Token fallback。

退出条件：

- 新增一个 Primitive 不需要修改 Inspector 主组件。
- 所有字段都有 Schema、Command、Rule、Renderer 或明确“仅编辑器元数据”归属。
- Renderer 不包含旧 Props 或旧 Component Ref 分支。

### Phase C4：Canvas 联合重建（进行中）

交付：

- Pointer/Touch/Keyboard Sensor。
- Geometry Snapshot 和显式 Slot Zone。
- 单一 Drag Controller、Drop Policy Snapshot 和 DragPlan。
- 局部 Projection Renderer，删除旧的整文档 ghost 热路径。
- Page Canvas 与后续正式资产编辑器复用同一控制器。

退出条件：

- 空 Slot、多 Slot、嵌套 Layout 和换行 Grid 均能稳定命中。
- 快速跨目标不会被旧响应覆盖。
- 拖拽中不创建 Revision；Drop 只创建一次 Revision。
- Canvas 不包含任何旧组件类型特判或旧拖拽协议 fallback。

详细阶段继续遵循[Canvas 拖拽与布局引擎重建设计](./canvas-drag-layout-engine.md)。

### Phase C5：从零建立 Composite 与 Pattern（基础契约已完成）

交付：

- 只有确有产品需要时，才使用新 Layout 和 Primitive 从零建立 Navigation、PricingCard、FAQItem。
- 已从零建立最小 Pattern，并通过事务展开为普通节点。
- 已为 Composite 定义公开 Props、Slots、Variants、绑定和依赖循环规则。

退出条件：

- Catalog 不暴露重复 Layout。
- Composite 内部只引用新基线节点。
- 不存在旧 `componentRef` 到新结构的映射。

### Phase C6：从零建立正式自定义组件（Schema/Catalog/Export 已完成，编辑闭环未完成）

交付：

- Workspace 项目级 Custom Component Schema。
- 正式 Revision、History、Catalog、导出和依赖分析。
- 删除 `localStorage` 原型实现和所有导入入口。
- 建立新组件接口版本、影响分析和循环引用防护。

退出条件：

- 刷新、服务重启和历史恢复不会丢失新自定义组件。
- 页面实例和组件专注工作台使用同一正式资产。
- 系统没有旧自定义组件导入、检测或转换代码。

### Phase C7：按能力包扩展

只有新基础模型和联合 Canvas 通过验收后，再按 Forms、Feedback、Navigation、Media、Data Display 和 Overlay 能力包增加组件。每个能力包独立定义前置 Schema、运行时和验收，不与基础重构混成一次发布。

## 11. 测试与验收

### 11.1 自动化契约

每个 Component Definition 必须覆盖：

- 合法默认 Preset。
- Required Props、类型、枚举和边界。
- Variant 和 Token Slot。
- Event 与 Action 参数。
- Slot accepts、min/max、空 Slot 和深度。
- Accessible Name 规则。
- 精确 Schema Version 验证。
- 低版本、未知版本和旧字段拒绝。

系统级必须覆盖：

- Definition → Node Factory → Rule Engine 一致性。
- Definition → Inspector 控件映射。
- Reset Manifest 只能命中明确允许删除的目标，并可重复执行。
- 清理后 Workspace 和 Studio 均从空状态启动。
- 旧 PageDocument、Catalog、Command、Revision State 和浏览器数据不会被读取。
- Layout Item 只在合法父布局下生效。
- Runtime Host 和 Slot Anchor 完整。
- Page Canvas 与后续正式资产编辑器产生等价 DragPlan。

### 11.2 浏览器验收矩阵

至少覆盖：

| 场景                          | Desktop | Tablet | Mobile |
| ----------------------------- | ------- | ------ | ------ |
| 插入 Primitive                | 必须    | 必须   | 必须   |
| Layout 内排序                 | 必须    | 必须   | 必须   |
| 跨 Layout 移动                | 必须    | 必须   | 必须   |
| 空 Slot / 多 Slot             | 必须    | 必须   | 必须   |
| Wrapped Grid                  | 必须    | 必须   | 必须   |
| 50% / 100% / 200% 缩放        | 必须    | 必须   | 必须   |
| Pointer / Keyboard            | 必须    | 必须   | 必须   |
| Touch                         | 不适用  | 建议   | 必须   |
| undo / redo / reject rollback | 必须    | 必须   | 必须   |

### 11.3 性能门槛

在固定浏览器和 500 个可渲染节点的验证 Fixture 上记录：

- 指针移动到 DragPlan 生成的 P95 时间。
- Geometry Snapshot 采集时间和频率。
- 每次目标变化的 React Commit 范围。
- 拖拽期间长任务数量。
- Projection 中参与动画的节点数量。

目标不是用单个平均 FPS 宣称完成，而是保证热路径成本随“受影响集合”增长，不随完整文档树线性重渲染。

### 11.4 可访问性

- Components Panel 的每个组件有名称、分类和明确插入操作。
- Keyboard Drag 使用同一 Slot Policy，并播报当前位置和拒绝原因。
- Icon-only Button 必须有 Accessible Name。
- decorative 内容不能进入可访问名称。
- Dialog、Overlay 和后续交互组件必须先完成焦点契约再进入 Catalog。

## 12. 实施纪律

- 不在重构中同时无边界扩充组件库。
- 不以 TypeScript 类型通过代替运行时 Schema。
- 不让 Canvas Runtime 或 Studio 成为组件合法性的最终权威。
- 不让 Component Definition 包含 React 或 Studio UI 实例。
- 不再增加普通 Layout 组件和 Layout Node 两套表达。
- 不把 Canvas Projection 写回正式 PageDocument。
- 不为旧数据实现迁移器、适配器、alias、fallback、双写或灰度读取。
- 不在 Custom Component 正式 Schema 前建立新的临时 `localStorage` 格式。
- 旧字段、旧 `componentRef` 和旧数据直接删除；新代码不得保留“以后可能有用”的兼容分支。
- 破坏性清理只能通过精确 Reset Manifest 执行，并在执行前输出目标清单。
- Reset 不负责恢复旧数据；需要保留的代码基础设施必须先证明符合新契约。

## 13. 已确认原则与 ADR

以下原则已经确认：

1. 删除所有旧项目数据、组件资产、Revision、缓存和本地存储。
2. 不兼容、不导入、不迁移任何重构前版本。
3. Layout Primitive 与 Code Component 完全分离。
4. `ComponentNode.state` 不进入新正式文档。
5. Component Definition V2 是 Inspector、Rule、Canvas Policy 和 AI Context 的共同事实来源。
6. 先完成基础 9 个 Primitive，再按能力包增加组件。
7. 以足够基础、足够稳定、足够可扩展为所有新接口的准入条件。

Phase C0 需要用 ADR 固化上述不可兼容切换、组件分层和状态边界。Custom Component 的新接口版本策略另建 ADR，但该 ADR 不得引入对旧原型资产的兼容要求。实施细节在代码落地和验收前仍保持 Proposed，不应被路线图或项目状态描述为已经完成。
