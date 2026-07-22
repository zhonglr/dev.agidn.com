# 当前实现状态

> 最后更新：2026-07-23

## 当前结论

> 验收提醒：2026-07-23 的首轮 Studio UAT 已确认 17 项未关闭问题。下文“已完成”表示代码基线已存在，不表示用户验收通过。详见 [Studio 验收问题追踪](./STUDIO_ISSUE_TRACKER.md)。

> 第二轮 UAT 进一步确认已有节点移动、Tree 拖动、Tooltip 时序、variant 视觉覆盖和 Dock Overlay 仍未达到产品验收，详见 [Studio 第二轮验收问题追踪](./STUDIO_UAT_ROUND_2_ISSUES.md)。

> 第三轮反馈已完成开发整改：新增插入位置预览、可靠的 Outline 移动、Button 内部 Slot、可复用组件保存、Revision 恢复、Display Label、组件分组、基础 i18n、树引导线、Dock 发现性和环绕式工具窗口栏；等待真实交互复验。详见 [Studio 第三轮验收整改记录](./STUDIO_UAT_ROUND_3_ISSUES.md)。

> Cycle 边界：[C01 — Studio Foundation & First UAT](./cycles/c01/README.md) 已在 `9bece1d` 关闭，状态为 `Closed with carryover`，产品验收为 `Not accepted`。

项目已经完成可运行的无界面内核、具备本地持久化的 Workspace Server、React Renderer / Preview Host，以及可编排的 Studio Workbench 代码基线。布局树、面板停靠、独立 Canvas Viewport 和版本化 Preview 消息协议均已存在，但首轮 UAT 确认了选择链路、布局恢复和视觉一致性缺陷。

Heading / Text Inspector、Revision 提交、undo/redo、结构拖放和组件 Slot 插入已有实现，但仍需第三轮真实浏览器 UAT，因此首个完整编辑闭环当前仍视为未验收。乐观更新/失败回滚、面板折叠和布局 migration 尚未完成。

## 已完成功能

| 领域 | 已完成能力 |
| --- | --- |
| Workspace | pnpm workspace、TypeScript ESM、单一 lockfile |
| PageDocument | TypeBox Schema、运行时验证、严格未知字段检查、稳定序列化 |
| Golden Page | SaaS Pricing Page、Token、组件定义、Policy、Action、Constraint |
| Component Registry | 15 个组件的 `*.ui.ts` 注册定义、Props、Slots、Variants 和 States |
| Rule Engine | 任意样式、原始颜色/间距、绝对定位、注册引用、Slot、响应式、Overlay、无障碍和布局规则 |
| Command Engine | Insert、Move、Remove、Set Prop、Set Variant、Set Token、Set Responsive Policy、Set Role 和受控布局属性 |
| Patch | 基于 Node ID 的 Insert、Move、Remove 和 Update 操作 |
| Document Engine | 原子事务、baseRevision 冲突检测、重复 Command ID 拒绝、Revision 历史 |
| Undo/Redo/Restore | 撤销、重做和历史恢复均创建新的单调 Revision；恢复操作本身可撤销 |
| Context Exporter | 七文件导出、引用裁剪、稳定 JSON 和 SHA-256 内容 Hash |
| CLI | `validate`、`apply`、`export` |
| Workspace Server | Document、History、Catalog、Command、undo/redo、历史恢复和 Revision Export HTTP API |
| Revision Store | `1.0.0` 持久化格式、运行时校验、原子文件替换、串行写入和服务重启恢复 |
| API Protocol | 版本化请求/响应 Schema、400/409/422 错误边界 |
| Workspace 配置 | Component、Token、Action、Policy 和 Constraint JSON 运行时校验 |
| React Renderer | PageDocument、Token 和受控布局到 React 的确定性渲染 |
| Preview Host | Vite 独立预览端、15 个 React 组件和 Desktop/Tablet/Mobile 响应式页面 |
| Preview Protocol | 版本化、严格运行时验证的 document / breakpoint / selection / hit-test / bounds / insert-drop / existing-node-move / error 消息 |
| Studio Workbench | 版本化布局 Schema、Panel/Command/Contribution Registry、嵌套 Split/Tab/Panel、可访问分隔条、紧凑 Dock compass、几何预览、标签合并和布局持久化 |
| Canvas Viewport | 独立平移/缩放、触控板手势、`100%`、Fit Page / Selection、选中 Overlay、已有节点拖动和统一坐标转换服务 |
| Editing Slice | 动态 Page Outline、画布/大纲选中同步、Registry Inspector、插入/移动、Revision 确认、undo/redo 和 History 恢复 |
| Tests | 90 项契约、规则、渲染、Display Label、Variant 覆盖、Tooltip 时序、结构拖动、Preview 协议、Workbench、坐标、事务、模块边界、持久化恢复和 HTTP 集成测试 |

## 已支持 Command

```text
node.insert
node.move
node.remove
node.setLayoutProperty
node.setProp
node.setVariant
node.setToken
node.setResponsivePolicy
node.setRole
```

所有 Command 都必须携带 `commandId` 和 `protocolVersion`，并经过：

```text
Command Schema → Handler → Rule Engine → Patch → Transaction → Revision
```

## 已支持 HTTP API

```text
GET  /v1/document
GET  /v1/history
GET  /v1/catalog
POST /v1/commands
POST /v1/undo
POST /v1/redo
POST /v1/history/restore
POST /v1/export
```

详见 [Workspace Server API](../api/WORKSPACE_SERVER.md)。

## 当前可运行命令

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm preview:build
pnpm studio:build
pnpm dev

pnpm ui validate examples/golden-pricing/page.ui.json
pnpm ui apply examples/golden-pricing/page.ui.json examples/golden-pricing/commands/add-card.json
pnpm ui export examples/golden-pricing/page.ui.json

pnpm workspace-server examples/golden-pricing/page.ui.json 4178
pnpm preview
```

## 尚未完成

- Schema migration 和旧版本升级路径。
- Data Source / Binding Schema 及完整引用验证。
- Preview 组件级错误隔离、重试控件和更完整的运行时诊断。
- Workbench 面板折叠、完整键盘停靠命令和布局 migration。
- 更完整的键盘跨父级移动、拖动自动滚屏和乐观状态回滚。
- Workspace Server 的独立 Validation 和 WebSocket API。
- ESLint、Formatter、CI 和正式 Commit 规范自动化。
- MCP；按产品计划后置。

## 实施阶段

| 阶段 | 状态 |
| --- | --- |
| M0 领域资产 | 部分完成 |
| M1 无界面内核 | 大部分完成 |
| M2 Workspace Server | 核心服务、HTTP API 和本地 Revision 持久化已完成，WebSocket 未完成 |
| M3 React Renderer / Preview | 确定性 Renderer、Vite Preview、响应式 Golden Page 和隔离通信已完成 |
| M4 Studio | W0～W2 与 Heading/Text 编辑链路已有代码基线；首轮 UAT 未通过，按 STUDIO-001～017 整改 |
| M5 完整导出闭环 | 指定正式 Revision 的可重复导出 API 已完成 |
| M6 MCP | 未开始 |

## 下一步顺序

1. 按第三轮验收矩阵完成插入、移动、Button Slot、Saved components、Dock 与 i18n 的真实浏览器 UAT。
2. 定义 Data Source / Binding Schema 并补齐引用验证。
3. 将编辑提交升级为乐观状态，补齐失败回滚与更完整的错误展示。
4. 补齐 Workbench 面板折叠、键盘停靠命令、布局 migration 和恢复测试。
