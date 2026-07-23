# Studio Authoring Model

> 状态：Draft
> 创建日期：2026-07-23
> 最后更新：2026-07-23
> 关联 Issue：`STUDIO-026`、`STUDIO-027`、`STUDIO-028`、`STUDIO-030`

本文记录 Studio 从“单页面文档编辑器”扩展为“多页面项目 + 可复用自定义组件资产编辑器”时的产品边界。它描述目标模型和交互契约，不表示这些能力已经实现；当前状态以 [Studio Issue 台账](../quality/issues.md) 为准。

## 1. 设计原则

1. 页面和自定义组件都是项目资产，但具有不同身份、生命周期和公开接口。
2. 两类编辑器复用同一套选择、结构树、坐标、拖放、Rule Engine、Command、Revision 和 Preview 能力，不复制一套相似实现。
3. 页面负责组合内容和页面级结构；自定义组件负责封装一个可复用结构，并通过变量与 Slot 暴露有限接口。
4. 页面切换、Editor Tab 和工作区 Panel 属于 Studio 会话状态；页面内容、自定义组件定义及其公开接口属于项目状态。
5. 浏览器 `localStorage` 可以保存用户界面偏好或原型缓存，不能成为项目资产的唯一事实来源。

## 2. 多页面工作区

### 2.1 用户心智模型

一个 Workspace 项目包含多个页面。Page Outline 的第一层不是当前页面的匿名 children，而是项目中的页面根节点；展开页面根后才显示该页面内部结构。

Editor 顶部为每个已打开页面显示一个 Tab：

```text
Project
├── Page: Home        → Editor Tab: Home
│   └── Page nodes
├── Page: Pricing     → Editor Tab: Pricing
│   └── Page nodes
└── Page: Checkout    → Editor Tab: Checkout
    └── Page nodes
```

激活页面根会激活已有 Tab，或为该页面打开一个新 Tab。关闭 Tab 只关闭编辑视图，不删除页面。

### 2.2 新建页面

Page Outline 顶部必须有可发现的新建页面按钮。创建流程至少收集名称并生成：

- 稳定、项目内唯一的 `pageId`。
- 合法的初始根结构。
- 可选路由或 slug；如果尚未定义路由模型，不用展示为已生效配置。
- 初始 Revision 和可撤销的创建记录。

页面删除、复制、重命名和排序必须通过项目级命令完成。删除和关闭 Tab 是两个不同操作，界面不能混淆。

### 2.3 状态边界

| 状态                      | 所有者                      | 是否项目持久化            |
| ------------------------- | --------------------------- | ------------------------- |
| 页面 ID、名称、顺序、内容 | Workspace 项目              | 是                        |
| 页面 Revision 与历史      | Workspace / Document Engine | 是                        |
| 当前激活页面              | Studio Session              | 可恢复偏好                |
| 已打开 Editor Tab 与顺序  | Workbench Session           | 可恢复偏好                |
| 当前节点选中与树展开      | 页面编辑会话                | 可选，不产生文档 Revision |

正式 Schema 可以采用 `WorkspaceDocument.pages[]` 或等价结构，但必须满足：

- 页面具有稳定身份，而不是用数组位置代替 ID。
- 单页面 `PageDocument` 有显式迁移路径。
- Command、undo/redo、History 和导出明确区分项目级操作与页面级操作。
- 切换页面不会把上一页面的 selection、Preview 消息或 Inspector 写入下一页面。

## 3. 自定义组件资产与专注工作台

### 3.1 目标

用户可以创建一个由现有注册组件和其他合法自定义组件组成的新组件，并在专注工作台中只处理这一项资产。该模式降低页面上下文噪音，但保留完成结构编辑所需的工具。

建议布局：

```text
Header: Back | Component identity | Save state/actions
Body:   Building Blocks | Component Tree | Focus Canvas | Configuration
```

Component Tree 可以比完整 Page Outline 更紧凑，但不能降级为扁平 Layers 列表。它需要展示：

- 资产根节点。
- 普通 children 和嵌套组件。
- 命名 Slot 容器及其内容。
- disclosure、选中、搜索、键盘导航与连续层级。
- before / inside / after 和命名 Slot 的合法拖放目标。

Canvas、Tree 与 Configuration 的选中必须双向同步。树选择视口外节点时，Canvas 使用与页面编辑器相同的短平移动画将其带入安全视口。

### 3.2 资产草案

以下字段表达产品所需信息，不是已经接受的序列化 Schema：

```ts
interface CustomComponentAsset {
  id: string;
  name: string;
  version: number;
  root: PageNode;
  variables: ComponentVariable[];
  slots: ComponentSlot[];
}

interface ComponentVariable {
  id: string;
  name: string;
  displayName?: LocalizedText;
  type: "string" | "number" | "boolean" | "enum";
  initialValue: string | number | boolean;
  enumValues?: string[];
  binding: {
    nodeId: string;
    property: string;
  };
}

interface ComponentSlot {
  id: string;
  name: string;
  displayName?: LocalizedText;
  valueType: "component" | "component-list" | "text";
  minItems?: number;
  maxItems?: number;
  accepts?: string[];
  defaultValue?: unknown;
  binding: {
    nodeId: string;
    slotName: string;
  };
}
```

变量公开一个可由实例覆盖的值，并绑定到内部节点属性。Slot 公开一个可由实例提供内容的位置，并绑定到内部命名 Slot。稳定 ID 用于迁移和实例引用；展示名称可以本地化，不能替代机器标识符。

### 3.3 值类型与初始值

变量的初始值必须与类型匹配：

| 类型    | 初始值           | 附加规则                    |
| ------- | ---------------- | --------------------------- |
| string  | 字符串           | 可选长度、格式或多行约束    |
| number  | 数值             | 可选 min、max、step         |
| boolean | `true` / `false` | 无字符串真值                |
| enum    | 枚举成员         | 初始值必须存在于 enumValues |

Slot 的默认值与数量约束由其 value type 决定：

| Slot 类型      | 默认值                 | 数量与接受范围                     |
| -------------- | ---------------------- | ---------------------------------- |
| component      | 可选单节点             | `maxItems = 1`，受 accepts 限制    |
| component-list | 可选节点列表           | 使用 minItems / maxItems / accepts |
| text           | 字符串或受控 Text 节点 | 不接受任意组件                     |

所有配置在保存前经过 Schema 与 Rule Engine 验证。改名可以保持稳定 ID；删除或改类型可能破坏已有实例，必须提供迁移、影响清单或阻止保存。

### 3.4 保存与复用

保存自定义组件必须：

1. 创建一个新的正式 Revision，而不是只写浏览器存储。
2. 通过 Workspace Server 持久化并在刷新、重启后恢复。
3. 进入正式 Catalog/Registry 读取链路，出现在 Components 面板。
4. 保留其内部结构、公开变量、Slot 和版本信息。
5. 被页面实例以稳定资产 ID 引用，并允许实例覆盖变量或向公开 Slot 提供内容。
6. 参与验证、历史恢复、导出、依赖分析和未来 migration。

组件循环引用、删除被引用资产、接口破坏性修改以及资产版本策略需要在 Schema 定稿前形成 ADR。

## 4. 默认工作区

默认桌面布局从左到右为：

```text
Left Activity Bar
Page Outline
Components
Editor
Inspector
Right Activity Bar
```

Page Outline 与 Components 默认同时出现、各占相同宽度，Components 位于 Outline 右侧。两者是独立 Panel，不以互斥 Tab 作为默认呈现。用户仍可通过 Workbench 拖动重新布局，但 Reset Layout 必须回到上述结构。

默认布局必须给 Editor 保留最大主区域；窄窗口的折叠顺序、最小宽度和 migration 由 `STUDIO-027` 验收，不能依赖浏览器自然挤压。

## 5. 共用编辑能力

页面编辑器和自定义组件编辑器必须共享以下语义：

| 能力           | 共用契约                                                   |
| -------------- | ---------------------------------------------------------- |
| Selection      | 稳定 node ID、Tree / Preview / Inspector 双向同步          |
| Reveal         | 视口外选中使用短平移，reduced motion 可降级                |
| Coordinates    | Preview rect 只在明确边界转换一次，缩放后 Overlay 精确贴合 |
| Drag/drop      | 同一 MoveTarget / InsertTarget、Slot Policy 和 Rule Engine |
| Structure Tree | 同一树模型、disclosure、键盘、搜索、自动展开和层级线       |
| Mutation       | 同一 Command → Rule → Patch → Transaction → Revision 链路  |
| Recovery       | undo/redo、History、错误反馈和重启恢复                     |

Components 卡片只作为拖拽源。普通单击可以选择或聚焦卡片，但不得插入节点或创建 Revision；键盘插入需要独立、明确的无障碍操作。

## 6. 上下文编辑菜单

页面、节点、组件、Canvas 和组件专注工作台使用同一套上下文菜单贡献模型。菜单内容必须根据触发对象及其当前能力解析，不能给所有对象展示同一份静态操作：

| 目标                | 基础操作示例                             |
| ------------------- | ---------------------------------------- |
| 页面根 / Editor Tab | 打开页面、新建页面、复制标识、关闭视图   |
| 页面或组件内部节点  | 选择、复制标识、聚焦视图、删除           |
| 注册组件            | 查看组件信息、复制标识                   |
| 已保存或自定义组件  | 编辑、复制标识、删除                     |
| Canvas 空白区域     | undo/redo、Fit Page、新建页面            |
| 组件根与命名 Slot   | 选择、复制标识及该目标实际支持的结构操作 |

呈现层统一使用 Studio UI 门面中的 Spectrum Menu，包括 Section、Submenu、图标、描述、快捷键提示、disabled、焦点管理和 Overlay 定位。领域层只提供目标描述与 capability，不直接导入 UI toolkit，也不在菜单 Registry 内复制 Studio Session 或 Command 状态。

贡献契约至少包含：

- 稳定贡献 ID、目标类型、Section 与排序。
- 基于目标状态的 `when` 条件。
- 根据 target、metadata 和 capabilities 构建菜单项的函数。
- 支持嵌套项、异步动作、disabled 状态和动态注销。

右键、键盘 Context Menu 键或 `Shift+F10` 必须走相同解析路径；关闭菜单后焦点返回触发对象。右键菜单是高效入口，不是唯一入口：关键编辑动作仍需保留可发现的按钮、Command Palette 或键盘路径。删除、移动等修改必须调用现有 Command / Rule / Revision 链路，菜单本身不得直接绕过领域规则写文档。

## 7. 非目标

- 不允许在专注工作台中执行任意代码。
- 本阶段不定义多人实时协作。
- 不把页面本身隐式转换为自定义组件。
- 不通过复制现有 Page Editor 状态和逻辑快速建立第二套互不兼容的编辑器。
- 不将临时 `localStorage` 资产格式宣布为公开项目 Schema。

## 8. 落地顺序

1. 修复 `STUDIO-004` 的缩放拖动几何，并固定组件只可拖入的交互。
2. 完成 `STUDIO-027` 默认双面板布局与 migration。
3. 为 `STUDIO-028` 定义项目级多页面 Schema、Command 和 Editor Tab 生命周期。
4. 为 `STUDIO-026` 定义自定义组件资产 Schema、接口迁移与项目持久化。
5. 抽取 Page / Component 共用的 Tree、selection、coordinates 和 drag/drop 能力。
6. 以 `STUDIO-030` 的贡献 Registry 接入各编辑目标，并验证右键、键盘、焦点和 Command 边界。
7. 在真实浏览器中完成多页面切换、自定义组件创建/复用和上下文菜单矩阵的端到端验收。
