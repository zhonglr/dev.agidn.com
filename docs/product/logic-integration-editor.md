# Logic / Integration Editor 产品设计

> 状态：Proposed
> 最后更新：2026-07-23
> 关联文档：[AI 低代码设计器产品设计](./ai-low-code-designer.md)、[Logic / Integration Editor 架构](../architecture/logic-integration-editor.md)、[项目路线图](../project/roadmap.md)

## 1. 产品结论

Logic / Integration Editor 是 Page Designer 之后的第二个核心编辑面。它把 PageDocument 中已经声明的组件事件连接到受控的业务 Action 和后端 Operation，使用户能够在不编写任意 JavaScript、URL 或认证代码的情况下完成前端到后端的可验证连接。

首个目标不是建设通用后端工作流平台，而是证明以下最小闭环：

```text
设计页面中的 Button.press
        ↓
已注册的业务 Action
        ↓
已注册的后端 Operation
        ↓
请求参数映射与执行
        ↓
Loading / Success / Failure 页面效果
        ↓
验证、保存、预览和导出
```

Page Designer 继续负责“页面是什么”，Logic / Integration Editor 负责“页面表达的业务意图如何被系统履行”。两个编辑面共享 Workspace、Revision、规则和导出边界，但不能互相复制事实来源。

## 2. 问题与机会

当前 PageDocument 已能明确表达：

- 页面结构、组件、Slot 和语义角色。
- 受控布局、响应式规则、Token、Variant 和 State。
- 组件事件、`actionRef` 和静态 Action arguments。

下游 AI 配合 Schema Context Package 可以可靠理解页面的结构和设计意图，但当前系统尚不能完整回答：

- Action 最终由哪个后端 Operation 实现。
- 请求参数来自 Action argument、事件载荷还是页面状态。
- Operation 需要什么认证和运行环境。
- 响应字段如何驱动跳转、消息、组件状态或数据刷新。
- Loading、成功、失败和超时分别如何呈现。
- 某个后端契约变化会影响哪些页面连接。

如果这些关系只存在于手写代码中，PageDocument 与 Schema Context Package 就无法形成端到端规格。Logic / Integration Editor 用结构化、可验证的连接模型补齐这层事实。

## 3. 产品原则

### 3.1 Action 是前后端之间的稳定业务意图

组件不能直接保存 URL 或调用任意接口。页面事件先引用业务 Action，Action 再通过 Integration Binding 绑定到 Operation：

```text
推荐：button_pro.press → billing.selectPlan → billing.createCheckout
禁止：button_pro.press → POST https://example.com/checkout
```

这样可以在后端路径或传输细节变化时保持页面意图稳定，也允许多个页面复用同一个 Action。

### 3.2 连线图是事实的视图，不是事实本身

系统保存稳定 ID、类型化映射和受控效果。节点坐标、缩放、折叠和面板状态只属于编辑器视图，不进入 IntegrationDocument。图形库的内部 `nodes`、`edges` 或坐标格式不能成为公开协议。

### 3.3 后端能力必须注册

Logic Editor 只能连接 Operation Registry 中存在的能力。Operation Registry 可以先由项目配置维护，后续优先从 OpenAPI 等机器契约导入。浏览器不能输入任意目标 URL，也不能读取或保存明文 Secret。

### 3.4 非法连接不可保存

端口类型、必填参数、响应路径、Action 和 Operation 引用必须在提交前验证。验证失败返回具体节点、字段和修复建议，并且不能通过“仍然保存”绕过。

### 3.5 第一版保持单向、确定和可审查

第一版只支持从 UI Event 到单个 Action、单个 Operation 和有限结果效果的单向链路。不支持循环、任意脚本、动态代码执行或隐式副作用。

## 4. 目标用户与核心任务

### 4.1 页面设计者

页面设计者希望看到页面中哪些交互尚未连接，并通过选择和连线完成基础行为，不需要理解 HTTP 细节。

### 4.2 前端或全栈开发者

开发者希望注册或导入 Operation，配置参数与响应映射，测试一次请求，并确定生成规格与真实后端契约一致。

### 4.3 下游 AI 编码工具

AI 希望从导出的 Context Package 中获得完整而无歧义的 UI Event、Action、Operation、映射、效果与约束，而不是根据按钮文案猜测业务实现。

## 5. 信息架构

Studio 提供两个平级编辑模式：

```text
Design
  页面结构、内容、布局、响应式、Token、Variant

Logic
  UI Event、Action、Operation、映射、运行结果和连接问题
```

Logic Editor 使用现有可编排 Workbench，默认布局为：

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Design / Logic     页面与环境       Validate     Test Run     Save    │
├──────────────┬────────────────────────────────────┬──────────────────┤
│ Sources      │          Connection Canvas         │ Inspector        │
│              │                                    │                  │
│ UI Events    │ UI Event → Action → Operation      │ Contract         │
│ Actions      │                    ↘ Success Effect │ Input Mapping    │
│ Operations   │                    ↘ Failure Effect │ Result Effects   │
│              │                                    │ Runtime Policy   │
├──────────────┴────────────────────────────────────┴──────────────────┤
│ Problems / Test Run / Request Trace / History                         │
└──────────────────────────────────────────────────────────────────────┘
```

第一版 Connection Canvas 使用确定的分栏布局和 SVG 连线，不以前置方式建设自由拖动的无限图画布。用户可以选择连接、创建或移除连接、查看类型状态，但节点位置由系统自动排列。

## 6. MVP 功能需求

### 6.1 UI Event 发现

- 从当前 PageDocument 派生所有带 `interactions` 的组件事件。
- 显示页面、节点名称、组件类型、事件、Action 和 arguments。
- 标记未注册 Action、未绑定 Action 和悬空节点引用。
- 从 Logic Editor 选择 UI Event 时，可以定位回 Design Editor 中的页面节点。

### 6.2 Action Catalog

- 展示注册 Action 的名称、描述和输入契约。
- 区分“已被页面引用”“已绑定 Operation”“缺少绑定”三种状态。
- 同一个 Action 可以被多个页面节点引用。
- 第一版不在 Logic Editor 中自由创建后端代码；新增 Action 仍必须形成受验证的项目配置。

### 6.3 Operation Catalog

- 展示 Operation ID、名称、方法、受控路径、输入、输出和认证引用。
- 支持按名称、标签和输入类型搜索。
- 第一版支持手工项目配置；OpenAPI 导入属于紧接 MVP 的扩展能力。
- Operation 不能包含浏览器可见的认证密钥。

### 6.4 Action 到 Operation 的连接

- 一个 Action 在 MVP 中最多绑定一个 Operation。
- 用户可以通过端口拖动或 Inspector 选择建立连接。
- 连接前即时判断输入契约是否兼容。
- 删除连接不会删除 Action、Operation 或 PageDocument 节点。

### 6.5 输入映射

MVP 支持以下 Value Source：

- `literal`：Schema 内允许的字符串、数字或布尔值。
- `actionArgument`：PageDocument interaction 已提供的 Action argument。
- `triggerPayload`：注册组件事件明确声明的载荷字段。

映射界面必须显示来源类型、来源路径、目标字段、目标类型和必填状态。缺少必填字段、引用不存在或类型不兼容时不能保存。

页面状态、跨 Action 输出、表达式和复杂对象变换在 MVP 后再增加。

Operation response 不能直接泄漏为页面契约。Integration Binding 还必须把 `operationResponse` 映射为 Action Registry 已声明的 `actionResult`；后端字段变化时，只修改 Integration Binding，不修改 PageDocument 或页面效果。

### 6.6 生命周期效果

MVP 支持有限效果：

- Pending：`setTriggerState`。
- Success：`navigate`、`showMessage`、`setComponentState`、`refreshDataSource`。
- Failure：`showMessage`、`setComponentState`。

成功效果只能读取已声明的 `actionResult`，失败效果只能读取标准化 `actionError`。第一版不支持页面效果直接读取原始 Operation response，也不支持任意 JavaScript callback。

### 6.7 验证与问题定位

- 保存前验证所有跨文档引用和类型映射。
- Problems Panel 按 Connection、Action、Operation 和页面节点分组。
- 问题必须包含稳定错误码、字段路径、相关 ID 和修复建议。
- 选择问题时定位到对应连接或 Inspector 字段。

### 6.8 测试运行与请求追踪

- 用户可以为单个 Integration Binding 发起 Test Run。
- 默认使用明确选择的本地或 Mock 环境；真实环境必须显式选择。
- Test Run 显示经脱敏的请求、响应、耗时、结果效果和错误阶段。
- 测试请求由 Workspace Server 代理，Preview 和 Studio 不持有 Secret。
- 测试结果是诊断数据，不自动写入正式 IntegrationDocument。

### 6.9 Revision 与导出

- IntegrationDocument 使用 `baseRevision`、Command、验证和正式 Revision。
- PageDocument 与 IntegrationDocument 的 Revision 分开演进，但导出必须记录两者的明确 Revision。
- Schema Context Package 最终增加当前页面使用的 Integration 和 Operation 上下文。
- 编辑器视图坐标和 Test Run 日志不进入 Context Package。

## 7. 首个 Golden Scenario

首个闭环复用 Golden Pricing Page 的 `button_pro`：

```text
button_pro.press
  arguments.planId = "pro"
        ↓
billing.selectPlan(planId: string)
        ↓
billing.createCheckout
  POST /api/billing/checkout
        ↓
request.planId ← actionArgument.planId
        ↓
actionResult.checkoutUrl ← operationResponse.checkoutUrl
        ↓
pending → trigger state = loading
success → navigate(actionResult.checkoutUrl)
failure → showMessage(actionError.message)
```

用户流程：

1. 在 Design Editor 完成 Pricing Page。
2. 切换到 Logic Editor。
3. 看到 `button_pro.press` 已引用 `billing.selectPlan`，但 Action 尚未绑定。
4. 将 Action 连接到注册的 `billing.createCheckout` Operation。
5. 将 `actionArgument.planId` 映射到 `request.planId`。
6. 将 `operationResponse.checkoutUrl` 映射到 `actionResult.checkoutUrl`。
7. 配置成功跳转和失败消息。
8. 通过验证并保存 Integration Revision。
9. 在 Preview 点击 Choose Pro，观察 Loading、请求、响应和最终效果。
10. 导出包含页面与 Integration 上下文的 Context Package。

## 8. MVP 验收标准

以下条件全部满足才构成第一个前后端小闭环：

- Logic Editor 能从真实 PageDocument 派生 `button_pro.press`。
- 用户能将 `billing.selectPlan` 连接到注册 Operation，而不能输入任意 URL。
- 参数映射具有运行时 Schema 验证，错误类型或缺少必填参数时不能保存。
- Integration 修改通过 Command 和 `baseRevision` 提交，并能检测 Revision 冲突。
- Preview 点击按钮后不再只记录日志，而是通过受控 Action Runtime 执行 Test Operation。
- Pending、Success 和 Failure 至少各有一个可见且可验证的效果。
- Request Trace 不泄露认证信息或敏感 Header。
- 导出结果能让 AI 确定 UI Event、Action、Operation、输入映射和结果效果。
- 同一组正式 Revision 可以重复导出相同内容和 Hash。
- 契约、规则、运行时、HTTP 集成和至少一条浏览器 E2E 通过自动化验证。

## 9. MVP 明确不做

- 通用 BPMN、循环、并行分支或长事务编排。
- 任意 JavaScript、表达式解释器或用户上传代码执行。
- 数据库表设计器、SQL 编辑器或后端代码生成平台。
- OAuth、用户体系或 Secret 管理产品本身。
- 多步骤补偿、分布式事务和消息队列编排。
- 自由布局的无限图画布和图形协作。
- 多人实时协作。
- AI 自动替用户建立并直接保存连接。

这些能力只有在第一个确定性闭环稳定后，依据真实场景进入后续产品决策。

## 10. 后续能力

完成 Action 闭环后，下一条业务链路是 Data Source / Prop Binding：

```text
Backend Query Operation
        ↓
Data Source
        ↓
响应字段映射
        ↓
Component Prop / Collection Slot
        ↓
Loading / Empty / Error / Success
```

再后续可以增加条件分支、页面状态、表单字段、分页、缓存与乐观更新，但仍必须使用类型化、受控、可验证的模型。

## 11. 待实施验证的产品问题

- 同一 Action 是否需要按环境或项目配置多个 Operation Binding。
- 页面节点删除时，Integration Binding 应自动移除还是保留为可修复的悬空引用。
- `navigate` 应只允许注册内部 Route，还是同时允许 Operation response 中的受控外部 URL。
- Test Run 的 Mock 数据由 Operation Registry、用户输入还是独立 fixture 提供。
- 多页面共享 Action 时，Logic Editor 默认以页面视角还是 Action 视角打开。

这些问题不阻止 Schema 与首个 Golden Scenario 的第一阶段实现，但在对应能力进入公开协议前必须形成验证结论；需要长期约束时再创建 ADR。
