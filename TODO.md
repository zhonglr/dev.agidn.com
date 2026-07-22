# 项目 TODO

> 最后更新：2026-07-23

本清单记录当前已经落地的能力、下一阶段工作和明确后置的功能。更详细的实现状态见 [`docs/development/CURRENT_STATUS.md`](./docs/development/CURRENT_STATUS.md)；已确认但尚未通过用户验收的问题见 [`docs/development/STUDIO_ISSUE_TRACKER.md`](./docs/development/STUDIO_ISSUE_TRACKER.md)。

## 已完成

### 项目与领域基础

- [x] 建立 pnpm workspace、TypeScript ESM 和统一构建配置。
- [x] 定义独立、严格且可运行时验证的 PageDocument Schema。
- [x] 建立 Golden Pricing Page、Design Token、Policy、Action 和 Constraint 示例。
- [x] 完成 15 个组件的注册定义，包括 Props、Slots、Variants 和 States。
- [x] 建立非法操作矩阵和模块依赖边界测试。

### 无界面文档内核

- [x] 实现 PageDocument 稳定序列化和解析。
- [x] 实现组件、Token、Slot、响应式、Overlay、无障碍和布局规则验证。
- [x] 实现 Insert、Move、Remove、Set Prop、Set Variant、Set Token、Set Responsive Policy、Set Role 和受控布局 Command。
- [x] 实现基于 Node ID 的 Insert、Move、Remove 和 Update Patch。
- [x] 实现原子事务、`baseRevision` 冲突检测和重复 Command ID 拒绝。
- [x] 实现单调 Revision history、undo、redo 和可撤销的历史恢复。

### Workspace Server

- [x] 实现版本化 Revision Store 和运行时状态校验。
- [x] 实现原子文件替换、串行写入和服务重启恢复。
- [x] 实现 Document、History 和 Catalog 查询 API。
- [x] 实现 Command、undo、redo 和历史恢复 API。
- [x] 实现从当前或指定正式 Revision 导出 Context Package 的 API。
- [x] 限制客户端导出路径，并串行化同目录并发导出。
- [x] 为所有 HTTP 请求和响应提供 TypeBox 协议验证与明确错误边界。

### 导出、CLI 和质量保障

- [x] 导出七文件 Schema Context Package。
- [x] 实现引用裁剪、稳定 JSON、文件 Hash 和整体 SHA-256 内容 Hash。
- [x] 实现 `validate`、`apply` 和 `export` CLI。
- [x] 覆盖契约、规则、事务、持久化恢复、Revision 导出和 HTTP 集成测试。
- [x] 保持 `typecheck`、`test` 和 `build` 通过。

## 下一阶段

### UI 启动策略

UI 不等待所有 Workspace Server 实时能力和 Migration 完成。先补齐会直接影响编辑安全的引用验证，然后立即进入真实渲染和 Studio：

```text
P0 核心数据安全
        ↓
P1 React Renderer / Preview
        ↓
P2 专业 Studio Workbench
        ↓
P3 Migration、Validation API 与 WebSocket 完善
```

- [x] P0 完成后立即启动 UI 基础，不等待 P3 全部完成。
- [x] P1 交付第一个可查看的真实 Golden Pricing Page。
- [x] P2 已交付布局可恢复、面板可编排、画布可独立缩放，且能选择、编辑、撤销和导出的代码基线；产品验收仍在进行。

### P0：UI 前置数据安全

- [x] 验证所有 Action 引用是否存在。
- [x] 验证 Action arguments 是否符合注册定义。
- [ ] 定义 Data Source 和 Binding Schema。
- [ ] 验证 Data Source、Binding 和组件 Props 之间的引用关系。

### P1：真实渲染与隔离预览

- [x] 为 15 个注册组件实现真实 React 组件。
- [x] 创建 `packages/react-renderer`。
- [x] 将 PageDocument、Token、Variant 和受控 Layout 确定性渲染为 React。
- [x] 创建独立 Vite Preview Host。
- [x] 使用 sandboxed iframe 隔离项目运行时代码。
- [x] 定义 Studio 与 Preview Host 的版本化 `postMessage` 协议。
- [x] 实现组件错误边界和 Preview 崩溃恢复。
- [x] 验证 Desktop、Tablet 和 Mobile 响应式渲染。

### P2：专业 Studio Workbench 与首个编辑闭环

- [x] 创建 React + TypeScript + Vite Studio 应用。
- [x] 定义版本化 Workbench Layout Schema 和布局 migration 边界。
- [x] 实现嵌套 Split、Tab Group、Panel Host 和可键盘调整的分隔条。
- [x] 实现面板移动、边缘停靠、标签合并、关闭、最大化和布局持久化恢复。
- [ ] 实现面板折叠、布局 migration 和完整键盘停靠命令。
- [x] 建立 Panel、Command、Inspector、Route 和 Status Item 的内部 Contribution Registry。
- [x] 实现 Activity Bar、Command Palette、快捷键冲突检测和 Status Bar。
- [x] 实现组件和动态页面结构面板；Token / Registry 全局管理继续使用独立页面或对话框。
- [x] 实现 Canvas Viewport，支持触控板双指平移、pinch 缩放、指针中心缩放、`100%` 和 Fit Page。
- [x] 接入真实节点选中后实现 Fit Selection。
- [x] 建立统一坐标转换服务，确保 iframe DOM 与 Selection Overlay 对齐；辅助线和结构拖放继续复用该服务。
- [x] 实现真实页面画布、节点选择与选中同步。
- [x] 完成 Text / Heading Prop 修改、Revision 确认、undo/redo 的首个端到端编辑闭环。
- [x] 实现合法 Slot 拖放、插入位置提示、移动和排序；等待第三轮真实浏览器 UAT。
- [ ] 实现 Props、Variant、Token、布局和响应式属性面板。
- [ ] 实现规则错误和修复建议展示。
- [ ] 实现乐观 Command、服务端确认与失败回滚。
- [x] 实现 undo/redo、History 恢复和 Revision 保存状态 UI。
- [x] 实现导出 UI。
- [ ] 添加 Workbench 布局恢复、画布手势/坐标、Studio 组件和完整编辑流程 E2E 测试。

### P3：完善 Migration 与 Workspace Server

- [ ] 定义 PageDocument Schema migration。
- [ ] 定义 Revision Store 格式 migration 和升级失败恢复策略。
- [ ] 添加旧版本 fixture、迁移契约测试和幂等测试。
- [ ] 增加独立 Validation Application Service 和 HTTP API。
- [ ] 增加 Workspace 文件变化监听。
- [ ] 定义版本化 WebSocket 消息协议。
- [ ] 推送文件变化、Preview 状态和后台任务进度。
- [ ] 处理断线重连、消息顺序和过期 Revision。

### P4：工程自动化

- [ ] 配置 ESLint 和 Formatter。
- [ ] 配置 CI 的 typecheck、test 和 build 检查。
- [ ] 自动检查 Commit 规范。
- [ ] 增加浏览器兼容性和 Preview 冒烟测试。

## 后置能力

- [ ] 创建 MCP Server Adapter。
- [ ] 提供 Document、Catalog 和 Context Package 只读资源。
- [ ] 接受带 `baseRevision` 的 AI Proposed Commands。
- [ ] 展示变更摘要、原因、影响范围和审查 Diff。
- [ ] 确保 MCP 与 Studio 复用同一 Command、Rule Engine、Revision 和持久化链路。
- [ ] 评估多人协作、插件市场和更多前端框架支持。

## 当前里程碑

| 阶段 | 状态 |
| --- | --- |
| M0 领域资产 | 部分完成 |
| M1 无界面内核 | 大部分完成 |
| M2 Workspace Server | 核心 HTTP 与持久化完成，实时能力待完成 |
| M3 React Renderer / Preview | Renderer、Preview Host、iframe 隔离与版本化通信已完成 |
| M4 Studio | Workbench 与编辑闭环代码基线已完成，第三轮 UAT 待验收 |
| M5 Context Package 导出闭环 | 已完成 |
| M6 MCP | 后置，未开始 |
