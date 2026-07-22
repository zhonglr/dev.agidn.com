# AI 友好的低代码网页设计器

## 项目一句话

这是一个人类优先的前端页面可视化编辑器：人类通过受约束的拖拽完成页面设计，系统把结果保存为独立、严格、可验证的 PageDocument，再将 Schema Context Package 交给下游 AI 编码工具使用。

MVP 不让 AI 生成设计。未来 AI 通过 MCP 成为一个受控客户端，读取文档并提交 Command，但不能绕过规则直接修改文档。

## 核心原则

1. **人类先设计，AI 后消费**：早期主流程没有 AI 聊天框或自动生成页面。
2. **PageDocument 独立**：文档是页面组合、语义、布局、状态和交互的唯一事实来源，不依赖 Studio、React、后端、Registry、AI 或 MCP。
3. **样式不能逃逸**：样式只能来自 Design Token、Component Variant 和 Layout Policy。
4. **布局不能逃逸**：普通节点只使用 Section、Container、Stack、Row 和 Grid；绝对定位只能通过受控 Overlay、锚点和 Token 偏移表达。
5. **真实组件优先**：编辑器直接使用代码组件注册表，不维护另一套脱离代码的设计组件。
6. **所有修改走同一路径**：`Command → Rule Engine → Patch → Document Revision`。
7. **前后端分离**：Studio 负责交互和乐观预览，Workspace Server 负责最终验证、事务、版本和持久化。
8. **MCP 是后置适配器**：未来 MCP 复用同一应用服务、Command 和 Rule Engine，不拥有独立写入逻辑。

## 分层事实来源

```text
PageDocument          页面结构、语义、布局、状态与交互
Component Registry    组件 Props、Slots、Variants 与规则
Token Registry        设计值和主题
Policy Registry       布局、响应式与约束
```

PageDocument 只保存引用，不复制组件实现、Token 值或 Policy。

## 核心架构

```text
Human
  ↓
Studio
  ↓ Command + baseRevision
Workspace Server
  ↓
Command Engine → Rule Engine → Patch → Document Revision
  ├── React Renderer / Preview Host
  └── Context Exporter
          ↓
    Schema Context Package
          ↓
       External AI

Future MCP ──→ Workspace Server application services
```

`document-schema` 位于依赖图最底层，保持零内部业务依赖。Renderer、Exporter、Studio、Workspace Server 和未来 MCP 都是 PageDocument 的消费者或操作客户端。

## Schema Context Package

```text
.ui-context/
├── document.json          PageDocument，页面唯一事实来源
├── components.json        当前页面引用的组件定义
├── tokens.json            当前页面引用的 Token
├── policies.json          当前页面适用的规则
├── actions.json           Action 和 Data Source
├── constraints.json       禁止事项
└── manifest.json          协议版本与内容 Hash
```

其他文件只帮助下游工具解析 `document.json` 中的引用，不构成第二份页面事实来源。

## MVP 主流程

```text
选择真实组件
    ↓
语义磁吸到合法 Slot
    ↓
使用受控布局和 Token
    ↓
配置响应式、状态与交互
    ↓
Schema 完整度检查
    ↓
保存 Document Revision
    ↓
导出 Schema Context Package
```

## 实施阶段

```text
M0  领域词汇、Golden Page、组件定义和非法操作矩阵
M1  Document Schema、Codec、Command、Rule Engine 和 Context Exporter
M2  Workspace Server、Revision、事务和持久化
M3  React Renderer 和隔离 Preview Host
M4  专业 Studio Workbench 与编辑闭环
M5  Schema Context Package 导出闭环，MVP 完成
M6  MCP 与 AI Proposed Commands，后置
```

首个 Golden Scenario 是 SaaS Pricing Page，首个运行时目标是 React + TypeScript + Vite。

## MVP 成功标准

- 人类无需接触任意 CSS 和坐标即可完成页面。
- 未注册组件、任意样式、非法 Slot 和普通绝对定位无法进入 PageDocument。
- 前端乐观结果和后端正式 Revision 可以正确确认或回滚。
- 页面能够稳定使用真实 React 组件渲染。
- 同一 Document Revision 可以重复导出内容一致、带版本和 Hash 的 Context Package。
- 下游 AI 无需依赖截图猜测布局、组件和样式。

## 文档导航

- [文档中心](./docs/README.md)：所有产品、架构、开发、API 和 ADR 文档的固定入口。
- [Studio Workbench 架构](./docs/architecture/STUDIO_WORKBENCH.md)：可编排面板、插件扩展点、信息层级和画布独立缩放基线。
- [当前状态](./docs/development/CURRENT_STATUS.md)：已经完成、尚未完成和下一步工作。
- [Studio 问题追踪](./docs/development/STUDIO_ISSUE_TRACKER.md)：用户验收 Issue、优先级、根因、修复批次和验收标准。
- [Development Cycles](./docs/development/cycles/README.md)：每一轮 Dev / Fix / Test / Rebuild 的规范、索引和交付记录。
- [贡献指南](./docs/development/CONTRIBUTING.md)：编码、拆分、依赖、测试和提交规范。
- [Workspace Server API](./docs/api/WORKSPACE_SERVER.md)：HTTP 端点、状态码和调用示例。

## 运行 Studio

```bash
pnpm install
pnpm dev
```

Studio 运行在 `http://127.0.0.1:4173/`，隔离 Preview Host 运行在 `http://127.0.0.1:4174/`，Workspace Server 运行在 `http://127.0.0.1:4178/`。Studio 已支持画布节点选中、Heading/Text 属性编辑、Revision 提交和 undo/redo。

## 当前最先完成的资产

正式开发从以下三项开始，而不是从复杂画布开始：

1. Golden Pricing Page Schema。
2. 15 个真实组件及其 `*.ui.ts` 注册定义。
3. 非法操作矩阵及预期错误码和修复建议。

第一份可运行代码需要证明：合法 PageDocument 可以通过验证，普通绝对定位会被拒绝，并且能够导出完整 Schema Context Package。
