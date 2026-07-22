# 当前实现状态

> 最后更新：2026-07-22

## 当前结论

项目已经完成可运行的无界面内核、具备本地持久化的 Workspace Server，以及最小 React Renderer / Preview Host。现在可以验证 PageDocument、应用受控 Command、提交 Revision、撤销/重做、查询 History/Catalog、导出 Schema Context Package，并将 Golden Pricing Page 确定性渲染为真实 React 页面。Revision、Command/Patch history 和 undo/redo 状态会在服务重启后恢复。

当前还没有可视化 Studio；Preview Host 尚未接入 sandboxed iframe、`postMessage` 协议和崩溃恢复。

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
| Tests | 60 项契约、规则、渲染、事务、模块边界、持久化恢复、Revision 导出和 HTTP 集成测试 |

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

pnpm ui validate examples/golden-pricing/page.ui.json
pnpm ui apply examples/golden-pricing/page.ui.json examples/golden-pricing/commands/add-card.json
pnpm ui export examples/golden-pricing/page.ui.json

pnpm workspace-server examples/golden-pricing/page.ui.json 4178
pnpm preview
```

## 尚未完成

- Schema migration 和旧版本升级路径。
- Data Source / Binding Schema 及完整引用验证。
- Preview Host 的 sandboxed iframe、`postMessage` 协议、错误边界和崩溃恢复。
- 可编排 Studio Workbench、独立 Canvas Viewport、拖放、属性面板和乐观状态回滚。
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
| M4 Studio | 未开始 |
| M5 完整导出闭环 | 指定正式 Revision 的可重复导出 API 已完成 |
| M6 MCP | 未开始 |

## 下一步顺序

1. 定义 Data Source / Binding Schema 并补齐引用验证。
2. 按 [Studio Workbench 架构](../architecture/STUDIO_WORKBENCH.md) 定义布局树、Panel/Command/Contribution Registry 和布局持久化。
3. 实现可编排 Workbench Shell 和独立 Canvas Viewport，再通过 sandboxed iframe 与版本化 `postMessage` 接入 Preview Host。
4. 完成节点选择、Text / Heading 属性编辑、Revision 确认/回滚和 undo/redo 的首个编辑闭环。
