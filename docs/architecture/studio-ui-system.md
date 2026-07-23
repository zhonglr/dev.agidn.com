# Studio UI 系统架构与迁移计划

> 状态：已确定。决策依据见 [ADR-0004](../adr/0004-studio-ui-facade-and-spectrum-to-rac.md)。本文只描述组成 Studio 操作空间的组件，不描述拖入 Preview 的用户页面组件。

> 实施进度：Gate 0 的核心依赖验证，以及 Provider、Button、TextField、Dialog、Select、SearchField 门面和 import boundary test 已落地；Settings、Export、Command Palette 已开始使用门面并按需加载。组件展示页、完整行为矩阵及 Inspector 等后续业务面迁移仍未完成。以下 Gate 是交付门槛，不代表全部已实现。

## 1. 目标与非目标

### 1.1 目标

- 当前阶段用 Spectrum 2 提供成熟的表单、Overlay、导航和集合交互。
- 业务代码只依赖 AGIDN 自己的稳定 UI 契约。
- 保留现有 `Light` / `Dark` 主题插件、国际化和 Workbench 架构。
- 产品视觉规范成熟后，在不修改业务调用的前提下逐个迁移到 RAC。
- 把键盘、焦点、触摸、验证和加载状态作为组件契约，而不是事后补丁。

### 1.2 非目标

- 不使用 Spectrum 或 RAC 渲染画布中的用户页面组件。
- 不用通用组件库替代 Dock、布局树、Canvas 坐标、Preview iframe 或 Command Engine。
- 不承诺 Spectrum 阶段能够用主题插件任意修改组件内部颜色、间距和字形。
- 不建立覆盖第三方全部 Props 的“万能 Wrapper”。
- 不为了假设中的复用提前创建新的 workspace package。

## 2. 依赖边界

```text
Studio page / feature / panel
              │
              ▼
Studio domain component
              │
              ▼
components/ui public facade
              │
       ┌──────┴──────┐
       ▼             ▼
Spectrum 2         RAC
current adapter    future adapter
```

允许的依赖方向：

```text
App / panels / features → components/ui → active toolkit
packages/studio-workbench → React + workbench domain only
Canvas / Preview → their existing protocols and domain services
```

强制规则：

- 只有 `apps/studio/src/components/ui/**` 可以导入 `@react-spectrum/s2` 或 `react-aria-components`。
- `packages/studio-workbench` 不能依赖任何具体 UI 工具库。
- UI 门面不能依赖 StudioSession、PageDocument、Command Engine 或具体 Panel。
- Studio 领域组件可以组合 UI 门面与领域状态，但不得重新导出工具库类型。
- 公共入口使用 `components/ui/index.ts`；内部 Adapter 文件不允许被业务直接导入。

边界由 `tests/contracts/module-boundaries.test.ts` 自动检查。

## 3. 目录设计

初始实现保持在 Studio 应用内：

```text
apps/studio/src/components/
├── ui/
│   ├── README.md
│   ├── index.ts
│   ├── provider.tsx
│   ├── types.ts
│   ├── button.tsx
│   ├── icon-button.tsx
│   ├── text-field.tsx
│   ├── search-field.tsx
│   ├── checkbox.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── tabs.tsx
│   ├── tooltip.tsx
│   ├── toast.tsx
│   └── internal/
│       └── spectrum/       # 只有需要隔离复杂映射时才建立
└── studio/
    ├── title-bar.tsx
    ├── activity-bar.tsx
    ├── settings-dialog.tsx
    ├── export-dialog.tsx
    ├── inspector-fields.tsx
    └── command-palette.tsx
```

目录演进规则：

1. 简单组件先在单个文件中定义公共 Props 和 Spectrum 实现，避免过度拆分。
2. 复杂组件需要多个内部文件时，移动到 `internal/spectrum/`，公共文件只保留稳定契约和导出。
3. RAC 迁移时新增对应 `internal/rac/` 实现；一个公开组件切换完成后删除其 Spectrum 实现。
4. 不通过运行时条件同时 import 两种实现。
5. 只有第二个应用或 Workbench 出现真实复用需求时，才通过新 ADR 评估 `packages/studio-ui`。

## 4. 公共组件契约

### 4.1 契约原则

每个公共组件只表达产品实际需要的语义：

- 使用 `onPress` 表达可由鼠标、触摸和键盘触发的动作。
- 使用 `isDisabled`、`isPending`、`isInvalid`、`isReadOnly` 等显式状态。
- 同时定义受控与非受控行为；同一实例不得在生命周期中切换模式。
- ref 必须指向契约承诺的可聚焦元素，不能因为更换后端而悄悄改变。
- 表单组件必须明确 `name`、提交、验证、描述和错误信息行为。
- Trigger、Overlay 和 Collection 的组合由门面定义，不能泄漏 Spectrum 的结构。
- `aria-*`、id 和必要的 `data-*` 以受控方式透传；优先通过 role/name 查询测试，不把 `data-testid` 当默认接口。

禁止：

- `extends SpectrumButtonProps` 或 `ComponentProps<typeof SpectrumButton>`。
- 在公共接口中使用 Spectrum/RAC 的 `Key`、`PressEvent`、render props 或 collection 类型。
- 直接暴露 Spectrum variant 名称。
- `...rest` 无选择地把未知业务 Props 传给第三方组件。
- 用 `any` 解决两个后端的类型差异。

### 4.2 Button 最小契约

```ts
export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";

export interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  isDisabled?: boolean;
  isPending?: boolean;
  autoFocus?: boolean;
  onPress?: () => void;
  "aria-label"?: string;
}
```

约定：

- 默认 `type="button"`，只有显式声明才参与表单提交。
- Pending 时阻止重复动作并提供可访问的忙碌状态。
- 图标按钮使用独立 `IconButton`，强制可访问名称，不通过空 children 猜测。
- 如果业务需要修饰键、触发来源等信息，定义项目自己的 `UIActionEvent`；不要直接公开第三方事件。

### 4.3 TextField 最小契约

```ts
export interface TextFieldProps {
  label: React.ReactNode;
  name?: string;
  type?: "text" | "email" | "password" | "url" | "search";
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  autoComplete?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}
```

约定：

- 可见 label 是默认要求；确实无法显示时提供专门的无障碍名称接口。
- 错误文本和 invalid 状态由同一个契约关联，不能只改变颜色。
- Number、Search、ComboBox 不通过给 TextField 增加大量模式实现，分别建立语义组件。

### 4.4 className 与布局

不在所有 Primitive 上默认开放 `className`。原因是：

- Spectrum 2 不承诺任意 class 能稳定修改内部结构。
- 外层 `<div>` 会改变 inline 布局、ref、Tooltip 锚点、表单和可访问关系。
- 业务层 Tailwind class 会让样式技术重新穿透门面。

外部间距、对齐和尺寸由父级 Studio 领域布局或专门的 `Stack`、`Inline`、`Grid` 负责。只有存在真实集成需求时，组件才可以增加定义明确的 `className` 或 slot class，并记录它作用于哪个稳定元素；不得用它覆盖组件内部设计。

## 5. Provider、主题与国际化

### 5.1 单一状态源

现有主题插件保持唯一主题选择源：

```text
theme selection: system | light | dark | installed theme id
                         │
                         ▼
RegisteredTheme.uiTheme: light | dark
                         │
                         ▼
StudioUiProvider color scheme
```

- 主题在设置中仍只显示 `Light` / `Dark` 等插件贡献名称，不显示底层实现品牌。
- `StudioUiProvider` 不保存另一份主题选择，只消费已经解析好的 `uiTheme`。
- 当前 `I18nProvider` 的 locale 同步给 UI Provider，避免日期、数字、方向和控件语言与 Studio 不一致。
- Provider 的状态组装留在应用 composition root；页面和 Panel 不直接操作 Spectrum Provider。
- Provider 的 DOM 边界服从加载边界：当 Spectrum 控件进入首屏高频界面时使用应用级 Provider；当前低频操作面由各懒加载入口建立等价 Provider，避免 Spectrum 运行时进入首屏 chunk。
- 多个懒加载 Provider 必须接收同一份已解析的 locale 和 `uiTheme`，不得各自持有主题或语言状态。

### 5.2 视觉所有权

| 区域 | Spectrum 阶段的所有者 | RAC 阶段的所有者 |
| --- | --- | --- |
| Studio Shell、Activity/Status Bar | 主题插件语义变量 | 主题插件语义变量 |
| Workbench 布局与 Dock chrome | Workbench CSS + 主题变量 | Workbench CSS + 主题变量 |
| Spectrum 控件内部 | Spectrum light/dark | 不适用 |
| RAC 控件内部 | 不适用 | AGIDN 组件 Token |
| Canvas 工作区和网格 | 主题插件语义变量 | 主题插件语义变量 |
| Preview 中用户页面 | 用户项目 Design Token | 用户项目 Design Token |

Spectrum 阶段只映射明暗模式，不把现有主题颜色强行注入 Spectrum 内部。若 Spectrum 固定视觉与 Studio chrome 的差异不可接受，应提前开始对应组件的 RAC 迁移，而不是使用不受支持的内部 CSS 覆盖。

### 5.3 CSS 边界

- 审计 `apps/studio/src/styles.css` 中的全局 element selector 和 reset。
- reset 放入低优先级 cascade layer，Studio chrome 规则尽量作用域化在 `.studio-shell`。
- 禁止覆盖 Spectrum 自动生成的内部类名、DOM 层级或私有 CSS 变量。
- RAC 阶段复用现有语义 CSS Variables；若选择 Tailwind，Tailwind 主题也必须读取这些变量，不能在业务组件中硬编码品牌颜色。

## 6. 当前组件的归属与迁移顺序

### 6.1 交给 UI 门面的组件

| 批次 | 组件 | 首批使用位置 | 风险 |
| --- | --- | --- | --- |
| P0 | Provider、Button、IconButton、Tooltip | App、Title Bar、Activity Bar | 低 |
| P1 | TextField、SearchField、NumberField、Checkbox、Switch、Select | Settings、Inspector | 低到中 |
| P2 | Dialog、AlertDialog、Toast、Progress | Export、Settings、保存与错误反馈 | 中 |
| P3 | Menu、Tabs、ComboBox、ListBox | 主菜单、Command Palette、选择器 | 中到高 |
| P4 | Tree、Table | Page Outline、History/Problems 的增强视图 | 高 |

迁移顺序以依赖和风险为准，不以自然周强制推进。每批完成后删除对应旧 CSS 和重复交互实现，不能长期保留两套默认组件。

### 6.2 保持领域自研的组件

| 组件/能力 | 原因 |
| --- | --- |
| Workbench、Split、Tab Group、Dock Overlay | 布局树、停靠和持久化是产品领域能力 |
| CanvasViewport | 具有独立坐标、缩放、iframe 和输入模型 |
| Selection/Insertion Overlay | 必须与 Preview 协议和坐标服务一致 |
| Panel/Command/Contribution Registry | 是 Studio 插件扩展边界 |
| StudioSession 和 Revision 状态 | 属于文档与服务状态，不是 UI 状态 |
| 结构拖放解析 | 必须经过 Slot、Rule 和 Command 约束 |

这些组件可以消费 Button、Tooltip、Menu 等门面组件，但第三方库不能拥有它们的状态模型。

### 6.3 特殊组件策略

**Command Palette**

- 命令注册、搜索排序、快捷键和执行仍属于 Studio。
- UI 门面可提供 Dialog、SearchField 和 ListBox。
- 迁移前后必须保持焦点进入、方向键、Enter、Escape 和关闭后焦点恢复。

**Page Outline**

- 可以验证 Spectrum Tree 对选择、展开和拖放的支持。
- 节点数据、合法落点、插入位置和 Command 生成仍由现有结构拖放层负责。
- 如果 Tree Adapter 无法表达现有跨父级移动、键盘移动或预览反馈，暂不迁移，不能为了统一外观降低能力。

**Workbench Tooltip**

- `packages/studio-workbench` 当前 Tooltip 暂时保留，避免包反向依赖应用层 UI。
- UI 门面稳定后，可让 Workbench 接收 tooltip/control renderer，或在出现第二消费者时提升 UI package；该变化需要独立设计。

## 7. 分阶段交付计划

### Gate 0：兼容性 Spike

首次执行结果见 [Studio UI Gate 00](../quality/verification/studio/2026-07-23-ui-gate-00.md)。

范围：Provider、Button、TextField、Dialog 的隔离验证，不迁移整页。

必须回答：

- React 19、Vite 7、StrictMode 和当前 TypeScript 选项能否通过开发与生产构建？
- Provider 能否正确响应 `Light` / `Dark` 与 `zh-CN` / `en-US`？
- Overlay 的 portal、z-index、焦点陷阱能否适配 Workbench？
- 当前全局 CSS 是否污染 Spectrum？
- 引入后的 JS/CSS、启动时间和交互性能变化是多少？

通过条件：构建、核心交互和主题矩阵通过；发现的问题有明确解决方案；性能变化被记录并接受。未通过时不进入大规模迁移。

### Gate 1：门面基线

- 建立 `provider.tsx`、`types.ts`、公开入口和 P0 组件。
- 启用 import boundary test。
- 建立组件展示页或 Storybook，以及测试帮助函数。
- 记录公共 Props、默认值、ref 目标和行为矩阵。

### Gate 2：基础操作面迁移

- 完成 P0、P1。
- 优先迁移 Settings、Export 和 Inspector，验证真实表单场景。
- 删除已替换的原生控件规则和重复状态 CSS。
- Workbench 与 Canvas 行为不得发生变化。

### Gate 3：Overlay 与集合迁移

- 完成 P2、P3；P4 先单独 Spike。
- 对 Overlay 增加嵌套、焦点恢复、滚动锁定和 Escape 测试。
- 对集合增加空、加载、错误、大数据、键盘选择和国际化测试。
- 对 Page Outline 使用真实拖放验收矩阵，不只做静态截图。

### Gate 4：Spectrum 稳定期

- 所有新增 Studio 操作界面只能使用门面。
- 收敛旧 CSS、原生元素例外和重复组件。
- 持续记录 bundle、交互性能、无障碍问题和 Spectrum 视觉限制。
- 不因为已经存在 RAC 迁移计划而推迟必要的业务交付。

### Gate 5：RAC 迁移启动条件

同时满足以下条件再启动：

- 品牌色、字体、密度、圆角、阴影、状态和动效规范已通过产品确认。
- Spectrum 的视觉限制已形成具体需求或性能证据。
- 待迁移组件的公共契约和行为测试完整。
- 主题语义变量足以表达新的组件 Token，或已有明确扩展方案。
- 团队接受维护自有组件在无障碍、浏览器和输入设备上的长期成本。

### Gate 6：逐组件 RAC 替换

顺序：

```text
Button / Checkbox / TextField
        ↓
Tooltip / Tabs / Dialog
        ↓
Select / Menu / ComboBox
        ↓
Tree / Table / complex collections
```

每次替换必须：

1. 保持公共 Props 和导出路径不变。
2. 运行同一组行为和视觉测试。
3. 比较 DOM/ref、表单、焦点和 Overlay 行为。
4. 删除该组件的 Spectrum Adapter。
5. 检查产物，避免同时打包无用后端。

若公共契约确实不足，先以向后兼容方式扩展，并记录迁移说明；不得要求业务批量改成 RAC 的原始 API。

### Gate 7：卸载 Spectrum

退出标准：

- 仓库中不存在运行时代码对 `@react-spectrum/s2` 的 import。
- UI 契约、主题、国际化、键盘、焦点和表单测试全部通过。
- Light/Dark × zh-CN/en-US 视觉矩阵通过。
- Workbench、Canvas、Command Palette 和 Page Outline 的 UAT 无回归。
- 删除 Spectrum Provider Adapter 和仅供 Spectrum 使用的 CSS/config。
- 比较并记录迁移前后的 bundle、LCP 和关键交互指标。
- 最后再从 `apps/studio/package.json` 和 lockfile 移除 Spectrum。

## 8. 测试和质量门槛

### 8.1 每个组件的行为矩阵

- 默认、hover、pressed、focus-visible、disabled、pending。
- 鼠标、触摸、键盘触发。
- 可访问名称、描述、错误关联和状态通告。
- 受控/非受控状态和重新渲染。
- ref/focus、表单 submit/reset。
- Light/Dark、中文/英文、长文本和 200% 缩放。
- `prefers-reduced-motion` 和高对比度适用行为。

### 8.2 分层测试

| 层级 | 目的 |
| --- | --- |
| Type/contract | 防止 Props、导出和依赖边界漂移 |
| Component interaction | 验证键盘、焦点、表单和状态 |
| Visual | 验证主题、locale、密度和 Overlay |
| Studio integration | 验证 Settings、Inspector、Palette、Outline |
| Browser UAT | 验证 Dock、Canvas、拖放和真实输入设备 |

快照不能替代交互测试。对 Tree、ComboBox、Dialog 和 Menu 必须验证行为，不只验证 DOM 存在。

### 8.3 性能基线

在 Gate 0、每个迁移批次和最终卸载时记录：

- Vite 生产构建 JS/CSS 原始值和 gzip 值。
- 首次打开 Studio 和首次打开重型 Overlay 的耗时。
- Inspector 高频输入是否产生明显卡顿。
- Tree/Table 在目标数据规模下的响应。

Spectrum 2 使用官方支持的子路径 import；是否成功 tree-shake 以构建产物为准，不凭假设判断。

## 9. 实施注意事项

1. 使用当前的 `@react-spectrum/s2`，不要根据旧教程安装 `@adobe/react-spectrum`。
2. 依赖版本由根 lockfile 统一锁定；升级 Spectrum/RAC 前先阅读 release notes 并运行完整矩阵。
3. 不复制第三方 Props，不让业务获得“临时逃生口”后永久依赖。
4. 不覆盖第三方私有 DOM 或 CSS；遇到品牌阻塞时迁移该组件到 RAC。
5. 不把 Studio UI 主题和 Preview 用户页面主题混为一谈。
6. 不让 UI 组件直接提交 Document Command；事件只向领域组件表达用户意图。
7. 不以组件数量衡量迁移完成度，以真实调用点、行为测试和删除旧实现为准。
8. 不在同一次变更里同时替换组件库、重写领域逻辑和修改交互需求。

## 10. 官方参考

- [Spectrum 2 Getting started](https://react-spectrum.adobe.com/getting-started)
- [Spectrum 2 styling](https://react-spectrum.adobe.com/styling)
- [React Aria Components getting started](https://react-spectrum.adobe.com/react-aria/getting-started.html)
- [Spectrum migration guide](https://react-spectrum.adobe.com/migrating)
- [Spectrum 2 TreeView](https://react-spectrum.adobe.com/TreeView)
