# 项目路线图

> 最后更新：2026-07-23

本清单记录跨 Cycle 的已落地能力、下一阶段工作和明确后置功能。当前事实见 [项目状态](./status.md)；待验收问题见 [Studio Issue 台账](../quality/issues.md)。

前端事件到后端 Operation 的新增产品范围与计划架构分别见 [Logic / Integration Editor 产品设计](../product/logic-integration-editor.md) 和 [Logic / Integration Editor 架构](../architecture/logic-integration-editor.md)。相关内容当前均为计划，不表示已经实现。

Studio 的多页面项目、自定义组件专注工作台、变量/Slot 和默认双面板布局见 [Studio Authoring Model](../product/studio-authoring-model.md)。旧本地自定义组件原型已删除；当前正式 Project Asset 只有严格读模型，写入与编辑闭环仍以[V2 重构 TODO](./todo.md)为准。

## 已完成

### 项目与领域基础

- [x] 建立 pnpm workspace、TypeScript ESM 和统一构建配置。
- [x] 定义独立、严格且可运行时验证的 PageDocument Schema。
- [x] 从零建立 Foundation Page、Design Token、Policy、Action、Constraint 和 Project Asset 示例。
- [x] 完成 9 个 Foundation Primitive 的 Definition V2，包括 Props、Slots、Variants、Events、Accessibility 和 Editor Preset。
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
- [x] 实现 Project、Project History 和动态 Catalog 查询 API。
- [x] 实现混合 Project Command、undo、redo 和历史恢复 API。
- [x] 实现从当前或指定正式 Revision 导出 Context Package 的 API。
- [x] 限制客户端导出路径，并串行化同目录并发导出。
- [x] 为所有 HTTP 请求和响应提供 TypeBox 协议验证与明确错误边界。

### 导出、CLI 和质量保障

- [x] 导出八文件 Schema Context Package（包含正式项目资产）。
- [x] 实现引用裁剪、稳定 JSON、文件 Hash 和整体 SHA-256 内容 Hash。
- [x] 实现 `validate`、`apply` 和 `export` CLI。
- [x] 覆盖契约、规则、事务、持久化恢复、Revision 导出和 HTTP 集成测试。
- [x] 保持 `typecheck`、`test` 和 `build` 通过。

## 下一阶段

### UI 启动策略

UI 不等待所有 Workspace Server 实时能力完成。当前 V2 不读取、不迁移、不兼容任何重构前数据：

```text
P0 核心数据安全
        ↓
P1 React Renderer / Canvas
        ↓
P2 专业 Studio Workbench
        ↓
P3 Validation API 与 WebSocket 完善
```

- [x] P0 完成后立即启动 UI 基础，不等待 P3 全部完成。
- [x] P1 交付第一个可查看的真实 Foundation Page。
- [x] P2 已交付布局可恢复、面板可编排、画布可独立缩放，且能选择、编辑、撤销和导出的代码基线；产品验收仍在进行。

### P0：UI 前置数据安全

- [x] 验证所有 Action 引用是否存在。
- [x] 验证 Action arguments 是否符合注册定义。
- [ ] 定义 Data Source 和 Binding Schema。
- [ ] 验证 Data Source、Binding 和组件 Props 之间的引用关系。

### P1：真实渲染与直接 DOM Canvas

- [x] 为 9 个 Foundation Primitive 实现真实 React Runtime。
- [x] 创建 `packages/react-renderer`。
- [x] 将 PageDocument、Token、Variant 和受控 Layout 确定性渲染为 React。
- [x] 在 Studio Canvas 中直接挂载 React Renderer，使用同文档原生 DOM。
- [x] 删除独立 Vite Preview Host、sandboxed iframe 和跨窗口消息协议。
- [x] 使用 DOM API 直接完成命中、边界测量、选择和拖放投影。
- [x] 实现组件错误边界和 Canvas 崩溃恢复。
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
- [x] 建立统一坐标转换服务，确保 Canvas DOM 与 Selection Overlay 对齐；辅助线和结构拖放继续复用该服务。
- [x] 实现真实页面画布、节点选择与选中同步。
- [x] 完成 Text / Heading Prop 修改、Revision 确认、undo/redo 的首个端到端编辑闭环。
- [x] 实现合法 Slot 拖放、插入位置提示、移动和排序；等待下一次正式真实浏览器 UAT。
- [x] 修复 50%～200% 缩放下拖动蓝色边框的坐标与尺寸偏差，确保 Canvas DOM rect 只转换一次；等待真实浏览器复验。
- [x] 将 Components 卡片固定为只可拖入；单击、双击和聚焦不得修改文档或创建 Revision。
- [x] 将默认布局改为“左侧栏、Page Outline、Components、Editor、Inspector、右侧栏”，Outline 与 Components 同时显示且默认等宽。
- [x] 实现 Studio 本地多页面根、新建页面入口、每页 Editor Tab、页面切换编辑和刷新恢复。
- [x] 为自定义组件专注工作台补齐同构结构树、命名 Slot、变量/Slot 配置和本地资产复用。
- [x] 实现按页面、节点、组件、Canvas 和组件专注目标解析的 Spectrum 右键菜单与可扩展贡献 Registry；等待完整浏览器矩阵复验。
- [ ] 将多页面与自定义组件资产升级为 Workspace Server 项目 Schema，纳入正式 Revision、History、Catalog 和导出闭环。
- [ ] 实现 Props、Variant、Token、布局和响应式属性面板。
- [ ] 实现规则错误和修复建议展示。
- [ ] 实现乐观 Command、服务端确认与失败回滚。
- [x] 实现 undo/redo、History 恢复和 Revision 保存状态 UI。
- [x] 实现导出 UI。
- [ ] 添加 Workbench 布局恢复、画布手势/坐标、Studio 组件和完整编辑流程 E2E 测试。

### P3：完善 Workspace Server

- [x] 旧 PageDocument、Catalog、Command 和 Revision 输入使用精确版本拒绝，不提供 Migration。
- [x] 删除旧版本 fixture、迁移器、别名、双写和 fallback。
- [ ] 增加独立 Validation Application Service 和 HTTP API。
- [ ] 增加 Workspace 文件变化监听。
- [ ] 定义版本化 WebSocket 消息协议。
- [ ] 推送文件变化、Canvas 状态和后台任务进度。
- [ ] 处理断线重连、消息顺序和过期 Revision。

### P4：工程自动化

- [x] 建立文档目录、命名、生命周期规范和内部链接自动检查。
- [x] 配置 ESLint、Stylelint 和 Prettier。
- [ ] 建立独立的全仓 Prettier 格式基线并启用 `format:check`。
- [ ] 配置 CI 的 typecheck、test 和 build 检查。
- [ ] 自动检查 Commit 规范。
- [ ] 增加浏览器兼容性和 Canvas 冒烟测试。

### Logic / Integration Editor：首个前后端业务闭环

该工作复用现有 PageDocument Interaction、Studio Workbench、Canvas Runtime 和 Workspace Server，但保持独立 IntegrationDocument 和 Revision；具体阶段及退出条件见 [Logic / Integration Editor 架构](../architecture/logic-integration-editor.md)。

- [ ] I0：定义 Operation Registry、Value Source、Effect 和 IntegrationDocument Schema。
- [ ] I0：建立 Pricing Page Golden Integration、非法 fixture、跨引用校验和稳定错误码。
- [ ] I1：实现 Integration Command、Patch、Revision、项目加载和原子持久化。
- [ ] I2：增加 Design / Logic Route、四列 Connection Canvas、Inspector、Problems 和 History。
- [ ] I3：实现受限 Test Action Runtime、Canvas 事件和 Pending / Success / Failure 效果。
- [ ] I3：验收 `button_pro.press → billing.selectPlan → billing.createCheckout` 浏览器闭环。
- [ ] I4：裁剪并导出 Operation 与 Integration 上下文，升级 Manifest 与 Hash 契约。
- [ ] I5：在 Action 闭环稳定后实现 Data Source / Component Prop Binding。

## 后置能力

- [ ] 创建 MCP Server Adapter。
- [ ] 提供 Document、Catalog 和 Context Package 只读资源。
- [ ] 接受带 `baseRevision` 的 AI Proposed Commands。
- [ ] 展示变更摘要、原因、影响范围和审查 Diff。
- [ ] 确保 MCP 与 Studio 复用同一 Command、Rule Engine、Revision 和持久化链路。
- [ ] 评估多人协作、插件市场和更多前端框架支持。

## 当前里程碑

各阶段完成度的唯一快照由 [项目状态](./status.md) 的“实施阶段”表维护，本文不再保留第二份里程碑表，避免两份记录漂移。
