# Canvas 拖拽与布局引擎

> 状态：In Progress
> 最后更新：2026-07-24
> 适用范围：Studio Canvas、结构拖放、直接 DOM Runtime、布局预览与布局规则

本文定义 V2 Canvas 的拖拽、命中、几何、投影和提交边界。组件、Slot 和公共属性契约见
[组件系统与 Canvas 联合重构方案](./component-system-and-canvas-refactor.md)，直接 DOM 决策见
[ADR-0005](../adr/0005-studio-canvas-direct-dom-rendering.md)。

## 1. 目标

Canvas 必须满足：

- 组件、Layout 和 Pattern 使用同一插入协议。
- 拖动期间不创建 Revision，Drop 恰好创建一个 Revision。
- 被挤压或推动的节点不因异步结果、重复投影或几何过期而抖动。
- 选择、命中和边界测量来自同一份真实 DOM。
- 50%～200% 缩放与 Desktop、Tablet、Mobile 宽度下使用相同坐标模型。
- 鼠标、触控、笔和键盘最终共享同一个 Drag Controller。

不允许重新引入 iframe、Preview Host、`postMessage`、独立预览端口或旧数据兼容路径。

## 2. 运行时结构

```text
CanvasViewport
├── Canvas Surface
│   └── PageRenderer
│       └── trusted component/layout DOM
├── Interaction Overlay
│   ├── selection bounds
│   ├── insertion indicator
│   └── drag feedback
└── Drag Controller
    ├── Sensor Adapter
    ├── Geometry Snapshot
    ├── Drop Resolver
    └── Projection
```

`PageRenderer` 与 Studio 位于同一 React 树和同一 `Document`。Canvas 使用
`elementFromPoint`、`closest("[data-node-id]")`、`getBoundingClientRect` 和
`ResizeObserver` 直接完成命中与测量。页面运行时只读；正式修改仍经
`Command → Rule Engine → Patch → Project Revision`。

## 3. 三个状态层

```text
Persisted Project Revision
  PageDocument + Project Assets

Optimistic Editor Projection
  当前服务端提交等待中的本地投影

Ephemeral Drag State
  pointer、source、geometry epoch、candidate、ghost/placeholder
```

拖拽状态不得进入 PageDocument、History、导出或项目资产。取消拖动时必须能无损丢弃。

## 4. 坐标与响应式

系统只保留三个坐标空间：

```text
Viewport coordinates  浏览器 PointerEvent / DOMRect
Canvas coordinates    移除 pan/scale 后的页面内容坐标
Document order        parentId + beforeNodeId
```

所有变换由 Canvas Coordinate Service 提供：

```ts
interface CanvasCoordinateService {
  viewportToCanvas(point: Point): Point;
  canvasToViewport(point: Point): Point;
  canvasRectToViewport(rect: Rect): Rect;
}
```

DOMRect 已经是 Viewport 坐标，不能重复乘 scale。Canvas 的响应式断点由 Artboard 宽度和
CSS Container Query 决定，不读取 Studio 顶层 viewport 宽度。

## 5. 插入源

```ts
type InsertSource =
  | { kind: "component"; componentRef: string; presetId?: string }
  | { kind: "layout"; layoutKind: LayoutKind }
  | { kind: "pattern"; patternRef: string };
```

- Component 生成一个组件节点。
- Layout 生成一个合法的布局节点。
- Pattern 解析为多个有序根节点，但只提交一次原子事务。
- 拖拽载荷只保存稳定引用；节点 ID 在 Drop 前由 Node Factory 一次性生成。

## 6. Geometry Snapshot

目标结构：

```ts
interface GeometrySnapshot {
  epoch: number;
  documentRevision: number;
  canvasScale: number;
  nodes: Record<NodeId, {
    rect: Rect;
    parentId?: NodeId;
    depth: number;
  }>;
  zones: Array<{
    id: string;
    parentId: NodeId;
    slot?: string;
    rect: Rect;
    layout: "stack" | "row" | "grid" | "slot";
    items: Array<{ nodeId: NodeId; rect: Rect }>;
  }>;
}
```

每次布局、断点、内容高度、节点树或 scale 改变时递增 `epoch`。Resolver 只能消费当前
Revision 和当前 epoch；过期结果直接丢弃。空 Layout 与空 Slot 必须提供最小可命中区域。

当前直接 DOM 实现已经使用同步 DOM 命中和选择边界；完整批量 Snapshot 与显式 Slot Zone
仍是 P1 工作。

## 7. Drop Resolver

Resolver 是框架无关纯函数，输入：

- 当前 Tree Index。
- Geometry Snapshot。
- InsertSource 或现有节点 source。
- 指针 Canvas 坐标。
- Component / Slot / Layout 合同。

输出：

```ts
interface DropCandidate {
  parentId: NodeId;
  slot?: string;
  beforeNodeId?: NodeId;
  depth: number;
  confidence: number;
  epoch: number;
}
```

解析顺序：

1. 找到指针下最深的显式 Zone。
2. 使用 Registry 与 Layout Policy 过滤非法目标。
3. Stack/Row 按主轴中点排序；Grid 使用行聚类后进行二维排序。
4. Section/Container 深层命中失败时回退到最近合法祖先集合。
5. 对现有节点移动排除自身子树，禁止循环。
6. 候选未跨越稳定阈值时保持上一候选，减少边界抖动。

最终 Drop 必须再次由 Rule Engine 验证。Resolver 的“可预览”不能绕过正式规则。

## 8. 投影与防抖

当前实现使用受控 Canvas Ghost 生成临时文档投影，已经具备：

- 同一候选去重。
- 同一候选不重复生成投影。
- 移动源在投影中隐藏，避免双影。
- 正式 Revision 到达后稳定交接。

目标实现使用局部 Placeholder/Projection：

```text
Canonical DOM
  + one placeholder at candidate
  + transform-only displacement for affected siblings
```

约束：

- 不在每个 pointer move 克隆整份 PageDocument。
- 不为未受影响节点生成 transform。
- 新 candidate 只覆盖同 epoch 的旧 candidate。
- Placeholder 尺寸来自 source geometry 或节点类型最小尺寸。
- 尊重 `prefers-reduced-motion`；关闭动效时位置仍必须稳定。

## 9. Sensor

当前 HTML5 DnD 仅作为过渡输入适配器。目标 Pointer Sensor：

- pointer capture 管理完整生命周期。
- 鼠标达到距离阈值后开始；触控使用短延迟加距离容差。
- 笔输入复用 pointer pressure/type 信息，但不改变领域协议。
- Escape 取消；失去 capture、窗口 blur 和 source 删除都能可靠清理。
- 自动滚动只作用于当前 Canvas scroll container。

键盘 Sensor 产生相同的 `DropCandidate` 与提交命令，并通过 live region 反馈目标与结果。

## 10. 提交

```text
pointer up
  → freeze current candidate
  → verify candidate epoch
  → build one command/transaction
  → optimistic projection
  → Workspace Server validation
  → one Project Revision
  → clear ephemeral drag state
```

提交期间禁止第二次处理同一 drag session。服务端拒绝时恢复 canonical revision，并把错误定位
到 source 与 target；不得留下 ghost、隐藏 source 或半完成 Pattern。

## 11. 模块职责

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| `layout-engine` | Tree Index、Zone/Geometry 输入、Drop Policy、排序与深度 | React、DOM、持久化 |
| `studio/canvas` | DOM 采集、Sensor、Overlay、投影与反馈 | 绕过 Command 修改项目 |
| `react-renderer` | 确定性只读渲染和稳定 `data-node-id` | 拖拽状态、Workbench |
| `component-registry` | Slot、Props、Variant 和可接收类型合同 | DOM 几何 |
| `rule-engine` | 最终合法性与修复建议 | pointer 热路径 |
| `command-engine` | 原子 Insert/Move/Pattern 事务 | 逐帧投影 |
| `workspace-server` | Project Revision、冲突、持久化 | 浏览器手势 |

## 12. 实施顺序

### D0：直接 DOM 边界（已完成）

- 删除 Preview Host、iframe、跨窗口协议和 `4174` 端口。
- Studio 内挂载 PageRenderer。
- 直接 DOM 命中、选择、边界和内容高度。
- CSS Container Query 响应式画布。

### D1：稳定过渡路径（已完成）

- Layout Engine 的 Tree Index、Drop Policy、二维 Grid 排序与深度安全。
- Canvas Ghost 去重与同步 DOM 命中。
- 17 个插入源真实 Chrome E2E，每次 Drop 一个 Revision。

### D2：完整 Geometry

- Epoch Snapshot、显式 Slot Zone、空容器命中面。
- 嵌套边缘与快速跨目标稳定性。

### D3：Pointer 与局部投影

- Pointer/Touch/Pen Sensor。
- 局部 Placeholder、受影响 sibling transform 和自动滚动。
- 删除 HTML5 DnD 与整文档 Ghost 热路径。

### D4：可访问性与验收

- 键盘 Sensor 与 live region。
- 50%～200% 和三断点浏览器矩阵。
- 长列表、深层嵌套、快速移动、取消、服务拒绝和刷新回归。

## 13. 退出条件

- 无 iframe、Preview Host、跨窗口消息或独立预览服务。
- 空项目可拖出 Section → Container → Stack/Grid → Component。
- 组件、Layout、Pattern 和现有节点移动共享一个 Resolver。
- 拖动期间 Revision 不变；Drop 成功只增加一个 Revision。
- 被挤压节点没有来回跳动、迟到回滚或双影。
- 取消、失败和冲突后 DOM、选择与 Project Revision 完全一致。
- 自动化覆盖鼠标基础路径；正式 UAT 覆盖触控板、缩放、三断点和视觉稳定性。
