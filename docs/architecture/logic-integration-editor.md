# Logic / Integration Editor 系统架构

> 状态：Proposed
> 最后更新：2026-07-23
> 产品范围和验收标准见 [Logic / Integration Editor 产品设计](../product/logic-integration-editor.md)。当前实现能力与优先级分别见 [项目状态](../project/status.md) 和 [项目路线图](../project/roadmap.md)。本文描述计划架构，不表示协议或端点已经实现。

## 1. 当前基线与缺口

仓库已经具备实现首个业务连接闭环所需的大部分基础设施：

- PageDocument 组件节点支持 `interactions`，每条 Interaction 包含 `event`、`actionRef` 和 arguments。
- Rule Engine 能验证 Action 引用和基础参数类型。
- React Renderer 已把组件事件转换为 `onAction(actionRef, arguments, node)`。
- Preview Host、Studio 和 Workspace Server 已经分离，并使用版本化边界。
- Studio Workbench 已提供 Panel Registry、可持久化布局、Problems、History 和 Inspector 基础。
- Workspace Server 已提供 Command、Revision、持久化、Catalog 和 Context Export 的分层实现样例。

当前缺口是：

- Action 只定义业务名称、描述和基础 arguments，没有输出契约。
- `dataSources` 还没有正式 Schema。
- 没有后端 Operation Registry。
- 没有 Action 到 Operation 的 IntegrationDocument。
- 没有跨 PageDocument、Action、Operation 和 Integration 的统一验证。
- Preview 当前接收 Action 后没有执行运行时。
- 现有 Revision Engine 与 PageDocument 类型和 Command 强绑定，不能直接保存另一种文档。

因此第一阶段应补充独立 Integration 领域，而不是继续向 PageDocument 填入 HTTP、认证或编辑器图坐标。

## 2. 架构目标

### 2.1 保持事实来源分层

```text
PageDocument
  页面节点、组件事件、actionRef、页面提供的 arguments

Action Registry
  稳定业务意图及其输入/输出契约

Operation Registry
  允许调用的后端 Operation、请求/响应和认证引用

IntegrationDocument
  Action 到 Operation 的绑定、值映射和生命周期效果

Integration Editor State
  节点位置、缩放、选择、打开面板和临时 Test Run
```

同一关系只能有一个权威来源：

- UI Event 到 Action 的引用属于 PageDocument。
- Action 的业务接口属于 Action Registry。
- HTTP 或其他传输契约属于 Operation Registry。
- Action 如何适配 Operation 属于 IntegrationDocument。
- 连线图位置和视图偏好属于 Editor State。

### 2.2 不破坏 PageDocument 1.0.0 完成第一个闭环

现有 Interaction 已足够表达 UI Event 到 Action 的关系。第一阶段不新增 URL、Operation、response mapping 或认证字段到 PageDocument，也不要求迁移已有 Golden Page。

需要动态表单值、页面状态或 Data Source Prop Binding 时，再通过显式 PageDocument Schema migration 增加类型化 Value Source；不得先把任意表达式塞进 `arguments`。

### 2.3 所有正式修改继续使用统一形态

Integration 编辑遵循与页面编辑一致的原则：

```text
Human / Future MCP
        ↓
Integration Command + baseRevision
        ↓
Protocol Schema
        ↓
Integration Rule Engine
        ↓
Integration Patch
        ↓
Integration Revision
```

PageDocument Command 和 Integration Command 是不同协议族，不能使用一个包含大量可选字段的通用 Command 混合处理。

## 3. 顶层运行流

```text
Design Editor                        Logic Editor
     │                                    │
     │ Page Command                       │ Integration Command
     ▼                                    ▼
Workspace Server ───────────────────────────────────────────────┐
     │ Page services             Integration services           │
     │                                    │                     │
     ▼                                    ▼                     │
Page Revision                       Integration Revision         │
     │                                    │                     │
     └──────────────┬─────────────────────┘                     │
                    ▼                                           │
              Cross Validator                                   │
                    │                                           │
                    ▼                                           │
Preview Host → actionRequested → Action Runtime → Operation Port│
                    │                           │                │
                    │                           ▼                │
                    │                    Registered Backend ─────┘
                    ▼
          actionPending / Succeeded / Failed
                    │
                    ▼
               Preview Effects
```

Action Runtime 依赖端口而不是具体 HTTP 客户端，使 Test、Mock 和真实项目适配器可以共享同一执行语义。

## 4. 领域模型

以下字段是第一阶段的设计目标，正式实现时使用 TypeBox 定义权威运行时 Schema，并从 Schema 派生 TypeScript 类型。

### 4.1 Action Contract

现有 Action arguments 只允许 `string`、`number` 和 `boolean`。第一阶段保持兼容，并增加可选结果契约：

```ts
interface ActionDefinition {
  name: string;
  description: string;
  arguments?: Record<string, ScalarType>;
  result?: Record<string, ScalarType>;
}
```

`ScalarType` 首版仍为 `string | number | boolean` 的类型描述。对象、数组、可空值和联合类型等需要实际 Data Source 场景后再扩展为更完整的 JSON Schema 子集。

### 4.2 Operation Registry

```ts
interface OperationRegistry {
  version: "1.0.0";
  operations: Record<OperationId, OperationDefinition>;
}

interface OperationDefinition {
  name: string;
  description?: string;
  transport: "http";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  authRef?: string;
  request?: Record<string, OperationField>;
  response?: Record<string, OperationField>;
  error?: Record<string, OperationField>;
  tags?: string[];
}

interface OperationField {
  type: "string" | "number" | "boolean";
  required?: boolean;
  location?: "path" | "query" | "header" | "body";
  sensitive?: boolean;
}
```

约束：

- `path` 必须是项目后端适配器可解析的受控相对路径或由导入器生成的 Operation 标识；不能接受浏览器提交的任意绝对 URL。
- `authRef` 只是服务器端 Credential Provider 的引用，不能包含 Secret。
- 标记 `sensitive` 的字段在 Test Trace、错误和导出时必须脱敏或裁剪。
- 第一版只实现 HTTP Transport，但 Schema 使用带判别字段的模型，为后续本地函数或消息适配器保留显式扩展路径。

### 4.3 Value Source

```ts
type ValueSource =
  | { kind: "literal"; value: string | number | boolean }
  | {
      kind: "reference";
      scope:
        | "actionArgument"
        | "triggerPayload"
        | "operationResponse"
        | "operationError"
        | "actionResult"
        | "actionError";
      path: string;
    };
```

Value Source 使用带判别字段的 Union，禁止保存模板字符串、JavaScript 表达式、函数或隐式全局变量。每个字段按所在阶段限制合法 `scope`：

- Operation input 只允许 `literal`、`actionArgument` 和 `triggerPayload`。
- Action output 只允许 `literal` 和 `operationResponse`。
- Success Effect 只允许 `literal` 和 `actionResult`。
- Failure Effect 只允许 `literal` 和标准化 `actionError`。

`operationError` 只用于 Action Runtime 把传输错误映射为标准 `actionError`，不能直接暴露给页面效果。

### 4.4 Lifecycle Effect

```ts
type IntegrationEffect =
  | { type: "setTriggerState"; state: string }
  | { type: "setComponentState"; nodeId: string; state: string }
  | { type: "navigate"; value: ValueSource }
  | { type: "showMessage"; level: "info" | "success" | "error"; value: ValueSource }
  | { type: "refreshDataSource"; dataSourceRef: string };
```

`navigate` 的目标策略尚需专项验证。第一实现优先只允许注册 Route；是否允许从 Operation response 读取受控外部 URL，必须在公开协议前确定。

### 4.5 IntegrationDocument

```ts
interface IntegrationDocument {
  schemaVersion: "1.0.0";
  id: string;
  pageDocumentRef: string;
  bindings: Record<ActionRef, IntegrationBinding>;
}

interface IntegrationBinding {
  operationRef: string;
  input: Record<string, ValueSource>;
  output?: Record<string, ValueSource>;
  pending?: IntegrationEffect[];
  success?: IntegrationEffect[];
  failure?: IntegrationEffect[];
  timeoutMs?: number;
}
```

示例：

```json
{
  "schemaVersion": "1.0.0",
  "id": "pricing-integrations",
  "pageDocumentRef": "page_pricing",
  "bindings": {
    "billing.selectPlan": {
      "operationRef": "billing.createCheckout",
      "input": {
        "planId": {
          "kind": "reference",
          "scope": "actionArgument",
          "path": "planId"
        }
      },
      "output": {
        "checkoutUrl": {
          "kind": "reference",
          "scope": "operationResponse",
          "path": "checkoutUrl"
        }
      },
      "pending": [
        {
          "type": "setTriggerState",
          "state": "loading"
        }
      ],
      "success": [
        {
          "type": "navigate",
          "value": {
            "kind": "reference",
            "scope": "actionResult",
            "path": "checkoutUrl"
          }
        }
      ],
      "failure": [
        {
          "type": "showMessage",
          "level": "error",
          "value": {
            "kind": "reference",
            "scope": "actionError",
            "path": "message"
          }
        }
      ],
      "timeoutMs": 10000
    }
  }
}
```

Action Runtime 将 Operation 传输错误规范化为稳定的 `actionError`，至少包含 `code`、`message` 和可选 `retryable`；原始响应体、Stack 和敏感字段不能成为页面效果输入。

### 4.6 编辑器视图状态

```ts
interface IntegrationEditorState {
  selectedConnectionId?: string;
  focusedNodeId?: string;
  collapsedGroups: string[];
  canvas?: {
    positions: Record<string, { x: number; y: number }>;
    zoom: number;
    offset: { x: number; y: number };
  };
}
```

第一版固定分栏时可以不保存 `canvas`。未来需要自由布局时，该状态保存到 Studio 自己的版本化布局空间，不能写入 IntegrationDocument 或 Context Package。

## 5. 引用和验证规则

### 5.1 Shape Validation

- 所有外部 Object Schema 默认 `additionalProperties: false`。
- ID、版本、Path 和判别字段使用明确格式。
- Value Source、Effect、Command 和响应使用判别 Union。
- 未知字段、未知 Effect 和未知 Transport 在边界直接拒绝。

### 5.2 Cross Validation

Cross Validator 读取指定 Page Revision、Integration Revision 和 Catalog snapshot，至少检查：

- `pageDocumentRef` 与当前工作区页面匹配。
- PageDocument 中的 `actionRef` 存在于 Action Registry。
- Integration Binding 的 Action 存在且至少被页面或允许的共享范围引用。
- `operationRef` 存在于 Operation Registry。
- 每个必填 Operation request 字段都有 Value Source。
- Action argument、trigger payload 与目标 Operation 字段类型兼容。
- 映射没有提供 Operation 不接受的字段。
- Operation response 到 Action result 的输出映射完整且类型兼容。
- Success Effect 只引用 Action result，Failure Effect 只引用标准化 Action error。
- `nodeId` 指向存在的 PageDocument 节点，State 属于组件注册定义。
- Route、Data Source 和认证引用存在于各自注册表。
- `timeoutMs` 位于 Policy 允许范围。

### 5.3 建议的错误码

```text
UNKNOWN_ACTION
ACTION_NOT_REFERENCED
UNKNOWN_OPERATION
MISSING_OPERATION_INPUT
UNKNOWN_OPERATION_INPUT
VALUE_SOURCE_NOT_FOUND
VALUE_TYPE_MISMATCH
UNKNOWN_RESPONSE_FIELD
UNKNOWN_ERROR_FIELD
UNKNOWN_EFFECT_TARGET
UNKNOWN_COMPONENT_STATE
UNKNOWN_ROUTE
UNKNOWN_DATA_SOURCE
UNSAFE_OPERATION_TARGET
SENSITIVE_VALUE_EXPOSED
INTEGRATION_SCHEMA_INVALID
```

Violation 延续现有结构：`code`、`message`、相关 ID、`path`、`suggestions` 和不可绕过的严重级别。

## 6. Command、Patch 与 Revision

### 6.1 MVP Commands

```text
integration.bindOperation
integration.unbindOperation
integration.setInputMapping
integration.removeInputMapping
integration.setOutputMapping
integration.removeOutputMapping
integration.setEffects
integration.setTimeout
```

所有 Command 包含：

```ts
interface IntegrationCommandBase {
  protocolVersion: "1.0.0";
  commandId: string;
}
```

HTTP 提交在 Command 外携带 `baseRevision` 和 `source`，与现有 Document API 形态一致。

### 6.2 Patch

Patch 应按 Action Binding 和字段身份表达，不使用数组索引作为业务身份：

```text
binding.add
binding.remove
binding.updateInput
binding.updateOutput
binding.updateEffects
binding.updatePolicy
```

第一版 Effect 可以整体替换一个生命周期阶段；只有实际出现多人或复杂排序需求后才增加 Effect ID 和细粒度移动命令。

### 6.3 Revision Store 策略

现有 Document Engine 直接依赖 PageDocument、Page Command 和 Page Rule Context。第一阶段禁止为了复用而立即进行大规模泛型重构。

建议顺序：

1. 为 IntegrationDocument 实现最小 Revision Store，包含 shape/cross validation、`baseRevision`、重复 Command ID、单调 Revision 和原子持久化。
2. 保持与 Page Revision API 相同的应用服务语义和错误边界。
3. 两条链路都有稳定测试后，再评估抽取通用 `RevisionKernel<TDocument, TCommand, TPatch>`。
4. 抽取属于长期架构决策，实施前创建 ADR；不得为了消除少量重复提前引入不成熟抽象。

Page Revision 和 Integration Revision 不要求使用同一个数字。需要一致快照时使用显式复合引用：

```ts
interface WorkspaceSnapshotRef {
  pageRevision: number;
  integrationRevision: number;
  catalogVersions: {
    actions: string;
    operations: string;
  };
}
```

## 7. Workspace Server 边界

### 7.1 计划模块

```text
packages/
├── integration-schema/       IntegrationDocument 和 Operation Registry Schema
├── integration-engine/       Command、Patch、规则和引用收集
└── action-runtime/           Action 执行编排和 Operation Port

apps/workspace-server/src/
├── application/
│   ├── integration-service.ts
│   └── action-runtime-service.ts
├── infrastructure/
│   ├── filesystem/integration-loader.ts
│   ├── filesystem/integration-state-file.ts
│   └── operations/http-operation-adapter.ts
└── transport/http/
```

实际文件可以按现有分层习惯进一步拆分；核心约束是 Schema、应用服务、Transport 和 Infrastructure 不能混层。

### 7.2 候选端点

以下只用于确定应用边界，不是当前公开 API；实现时必须同步新增 TypeBox Schema、契约测试和 [Workspace Server API](../api/workspace-server.md) 文档：

```text
GET  /v1/integration
GET  /v1/operations
POST /v1/integration/commands
POST /v1/integration/undo
POST /v1/integration/redo
POST /v1/integration/history/restore
POST /v1/actions/test
```

是否提供通用 `/v1/actions/execute` 必须区分 Studio Test Runtime 与生成应用的正式 Runtime。MVP 可以只提供受限 Test endpoint，避免把开发服务器意外变成生产 Action Gateway。

## 8. Action Runtime

### 8.1 执行状态机

```text
idle
  ↓ validate request
pending
  ├── operation success → apply success effects → succeeded
  ├── operation failure → apply failure effects → failed
  └── timeout           → apply failure effects → timed-out
```

运行步骤：

1. 接收 `actionRef`、arguments、触发节点和显式 Workspace Snapshot。
2. 解析 Action、Integration Binding 和 Operation。
3. 再次运行跨引用与映射验证，不能信任浏览器提交的数据。
4. 从 Value Source 构造 Operation request。
5. 通过 Credential Provider 在服务器端解析 `authRef`。
6. 发布 Pending 状态，并调用 Operation Port。
7. 把 Operation response 映射为 Action result，或把传输错误规范化为 Action error。
8. 只使用 Action result 或 Action error 生成受控 Effect Result，由 Preview 或正式运行时适配器执行。
9. 记录脱敏 Trace；运行结果不修改正式文档。

### 8.2 Operation Port

```ts
interface OperationExecutor {
  execute(input: {
    operation: OperationDefinition;
    values: Record<string, unknown>;
    environment: string;
    signal: AbortSignal;
  }): Promise<OperationResult>;
}
```

Action Runtime 不直接依赖 `fetch`、Node HTTP 或具体认证库。HTTP Adapter 负责 URL 解析、Header、Body、超时、响应大小、内容类型和网络错误归一化。

### 8.3 安全边界

- 只允许执行 Operation Registry 中的目标。
- Operation 目标必须通过 workspace allowlist 和 URL 规范化，防止 SSRF、重定向逃逸和本地敏感地址访问。
- Secret 只由服务器 Credential Provider 提供，不能进入 PageDocument、IntegrationDocument、浏览器消息、Trace 或 Context Package。
- 默认禁止用户提供任意 Header；允许的 Header 必须在 Operation Definition 中声明。
- 限制请求超时、重定向次数、请求体和响应体大小。
- Trace 对 Authorization、Cookie、敏感字段和二进制内容统一脱敏。
- Test Run 与正式执行环境必须显式区分，默认不能命中生产环境。

## 9. Preview Protocol

计划增加以下消息族：

```text
preview.actionRequested
studio.actionPending
studio.actionSucceeded
studio.actionFailed
```

每条消息必须包含 `protocolVersion`、`requestId`、Page Revision 和 Integration Revision。Preview 忽略过期 Revision 或重复完成消息。

`preview.actionRequested` 只发送 Action、arguments 和触发节点身份，不发送 Operation、URL 或 Credential。Studio 调用 Workspace Server 后，将规范化的受控 Effect Result 返回 Preview。Preview 只能执行已支持 Effect，未知 Effect 触发协议错误。

该设计让 sandboxed iframe 保持无 Credential、无任意网络配置，也为未来正式运行时复用相同 Effect 语义提供边界。

## 10. Logic Editor 结构

### 10.1 Route 与 Workbench

Studio 增加 Design / Logic 平级 Route，并为两种编辑模式维护独立默认 Workbench Layout 和持久化 Key。Workbench、Theme、i18n、Command Palette 和稳定 Studio UI 门面继续共享。

Logic Editor 默认注册：

```text
integration-sources
integration-canvas
integration-inspector
integration-problems
integration-test-run
integration-history
```

Page Canvas Viewport 与 Integration Canvas 只共享必要的输入和坐标抽象，不共享 iframe 特定选择逻辑。

### 10.2 Connection Canvas MVP

第一版采用四列自动布局：

```text
UI Event | Action | Operation | Lifecycle Effect
```

每个端口声明稳定 ID、方向和类型。连接交互先生成候选 Command，由前端本地 Schema 提供即时反馈，再由 Workspace Server 做正式验证和 Revision 提交。

第一版可使用 React DOM 节点和独立 SVG Overlay 绘制曲线。只有出现自由布局、多级分支或大图性能证据后，才评估专用图形库；第三方图模型不能进入 Integration Schema。

### 10.3 Inspector

Inspector 根据选择类型贡献表单：

- Action：契约和引用位置，只读为主。
- Operation：方法、路径、输入/输出和安全属性，只读为主。
- Binding：Operation 选择、映射、效果和超时，可编辑。
- Connection：来源、目标、类型判断和删除操作。

输入控件从 Schema/Registry 派生，不能把 JSON 文本框作为主要编辑方式。可提供只读 Schema 视图用于诊断。

## 11. Context Package 演进

第一阶段 Workspace 源文件计划增加：

```text
operations.json
integrations.json
```

Context Package 的目标内容为：

```text
.ui-context/
├── document.json
├── components.json
├── tokens.json
├── policies.json
├── actions.json
├── operations.json
├── integrations.json
├── constraints.json
└── manifest.json
```

Exporter 只选择当前页面引用 Action 所需的 Binding 和 Operation，不能导出整个后端 Catalog、Secret、环境地址或 Test Trace。

增加文件会改变 Context Package 协议内容和 Hash，实施时必须：

- 明确协议版本升级策略。
- 更新 Manifest Schema。
- 更新稳定序列化、引用裁剪和 Hash 契约测试。
- 保留旧导出 fixture，用 migration 或明确拒绝策略处理。
- 同时更新产品文档、API 文档和下游消费说明。

## 12. 分阶段实施

### I0：Schema 与 Golden Integration

- 定义 Action result、Operation Registry、Value Source、Effect 和 IntegrationDocument Schema。
- 明确 Value Source 的 trigger、response 和 error scope。
- 建立 Pricing Page Golden Integration 与非法 fixture。
- 实现 shape validation、cross validation 和引用收集。
- 通过 TypeBox 静态类型、运行时验证和模块边界契约测试。

退出条件：不启动 UI 也能验证或拒绝一份完整 IntegrationDocument，并给出稳定错误码。

### I1：Command、Revision 与 Workspace 加载

- 实现 Integration Command、Patch 和最小 Revision Store。
- 加载 `operations.json` 和 `integrations.json`。
- 增加 Application Service 和运行时验证的候选 HTTP 协议。
- 实现原子持久化、冲突检测和服务重启恢复。

退出条件：可以通过 Command 创建 Golden Binding，重启后恢复相同正式 Revision。

### I2：Logic Editor

- 增加 Design / Logic Route。
- 实现 Sources、四列 Connection Canvas、Inspector、Problems 和 History。
- 实现连接、映射、效果与保存交互。
- 为 Logic Workbench 使用独立布局持久化空间。

退出条件：用户不编辑 JSON 即可建立并保存 Golden Binding。

### I3：Test Action Runtime 与 Preview

- 实现受限 Test endpoint、Operation Port 和 Mock/Local HTTP Adapter。
- 扩展 Preview Protocol 和 Effect Runtime。
- 实现 Pending、Success、Failure、Timeout 和脱敏 Trace。
- 完成 Choose Pro 的真实浏览器闭环。

退出条件：Preview 中一次点击能经过注册 Operation 返回，并产生可见成功或失败效果。

### I4：Context Export 与 AI 消费

- 裁剪并导出 Integration 与 Operation 上下文。
- 升级 Manifest 与 Hash 契约。
- 增加 AI 消费说明和 Golden Context fixture。
- 验证 AI 无需截图或猜测即可确定前后端映射。

退出条件：同一复合 Revision 可以重复导出内容一致、无 Secret 的完整 Context Package。

### I5：Data Source / Prop Binding

- 在 Action 闭环稳定后定义 Query Operation、Data Source 和 Component Prop Binding。
- 增加 Loading、Empty、Error、Success 数据状态。
- 增加集合、分页、缓存与刷新语义。

I5 不属于首个 Action 闭环，不得阻塞 I0～I4。

## 13. 测试策略

### 13.1 契约测试

- Operation、Integration、Command、Patch 和 Preview 消息 Schema。
- `additionalProperties: false` 和判别 Union。
- 稳定序列化与协议版本拒绝。

### 13.2 规则测试

- 未知 Action、Operation、输入和 Effect target。
- 缺少必填参数与类型不匹配。
- 悬空 Page node、State、Route、Data Source 和 Credential 引用。
- 任意 URL、Secret 暴露和敏感 Trace。

### 13.3 Revision 与持久化测试

- `baseRevision` 冲突、重复 Command、原子事务和重启恢复。
- Page Revision 与 Integration Revision 独立推进。
- Cross Validator 使用显式 snapshot，不读取变化中的“最新”数据。

### 13.4 Runtime 测试

- 参数解析、请求构造、认证端口、超时、取消和错误归一化。
- Pending、Success、Failure Effect 顺序。
- SSRF、重定向、大小限制和脱敏策略。

### 13.5 UI 与 E2E

- 键盘建立/移除连接、端口类型反馈和 Inspector 错误定位。
- Workbench 布局隔离和恢复。
- `button_pro.press → billing.selectPlan → billing.createCheckout` 浏览器闭环。
- Test endpoint 失败时 Preview 恢复可操作状态。

## 14. 架构验证 Gate

在 I0 编码前必须冻结以下结论：

- 一个 Action 在一个 Workspace 中是否只允许一个 Operation Binding。
- Operation path 的规范化和环境 Base URL 所有权。
- Test Runtime 是否只允许 Mock/Local 环境。
- Page node 删除后的悬空引用策略。
- Context Package 增加文件时采用的协议版本。

这些结论形成实现证据后，影响长期兼容性的选择使用新 ADR 记录。本文保持 Proposed，不能替代 Accepted ADR 或已实现 API 文档。
