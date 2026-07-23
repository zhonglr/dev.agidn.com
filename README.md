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

导出结果包含 `document.json`（PageDocument，页面唯一事实来源）、页面引用的组件 / Token / Policy / Action / 约束，以及带协议版本与内容 Hash 的 `manifest.json`。文件内容与导出规则的权威定义见 [Schema Context Package](./docs/api/context-package.md)。

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

核心判断：人类无需接触任意 CSS 和坐标即可完成页面；未注册组件、任意样式、非法 Slot 和普通绝对定位无法进入 PageDocument；同一 Document Revision 可以重复导出内容一致、带版本和 Hash 的 Context Package。完整 13 条验收标准见 [产品设计](./docs/product/ai-low-code-designer.md#9-mvp-验收标准)。

## 文档导航

- [文档中心](./docs/README.md)：所有产品、架构、开发、API 和 ADR 文档的固定入口。
- [Studio Workbench 架构](./docs/architecture/studio-workbench.md)：可编排面板、插件扩展点、信息层级和画布独立缩放基线。
- [当前状态](./docs/project/status.md)：已经完成、尚未完成和下一步工作。
- [质量记录](./docs/quality/README.md)：Issue、UAT、专项验证及其创建触发条件。
- [Development Cycles](./docs/project/cycles/README.md)：每一轮 Dev / Fix / Test / Rebuild 的规范、索引和交付记录。
- [贡献指南](./docs/contributing/development.md)：编码、拆分、依赖、测试和提交规范。
- [Workspace Server API](./docs/api/workspace-server.md)：HTTP 端点、状态码和调用示例。

## 运行 Studio

```bash
pnpm install
pnpm dev
```

Studio 运行在 `http://127.0.0.1:4173/`，隔离 Preview Host 运行在 `http://127.0.0.1:4174/`，Workspace Server 运行在 `http://127.0.0.1:4178/`。当前 Studio 已具备节点选择与结构拖放、Registry Inspector、Revision 提交/恢复、undo/redo、导出、Saved components、类型安全 i18n 和可切换主题；真实浏览器 UAT 仍以 [项目状态](./docs/project/status.md) 记录为准。

## 仓库基础资产

当前实现建立在以下三项可验证资产上：

1. Golden Pricing Page Schema。
2. 15 个真实组件及其 `*.ui.ts` 注册定义。
3. 非法操作矩阵及预期错误码和修复建议。

契约测试持续证明：合法 PageDocument 可以通过验证，普通绝对定位会被拒绝，并且能够导出完整 Schema Context Package。
