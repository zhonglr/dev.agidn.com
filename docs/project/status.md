# 当前实现状态

> 最后更新：2026-07-24

## 当前结论

> 验收提醒：2026-07-23 的首轮 Studio UAT 已确认 17 项未关闭问题。下文“已完成”表示代码基线已存在，不表示用户验收通过。详见 [Studio Issue 台账](../quality/issues.md)。

> 第二轮 UAT 进一步确认已有节点移动、Tree 拖动、Tooltip 时序、variant 视觉覆盖和 Dock Overlay 仍未达到产品验收，详见 [Studio 第二轮 UAT](../quality/uat/2026-07-23-studio-round-02.md)。

> 第三批反馈已完成对应开发改动，但尚未形成正式 Round 03 UAT。插入、移动和 Slot 反馈归并到 `STUDIO-004`，Dock 及新增能力由 `STUDIO-018～025` 跟踪；功能项等待复验，视觉和交互项仍为 In Progress。详见 [Studio Issue 台账](../quality/issues.md)。

> 第四批反馈继续作为 Issue intake，而不是无固定基线的 UAT：Outline 视口聚焦与组件拖放更新 `STUDIO-002`、`STUDIO-004`；自定义组件专注编辑、默认双面板布局、多页面模型和 Command Palette / Overlay 由 `STUDIO-026～029` 跟踪。产品边界见 [Studio Authoring Model](../product/studio-authoring-model.md)。

> 后续新增的右键编辑菜单由 `STUDIO-030` 跟踪：目标感知的 Spectrum Menu、贡献 Registry 和主要编辑 Surface 已接入，当前为 `Ready for Verification`，仍需完整键盘与浏览器布局矩阵。

> Cycle 边界：[C01 — Studio Foundation & First UAT](./cycles/c01.md) 已在 `9bece1d` 关闭，状态为 `Closed with carryover`，产品验收为 `Not accepted`。

项目已经完成可运行的无界面内核、具备本地持久化的 Workspace Server、React Renderer，以及可编排的 Studio Workbench 代码基线。Canvas 现在由 Studio 直接渲染原生 DOM；旧 Preview Host、iframe、跨窗口协议和独立 `4174` 进程已经删除。布局树、面板停靠和独立 Canvas Viewport 均已存在，但首轮 UAT 确认的布局恢复与视觉一致性缺陷仍需继续复验。

数据驱动 Inspector 已覆盖 Registry Props、Variant、Token Binding、Placement、Visibility、Interaction 和 Accessibility；所有修改都通过 V2 Command → Rule → Patch → Revision。代码门禁已覆盖，但仍需下一次正式真实浏览器 UAT，因此完整编辑闭环当前仍视为未验收。乐观更新/失败回滚、面板折叠和布局 migration 尚未完成。

Canvas 拖拽重建已完成稳定性阶段：框架无关的 `@agidn/layout-engine` 已接管 Tree Index、Drop Policy、节点/Geometry 目标解析、Wrapped Grid 二维排序和安全深度判断；直接 DOM 同步命中、同候选 Ghost 去重和规范布局解析消除了跨窗口迟到响应与受挤压节点的往返抖动。Pointer Sensor、完整 Geometry Snapshot 和局部 Projection 仍未完成。

Components 面板现在提供 9 个 Foundation Primitive、1 个 Project Composite、6 个 Layout 和 1 个 Pattern。Composite Definition 会合成到活动 Registry，实例可通过公开 Prop/Slot/Variant 驱动私有模板，同时在 Canvas 中保持单一可选中边界。严格的 `component | layout | pattern` 插入源已接入 Outline/Canvas Drop、Canvas Ghost 和 Revision；Pattern 支持多根有序投影、统一目标校验和原子提交，Section 与 Container 在深层命中时会回退到最近合法祖先集合。隔离启动的真实 Chrome E2E 已覆盖全部 17 个插入源、无 Preset、搜索、服务离线、空 Registry，以及创建、选择、修改、移动、删除、undo、redo、刷新恢复和拒绝回滚；每次 Drop 恰好产生一个 Revision。`P0 Blocker` 现在只剩正式 Round 03 人工验收。

## 已完成功能

| 领域                       | 已完成能力                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace                  | pnpm workspace、TypeScript ESM、单一 lockfile                                                                                                                                                                          |
| PageDocument               | TypeBox Schema、运行时验证、严格未知字段检查、稳定序列化                                                                                                                                                               |
| Foundation Project         | 从零建立的 V2 Page、9 个 Primitive、Token、Policy、Action、Constraint、Composite 与 Pattern Fixture                                                                                                                   |
| Component Registry         | 9 个 Primitive 与项目 Composite 合成的活动 Definition V2；项目文件仍保持 Primitive、Composite 和 Pattern 类型边界                                                                                                    |
| Rule Engine                | 任意样式、原始颜色/间距、绝对定位、注册引用、Slot、响应式、Overlay、无障碍和布局规则                                                                                                                                   |
| Command Engine             | Insert、Move、Remove、Set Prop/Variant/Style Binding/Responsive Policy/Role/Name/Placement/Visibility/Accessibility/Interactions 和受控布局属性                                                                        |
| Patch                      | 基于 Node ID 的 Insert、Move、Remove 和 Update 操作                                                                                                                                                                    |
| Document Engine            | 原子事务、baseRevision 冲突检测、重复 Command ID 拒绝、Revision 历史                                                                                                                                                   |
| Undo/Redo/Restore          | 撤销、重做和历史恢复均创建新的单调 Revision；恢复操作本身可撤销                                                                                                                                                        |
| Context Exporter           | 八文件导出（含正式项目资产）、引用裁剪、稳定 JSON 和 SHA-256 内容 Hash                                                                                                                                                |
| CLI                        | `validate`、`apply`、`export`                                                                                                                                                                                          |
| Workspace Server           | Document 与 Project 查询、History、Catalog、混合 Command、undo/redo、历史恢复和 Revision Export HTTP API                                                                                                                |
| Revision Store             | Project `3.0.0` 完整快照、运行时与不变量校验、原子文件替换、串行写入和服务重启恢复；精确拒绝旧 Document-only 状态                                                                                                      |
| API Protocol               | Document/Asset 混合事务与完整 Project Revision 的版本化请求/响应 Schema、400/409/422 错误边界                                                                                                                          |
| Workspace 配置             | Component、Token、Action、Policy、Constraint 和 Project Assets JSON 运行时校验                                                                                                                                         |
| React Renderer             | PageDocument、Token、受控布局和 Composite 公开绑定到 React 的确定性渲染；Composite 私有模板不暴露为 Canvas 选择节点                                                                                                  |
| Canvas Runtime             | Studio 内直接挂载 React Renderer、9 个 Primitive Runtime、项目 Composite Runtime 和基于容器宽度的 Desktop/Tablet/Mobile 响应式页面                                                                                    |
| Studio Workbench           | 版本化布局 Schema、Panel/Command/Contribution Registry、嵌套 Split/Tab/Panel、可访问分隔条、紧凑 Dock compass、几何预览、标签合并和布局持久化                                                                          |
| Canvas Viewport            | 独立平移/缩放、触控板手势、`100%`、Fit Page / Selection、选中 Overlay、已有节点拖动、统一坐标转换服务；Layout Engine 第一阶段已接入，Drop Projection 可稳定交接正式 Revision                                         |
| Editing Slice              | 动态 Page Outline、画布/大纲选中同步、Registry Inspector、9 个 Primitive 与 6 个 Layout 插入/移动、Revision 确认、undo/redo 和 History 恢复                                                                           |
| Project Assets             | 正式 Composite/Pattern Schema、公开 Prop/Slot/Variant binding、循环/ID 冲突防护、活动 Registry 合成、实例 Runtime、Workspace 加载、Catalog/Export、Pattern 多根拖拽/单 Revision 展开，以及严格 Asset Command/Patch；PageDocument + Assets 已进入 `3.0.0` 项目 Revision、History、undo/redo/restore、原子持久化和严格 HTTP API |
| Multi-page Studio          | 已有多个页面根、新建页面入口、独立 Editor Tab、同一 Canvas DOM 内无加载切换和刷新恢复；正式 Workspace Server 仍为单 PageDocument                                                                                       |
| Studio UI 基础             | 类型安全 i18n、Catalog display metadata、Theme Plugin Registry，Provider / Button / TextField / Dialog / Select / SearchField / Context Menu 门面，目标感知的菜单贡献 Registry、低频操作面按需加载与第三方 import 边界 |
| Tests                      | 全仓契约、规则、渲染、Project Assets、Layout Engine、Canvas Ghost、i18n、UI 门面、结构拖动、Canvas Runtime、事务、持久化恢复和 HTTP 集成测试                                                                          |

## 已支持 Command

```text
node.insert
node.move
node.remove
node.setLayoutProperty
node.setProp
node.setName
node.setVariant
node.setStyleBinding
node.setResponsivePolicy
node.setRole
node.setPlacement
node.setVisibility
node.setAccessibility
node.setInteractions
asset.composite.upsert
asset.pattern.upsert
asset.remove
```

所有 Command 都必须携带 `commandId` 和 `protocolVersion`，并经过：

```text
Command Schema → Handler → Rule Engine → Patch → Transaction → Revision
```

## 已支持 HTTP API

```text
GET  /v1/project
GET  /v1/project/history
GET  /v1/catalog
POST /v1/project/commands
POST /v1/project/undo
POST /v1/project/redo
POST /v1/project/history/restore
POST /v1/export
```

详见 [Workspace Server API](../api/workspace-server.md)。

## 当前可运行命令

```bash
pnpm typecheck
pnpm test
pnpm test:e2e:studio
pnpm build
pnpm lint
pnpm format
pnpm studio:build
pnpm dev

pnpm ui validate examples/foundation/page.ui.json
pnpm ui apply examples/foundation/page.ui.json examples/foundation/commands/insert-text.json
pnpm ui export examples/foundation/page.ui.json

pnpm workspace-server examples/foundation/page.ui.json 4178
```

## 尚未完成

完整活动清单及优先级见[V2 重构 TODO](./todo.md)。

- Data Source / Binding Schema 及完整引用验证。
- Canvas 组件级错误隔离、重试控件和更完整的运行时诊断。
- Workbench 面板折叠、完整键盘停靠命令和布局 migration。
- 更完整的键盘跨父级移动、拖动自动滚屏和乐观状态回滚。
- Canvas Pointer Sensor、Geometry Snapshot、局部 Placeholder/Projection、碰撞推挤和旧 ghost 热路径移除。
- 缩放后的拖动蓝色边框已改为视口坐标层，仍需完成 50%～200% 真实浏览器矩阵复验。
- 多页面仍使用 Studio 本地页面模型，尚未进入 Workspace Server 项目级 Schema。
- Composite/Pattern 已进入正式项目读写模型；Studio、Catalog、Export 和 Workspace Server 统一使用项目级 Revision、History、原子持久化与 HTTP API。Document-only Store/API 已删除；影响分析和专注编辑器仍需补齐。
- Workspace Server 的独立 Validation 和 WebSocket API。
- 全仓 Prettier 格式基线、`format:check`、CI 和正式 Commit 规范自动化。
- Studio UI 门面的组件展示页、完整行为矩阵和后续业务面迁移。
- 上下文菜单已完成 Outline、组件卡片和 Canvas 节点 Chrome 冒烟，仍需 Light/Dark、键盘、缩放和停靠布局矩阵。
- MCP；按产品计划后置。

## 实施阶段

| 阶段                        | 状态                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------- |
| M0 领域资产                 | 部分完成                                                                              |
| M1 无界面内核               | 大部分完成                                                                            |
| M2 Workspace Server         | 核心服务、HTTP API 和本地 Revision 持久化已完成，WebSocket 未完成                     |
| M3 React Renderer / Canvas | 确定性 Renderer、直接 DOM Canvas 和响应式 Foundation Page 已完成                         |
| M4 Studio                   | Workbench、编辑闭环、本地多页面、Project Asset 读写内核和上下文菜单已有代码基线；Studio Project API 切换/专注编辑尚未完成，Round 01/02 均未通过验收 |
| M5 完整导出闭环             | 指定正式 Revision 的可重复导出 API 已完成                                             |
| M6 MCP                      | 未开始                                                                                |

## 下一步顺序

1. 创建并执行正式 Studio UAT Round 03，清零[V2 重构 TODO](./todo.md)中最后一个 `P0 Blocker`。
2. 实现复用 Canvas/Inspector 的 Composite 专注编辑器和资产影响分析。
3. 按 [Canvas 拖拽与布局引擎重建设计](../architecture/canvas-drag-layout-engine.md)实现 Geometry Snapshot、Pointer Sensor、局部 Projection 和自动滚动。
4. 将多页面升级为 Workspace 项目模型，再推进 Inspector/Rule、图标系统和能力包。
