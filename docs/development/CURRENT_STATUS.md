# 当前实现状态

> 最后更新：2026-07-22

## 当前结论

项目已经完成可运行的无界面内核、具备本地持久化的 Workspace Server、React Renderer / Preview Host，以及 Studio Workbench 首个可运行基础版。Studio 已使用数据驱动布局树渲染嵌套 Split、Tab 和 Panel，支持尺寸调整、面板拖动、四向停靠、标签合并、关闭/重新打开/最大化、布局恢复、Command Palette 与独立 Canvas Viewport。

当前 Studio 仍是 Workbench 基础版：尚未实现面板折叠与布局 migration、Preview `postMessage` 协议、节点选择、真实属性编辑和 Document Command 提交。

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
| Undo/Redo | 撤销和重做均创建新的单调 Revision |
| Context Exporter | 七文件导出、引用裁剪、稳定 JSON 和 SHA-256 内容 Hash |
| CLI | `validate`、`apply`、`export` |
| Workspace Server | Document、History、Catalog、Command、undo/redo 和 Revision Export HTTP API |
| Revision Store | `1.0.0` 持久化格式、运行时校验、原子文件替换、串行写入和服务重启恢复 |
| API Protocol | 版本化请求/响应 Schema、400/409/422 错误边界 |
| Workspace 配置 | Component、Token、Action、Policy 和 Constraint JSON 运行时校验 |
| React Renderer | PageDocument、Token 和受控布局到 React 的确定性渲染 |
| Preview Host | Vite 独立预览端、15 个 React 组件和 Desktop/Tablet/Mobile 响应式页面 |
| Studio Workbench | 版本化布局 Schema、Panel/Command/Contribution Registry、嵌套 Split/Tab/Panel、可访问分隔条、拖动停靠/标签合并、布局持久化 |
| Canvas Viewport | 画布独立平移/缩放、触控板手势、`100%`、Fit Page 与统一坐标转换服务 |
| Tests | 71 项契约、规则、渲染、Workbench、坐标、事务、模块边界、持久化恢复和 HTTP 集成测试 |

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
- Preview Host 的版本化 `postMessage` 协议、错误边界和崩溃恢复。
- Workbench 面板折叠、完整键盘停靠命令和布局 migration。
- Canvas 节点选择/Overlay、结构拖放、真实属性编辑和乐观状态回滚。
- Workspace Server 的独立 Validation 和 WebSocket API。
- ESLint、Formatter、CI 和正式 Commit 规范自动化。
- MCP；按产品计划后置。

## 实施阶段

| 阶段 | 状态 |
| --- | --- |
| M0 领域资产 | 部分完成 |
| M1 无界面内核 | 大部分完成 |
| M2 Workspace Server | 核心服务、HTTP API 和本地 Revision 持久化已完成，WebSocket 未完成 |
| M3 React Renderer / Preview | 最小确定性 Renderer、Vite Preview 和响应式 Golden Page 已完成，隔离通信待完成 |
| M4 Studio | W0 契约与 W1 可编排 Shell 已完成，W2 Canvas Viewport 基础版已可运行，编辑闭环待完成 |
| M5 完整导出闭环 | 指定正式 Revision 的可重复导出 API 已完成 |
| M6 MCP | 未开始 |

## 下一步顺序

1. 定义 Data Source / Binding Schema 并补齐引用验证。
2. 补齐 Workbench 面板折叠、键盘停靠命令、布局 migration 和恢复测试。
3. 定义 Preview 版本化 `postMessage` 协议，实现节点命中、边界回传、Selection Overlay 和崩溃恢复。
4. 完成 Text / Heading 属性编辑、Revision 确认/回滚和 undo/redo 的首个编辑闭环。
