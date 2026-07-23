# Studio Workbench 架构

> 状态：已确定，作为 M4 Studio 的实施基线。页面领域架构见 [系统架构](./system-overview.md)，通用操作组件与组件库迁移见 [Studio UI 系统](./studio-ui-system.md)，关键决策见 [ADR-0003](../adr/0003-studio-workbench-and-canvas-viewport.md)。

## 1. 目标

Studio 是面向长时间、高频编辑的专业生产力工具，不是固定三栏的演示页。它必须同时满足：

- 画布始终是最主要的工作区。
- 每个面板的位置、尺寸、可见性和标签组合可由用户控制。
- 布局可持久化、恢复、重置和切换预设。
- 画布平移与缩放不影响 Studio 工具栏、面板和文字。
- 架构预留受控扩展点，但插件不能绕过 Command、Rule Engine 和 Revision。
- 高频操作常驻；Token、Registry、Policy 等低频全局配置进入独立页面或对话框。

Workbench 布局只属于 Editor State，不能进入 PageDocument。

## 2. 总体结构

```text
Studio Application
├── Workbench Shell
│   ├── Activity Bar
│   ├── Menu / Command Bar
│   ├── Data-driven Layout Tree
│   │   ├── Split Groups
│   │   ├── Tab Groups
│   │   └── Panel Hosts
│   ├── Status Bar
│   └── Modal / Route Host
├── Panel Registry
├── Command Registry
├── Contribution Registry
├── Layout Persistence
└── Canvas Workbench Panel
    └── Canvas Viewport
        ├── Interaction Overlay
        └── Sandboxed Preview iframe
```

Workbench Shell 只管理编辑器工作区；PageDocument 的读取、命令、验证和版本由现有领域链路负责。

## 3. 数据驱动布局

### 3.1 布局树

面板不得以固定 `left / center / right` JSX 结构作为事实来源。布局由可版本化的树表达：

```ts
type WorkbenchLayoutNode =
  | {
      type: "split";
      id: string;
      direction: "horizontal" | "vertical";
      sizes: number[];
      children: WorkbenchLayoutNode[];
    }
  | {
      type: "tabs";
      id: string;
      activePanelId: string;
      panelIds: string[];
    }
  | {
      type: "panel";
      id: string;
      panelId: string;
    };

interface WorkbenchLayoutState {
  version: "1.0.0";
  root: WorkbenchLayoutNode;
  hiddenPanelIds: string[];
  maximizedPanelId?: string;
}
```

`sizes` 使用容器内比例，不使用绝对屏幕坐标。恢复布局时必须根据面板最小/最大尺寸和当前窗口重新约束。

### 3.2 面板注册

```ts
interface PanelContribution {
  id: string;
  title: string;
  icon?: string;
  defaultLocation: "primary" | "secondary" | "bottom" | "center";
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  canClose: boolean;
  canMove: boolean;
  canDock: boolean;
  render: () => React.ReactNode;
}
```

每个面板必须使用稳定 `panelId`。内置面板与未来插件面板使用同一注册机制，不在 Shell 中为单个业务面板写分支。

### 3.3 必需交互

- 水平和垂直 Split 可任意嵌套。
- 拖动分隔条时实时改变面板尺寸。
- 面板可拖到左、右、下方、中央或现有 Tab Group。
- 多个面板可合并为标签页。
- 区域可折叠，面板可关闭并从命令面板重新打开。
- 画布可最大化，但不丢失恢复前布局。
- 布局变更可通过键盘完成，分隔条必须可聚焦并支持方向键。

### 3.4 持久化

持久化分为三层：

```text
内置 Default Layout        代码提供，只读兜底
User Layout Profile       用户个人布局和面板可见性
Workspace Session State   项目级打开页面、画布位置和面板上下文
```

布局状态必须有独立版本和 migration。面板被移除或插件未加载时，布局恢复必须能忽略失效节点并回退到合法结构。

## 4. 信息架构

### 4.1 常驻高频操作

- 画布、当前选中和节点层级。
- 核心 Props、Variant、布局与响应式属性。
- undo / redo。
- 当前断点、缩放和画布适配。
- 当前操作的规则错误和可恢复反馈。

### 4.2 非常驻配置

以下功能通过独立 Route、大型 Modal 或按需打开的工具面板提供：

- Token 集合、主题和模式管理。
- Component Registry 与 Pattern Registry 管理。
- Policy、Constraint、Data Source 和 Action 配置。
- 导出配置、项目设置和快捷键。
- 完整 Revision History 和变更审查。

任何低频配置都不得仅因为已经存在面板容器就长期占用画布空间。

### 4.3 专业工具基线

- Command Palette 可查找命令、面板、页面和设置。
- 所有高频命令可绑定快捷键，并检测冲突。
- 键盘焦点、屏幕阅读器标签和高对比度是首版基础能力。
- 长任务、保存、验证和冲突必须有稳定状态位置，不只依赖短暂 Toast。
- 面板空状态、加载、错误、重试和恢复行为必须一致。

## 5. Canvas Viewport

### 5.1 层级边界

```text
Canvas Panel                   不缩放
├── Canvas Toolbar             不缩放
└── Viewport                    固定可见窗口
    ├── Grid / Background       视口装饰
    ├── Preview Surface         只对此层平移和缩放
    │   └── sandboxed iframe
    └── Interaction Overlay     选框、辅助线、拖放提示
```

不得通过浏览器缩放、顶层 `zoom` 或 Studio 根节点 `transform` 实现画布缩放。只有 Preview Surface 和与它对齐的 Interaction Overlay 参与坐标变换。

### 5.2 视口状态

```ts
interface CanvasViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  breakpoint: "mobile" | "tablet" | "desktop";
}
```

状态属于 Workspace Session，不属于 PageDocument，也不创建 Document Revision。

### 5.3 变换与输入

Preview Surface 使用单一变换：

```css
transform: translate(var(--canvas-x), var(--canvas-y)) scale(var(--canvas-scale));
transform-origin: 0 0;
```

必须支持：

- 触控板双指平移。
- 触控板 pinch 与 `Ctrl/Command + Wheel` 缩放。
- 以指针所在的画布坐标作为缩放中心。
- `Space + Pointer Drag` 和中键平移。
- `100%`、Fit Page、Fit Selection 和预设缩放级别。
- 可配置但受限的最小/最大缩放值。
- 用户输入期间使用 `requestAnimationFrame` 合并更新，不因每个 wheel event 重渲染整个 React 树。

项目仍不提供使用任意坐标布置页面内容的“无限画布”。视口可平移和缩放，页面内容仍由受控 Layout Policy 布局。

### 5.4 坐标系

系统必须提供单一 Canvas Coordinate Service：

```ts
screenToCanvas(point: Point): Point;
canvasToScreen(point: Point): Point;
previewRectToScreen(rect: Rect): Rect;
```

iframe 返回的节点边界使用 Preview 内容坐标。Selection Overlay、Insertion Indicator、辅助线和命中测试必须经过同一服务转换，不得在各功能内重复计算 scale 和 offset。

### 5.5 浏览器默认行为

- 只在指针位于 Canvas Viewport 且符合手势时拦截 wheel/pinch。
- 编辑器其他面板保留正常滚动与浏览器无障碍行为。
- 文本输入、下拉框和可编辑组件获得焦点时，画布快捷键必须暂停。
- 尊重 `prefers-reduced-motion`，Fit 动画可被关闭。

## 6. Preview 隔离与通信

Studio 和 Preview Host 使用 sandboxed iframe 和带版本的 `postMessage` 协议。协议至少包含：

```text
Studio → Preview
  preview.initialize
  preview.setDocument
  preview.setBreakpoint
  preview.setSelection

Preview → Studio
  preview.ready
  preview.nodePointerDown
  preview.nodeBounds
  preview.renderError
  preview.contentOverflow
```

每条消息包含 `protocolVersion`、`requestId`、`documentRevision` 和明确来源。Studio 必须校验 `origin`、消息 Schema 和 Revision，并忽略过期边界数据。

Preview 不能直接修改 PageDocument。点击和拖放仅回传用户意图，Studio 生成 Command 后交由 Workspace Server 提交。

## 7. 扩展与插件基础

### 7.1 首版扩展点

```ts
interface StudioPlugin {
  id: string;
  version: string;
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
  contributions?: {
    panels?: PanelContribution[];
    commands?: CommandContribution[];
    inspectors?: InspectorContribution[];
    routes?: RouteContribution[];
    statusItems?: StatusItemContribution[];
  };
}
```

首版只需建立内部 Contribution Registry 和稳定接口，不开放第三方市场和任意代码加载。内置功能应优先通过这些扩展点接入，用于验证接口是否可用。

### 7.2 权限边界

扩展可以：

- 读取受控的当前选择、Catalog 和验证结果。
- 注册面板、命令、Inspector 区块和工具页。
- 向系统提交已注册的 Document Command。

扩展不可以：

- 直接替换或修改 PageDocument。
- 访问 Workspace Server 未授权文件。
- 绕过 Rule Engine、Revision 或协议验证。
- 向 PageDocument 注入 Studio 临时状态。

## 8. 状态与性能边界

```text
Document Projection    当前正式/乐观 PageDocument 投影
Workbench State        面板树、尺寸、可见性和活动标签
Canvas State           scale、offset、breakpoint、selection overlay
Panel Local State      树展开、搜索、表单草稿
Remote State           Catalog、History、Validation 和后台任务
```

五类状态不得合并为单一巨型 Store。高频 Canvas 变换必须避免使 Panel Tree 和 Inspector 重渲染；面板拖动也不得触发 Document Revision。

## 9. 推荐模块

```text
apps/studio/src/
├── app/
├── workbench/
│   ├── layout-model.ts
│   ├── layout-controller.ts
│   ├── panel-registry.ts
│   ├── contribution-registry.ts
│   ├── command-registry.ts
│   ├── persistence.ts
│   └── components/
├── canvas/
│   ├── canvas-viewport.ts
│   ├── coordinate-service.ts
│   ├── gesture-controller.ts
│   ├── preview-bridge.ts
│   └── interaction-overlay.tsx
├── panels/
├── routes/
├── plugins/
└── state/

packages/
├── studio-workbench/       可复用布局模型和容器
├── studio-plugin-api/      稳定 Contribution 类型与受控 API
└── preview-protocol/       Studio/Preview 运行时验证协议
```

只有出现第二个消费者或需要独立契约测试时，才将对应能力拆成 package；初始实现可先位于 `apps/studio/src`。

## 10. 实施阶段

### W0：Workbench 契约

- 布局树 Schema、面板注册和 migration 边界。
- Command Registry 与快捷键冲突规则。
- Contribution Registry 和内置扩展点。

### W1：可编排 Shell

- 嵌套 Split、Tab Group、Panel Host、分隔条与折叠。
- 面板移动、停靠、关闭、最大化和布局恢复。
- Activity Bar、Command Palette、Status Bar 和键盘导航。

### W2：Canvas Viewport

- 画布独立缩放、平移、Fit 命令和触控板手势。
- 统一坐标转换服务和交互 Overlay。
- 高频输入性能基线。

### W3：Preview 隔离

- sandboxed iframe、版本化 `postMessage` 和运行时校验。
- 节点命中、边界回传、错误边界和崩溃恢复。

### W4：首个编辑闭环

- 页面结构面板、选中同步和属性 Inspector。
- 修改 Text / Heading Prop。
- Command 提交、乐观投影、Revision 确认/回滚和 undo/redo。

### W5：结构编辑

- 合法 Slot 拖放、插入、移动和排序。
- Variant、Token、Layout 和 Responsive Inspector。
- 规则错误、修复建议、导出和完整 E2E。

## 11. 验收基线

### Workbench

- 用户可调整每个区域的尺寸，重启后正确恢复。
- 面板可移动、停靠、合并标签、折叠和重新打开。
- 失效插件或旧布局不能阻止 Studio 启动。
- 高频工作区不被 Token 管理等低频配置长期占用。

### Canvas

- 触控板缩放只影响画布，Studio Chrome 保持原尺寸。
- 指针中心缩放后，指针下的画布点保持不变。
- 任意缩放和平移下，Selection Overlay 与 iframe DOM 边界保持对齐。
- 画布手势不破坏 Inspector、树和对话框的正常滚动。
- 高频平移/缩放不触发文档 Revision，不重渲染无关面板。

### 扩展

- 内置面板通过 Panel Registry 注册，不写死在 Shell。
- 测试扩展可注册一个面板、一个命令和一个 Inspector 区块。
- 扩展只能提交受控 Command，无法直接写入 PageDocument。

## 12. 非目标

- 首版不建设公开插件市场、远程插件安装和任意代码权限系统。
- 首版不复刻 JetBrains 的全部 IDE 功能，但工作区可编排、键盘可达和状态可恢复是产品基线。
- 画布视口支持平移和缩放，但不允许页面内容脱离受控布局并使用任意坐标。
