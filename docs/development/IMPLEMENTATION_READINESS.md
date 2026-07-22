# AI 友好的低代码网页设计器：实施准备与启动计划

> 产品设计参见 [AI_LOW_CODE_DESIGNER.md](../product/AI_LOW_CODE_DESIGNER.md)，技术架构参见 [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)，技术选型参见 [TECHNICAL_DECISIONS.md](../architecture/TECHNICAL_DECISIONS.md)。

## 1. 文档目的

本文档用于明确正式开发之前必须确定的产品边界、编译边界、安全边界和验收基线，并规定项目从领域语言、无界面内核、Workspace Server、真实渲染、人类优先编辑器到 Schema 导出的实施顺序。MCP 和 AI 修改属于后续阶段。

项目不从复杂拖拽画布开始，而从一套可以验证、拒绝非法状态并导出 Schema Context Package 的页面语言内核开始。

第一阶段需要证明：

> 一份受控且独立的 PageDocument 能完整描述真实页面，拒绝非法样式和布局，并导出为下游 AI 可以直接消费的最小、完整、无歧义的 Schema Context Package。

## 2. 产品边界

### 2.1 产品负责什么

产品负责让人类通过拖拽表达：

- 页面包含哪些真实组件。
- 组件之间的结构和语义关系。
- 页面布局和响应式意图。
- 使用哪些 Design Token 和组件变体。
- 页面具有哪些状态和交互。
- 组件与数据、行为之间的声明式绑定。
- 未来 MCP 和自动化客户端可以修改什么、不能修改什么。
- 最终实现需要满足哪些验收条件。

### 2.2 产品不负责什么

MVP 不以以下能力为目标：

- 任意视觉绘图。
- 任意 CSS 编辑。
- 任意绝对定位。
- 无限画布。
- 完整富文本。
- 动画时间轴。
- 任意 JavaScript 编写。
- 任意代码反向解析。
- 多框架同时支持。
- 云端多人协作。
- 通用插件市场。

### 2.3 首个使用场景

首个 Golden Scenario 采用 SaaS Pricing Page：

```text
Pricing Page
├── Navigation
├── Hero
├── Billing Toggle
├── Pricing Section
│   ├── Free Plan
│   ├── Pro Plan（Featured）
│   └── Enterprise Plan
├── FAQ
├── CTA
└── Footer
```

该页面需要覆盖：

- Desktop 三列、Mobile 单列布局。
- 所有颜色、间距、字号和圆角使用 Token。
- Featured Card 使用受控 Variant。
- Badge 使用受控 Overlay 和锚点。
- 月付/年付使用声明式交互。
- Button、Link 和 Toggle 具有正确无障碍语义。
- Loading、Empty、Error、Success 等适用状态能够被表达。

### 2.4 首个目标项目类型

MVP 只承诺：

```text
React + TypeScript + Vite
```

暂不承诺：

- Next.js App Router。
- React Server Components。
- Remix。
- Vue。
- SSR。
- 微前端。
- 任意定制构建系统。

## 3. 事实来源和文件所有权

### 3.1 分层事实来源

```text
组件内部实现                → 组件源码负责
页面使用哪些组件            → Page Schema 负责
组件如何组合和排列          → Page Schema 负责
页面状态、交互和响应式意图  → Page Schema 负责
最终页面代码                → 从 Page Schema 派生
```

MVP 不支持生成代码被自由修改后再自动同步回 Schema。

### 3.2 生成文件所有权

推荐页面文件结构：

```text
src/pages/pricing/
├── PricingPage.generated.tsx   编译器拥有，可以覆盖
├── PricingPage.tsx             人类拥有，不自动覆盖
├── pricing.bindings.ts         AI/人类维护的数据和行为
└── pricing.test.tsx
```

规则：

- `.generated.tsx` 禁止人工修改。
- 人工扩展通过 Wrapper、Slot、Binding 或注册组件完成。
- 未来 MCP 修改人工维护文件时必须展示 Diff。
- Schema 更新后可以安全重新生成派生文件。
- AI 不得在一次普通页面任务中顺手修改组件库、Token 或项目配置。

## 4. 编译边界

### 4.1 确定性编译器负责什么

已经结构化的信息必须由确定性编译器生成：

| 工作 | 负责方 |
|---|---|
| import 真实组件 | 确定性编译器 |
| 生成组件树 | 确定性编译器 |
| 写入 Props 和 Slots | 确定性编译器 |
| 应用 Token 和 Layout Class | 确定性编译器 |
| 生成响应式规则 | 确定性编译器 |
| 验证 Schema 与代码一致性 | 确定性编译器 |
| 生成基础验收检查 | 确定性编译器 |

### 4.2 AI 负责什么

AI 只处理不能被 Schema 完整确定的工程集成任务：

| 工作 | 负责方 |
|---|---|
| 接入现有业务数据 | AI |
| 创建数据查询和 Hook | AI |
| 补充业务事件处理 | AI |
| 将注册 Action 连接到项目代码 | AI |
| 发现缺失组件并提出扩展建议 | AI |
| 修改人工维护的现有页面包装代码 | AI |
| 根据验收结果修复工程集成问题 | AI |

原则：

> 不让 AI 重建 Schema 已经明确表达的信息，也不让编译器猜测业务逻辑。

### 4.3 未来 MCP 修改协议

MVP 只导出 Schema，不提供 AI 设计入口。未来 MCP 客户端只允许：

```text
读取 Schema Context Package
        ↓
返回 Proposed Patch 或受控代码 Diff
        ↓
协议验证
        ↓
Rule Engine
        ↓
用户审查
        ↓
写入与测试
```

## 5. 领域语言准备

正式实现 Schema 前必须统一以下概念：

```text
Node
Component
Layout
Slot
Role
Pattern
Variant
Token
State
Interaction
Binding
Policy
Constraint
Command
Patch
Document
```

关键概念定义：

- `Role`：节点在页面和业务中的用途。
- `ComponentRef`：真实代码组件引用。
- `Slot`：组件允许插入内容的位置和类型边界。
- `Variant`：组件允许的视觉或功能变体。
- `Token`：受控并带有语义的设计值。
- `State`：Loading、Empty、Error、Success 等状态。
- `Interaction`：声明式用户事件和结果。
- `Binding`：组件与数据、Action 之间的连接。
- `Policy`：系统级布局、样式和响应式规则。
- `Constraint`：对页面、组件或 AI 操作的强制限制。
- `Command`：人类和 AI 统一使用的领域操作。
- `Patch`：Command 验证通过后产生的文档变更。

同一概念不能在不同模块中具有不同含义。

## 6. Layout Policy 准备

第一版 Layout Policy 必须明确合法值，而不只是声明支持某种布局。

建议初始集合：

```text
Container width:
- sm
- md
- lg
- full

Spacing:
- none
- xs
- sm
- md
- lg
- xl
- section

Alignment:
- start
- center
- end
- stretch

Grid columns:
- 1
- 2
- 3
- 4
- 6
- 12
```

还必须确定：

- Stack、Row、Grid 的合法嵌套关系。
- 最大推荐和最大允许嵌套深度。
- 哪些组件允许 `full-width`。
- Grid 在移动端的默认降级方式。
- Overflow 的合法表达。
- Overlay 的合法用途、锚点和边界。
- 页面级和组件级响应式职责。

## 7. 首批真实组件

建议先准备 15 个组件：

```text
Button
Link
Heading
Text
Image
Icon
Badge
Card
Navigation
Container
Stack
Row
Grid
PricingCard
FAQItem
```

每个组件必须包含：

- 真实 React 实现。
- Props 类型。
- `*.ui.ts` 注册定义。
- Slots。
- Variants。
- 状态。
- Token 映射。
- 无障碍规则。
- 合法父节点和子节点。
- 正确与错误使用示例。

目录示例：

```text
examples/sample-components/
├── Button/
│   ├── Button.tsx
│   └── Button.ui.ts
├── PricingCard/
│   ├── PricingCard.tsx
│   └── PricingCard.ui.ts
└── ...
```

## 8. 交互与数据绑定边界

MVP 支持：

- 页面跳转。
- 外部链接。
- 打开和关闭。
- 切换 Variant 或 State。
- 表单字段绑定。
- 调用注册 Action。
- 从注册 Data Source 读取数据。

Schema 不能保存任意 JavaScript：

```json
{
  "onClick": "fetch('/api').then(...)"
}
```

应保存声明式行为：

```json
{
  "event": "press",
  "actionRef": "billing.selectPlan",
  "arguments": {
    "planId": {
      "binding": "item.id"
    }
  }
}
```

## 9. Golden Page 数据准备

在实现编辑器之前，先手工创建：

```text
examples/golden-pricing/
├── page.ui.json
├── tokens.json
├── components.json
├── interactions.json
├── constraints.json
└── acceptance.json
```

页面结构示例：

```json
{
  "schemaVersion": "1.0.0",
  "id": "page_pricing",
  "kind": "page",
  "role": "pricing-page",
  "children": [
    {
      "id": "section_pricing",
      "kind": "layout",
      "layout": "section",
      "children": [
        {
          "id": "container_pricing",
          "kind": "layout",
          "layout": "container",
          "width": "lg",
          "children": [
            {
              "id": "grid_plans",
              "kind": "layout",
              "layout": "grid",
              "columns": {
                "mobile": 1,
                "tablet": 2,
                "desktop": 3
              },
              "gapToken": "spacing.lg"
            }
          ]
        }
      ]
    }
  ]
}
```

Golden Page 的作用是验证页面语言能否完整表达目标，而不是作为编辑器演示数据随意调整。

## 10. 非法操作矩阵

第一批反例至少包括：

```text
raw-color.json
raw-spacing.json
absolute-position.json
unknown-component.json
unknown-prop.json
invalid-slot.json
missing-responsive-rule.json
invalid-overlay.json
missing-aria-label.json
unknown-variant.json
```

每个反例必须定义：

- 错误码。
- 错误信息。
- 阻止级别。
- 合法替代建议。
- 是否存在人工审批路径。

测试示例：

```ts
it("rejects absolute positioning on normal nodes", () => {
  const result = applyCommand(document, {
    type: "node.setLayoutProperty",
    nodeId: "pricing-card-pro",
    property: "top",
    value: 12
  });

  expect(result).toEqual({
    accepted: false,
    violations: [
      expect.objectContaining({
        code: "ABSOLUTE_POSITION_FORBIDDEN"
      })
    ]
  });
});
```

## 11. 验收基线

### 11.1 核心成功指标

核心指标：

> 用户完成拖拽后，系统无需补充提问，一次生成可构建、符合设计系统且通过验收的前端代码比例。

拆分指标：

- 构建通过率。
- Schema 与代码一致性。
- 注册组件复用率。
- Token 使用率。
- 非法 CSS 数量必须为 0。
- 普通绝对定位数量必须为 0。
- 响应式规则通过率。
- 无障碍检查通过率。
- AI 首次实现成功率。
- 人工修改生成结果的代码量。

### 11.2 固定回归任务

准备至少 10 个固定任务，用于每次 Schema、规则和 AI 提示变更后的回归验证。例如：

1. 新增一个 Pricing Plan。
2. 将两列 Grid 改为三列。
3. 将 Pro Plan 设置为 Featured。
4. 添加合法 Badge Overlay。
5. 拒绝普通节点绝对定位。
6. 拒绝创建新颜色。
7. 添加移动端单列规则。
8. 为图标按钮补充无障碍名称。
9. 连接注册 Action。
10. 生成同风格 FAQ Section。

评估不能只依赖主观视觉判断。

## 12. 安全边界

### 12.1 Workspace Server

开工前必须明确：

- 可读工作区范围。
- 可写目录白名单。
- 可运行命令白名单。
- 是否允许安装依赖。
- 是否允许访问网络。
- `.env` 和密钥过滤规则。
- 修改前的快照或备份方式。
- 必须人工确认的操作。
- 后台日志允许包含的源码范围。

默认原则：

```text
读取最小化
写入白名单
命令白名单
密钥不进入上下文
修改必须可审查和撤销
```

### 12.2 Preview Host

Preview Host 会执行真实项目代码，因此应视为不可信运行环境。必须确定：

- iframe `sandbox` 权限。
- 是否同源。
- 是否允许网络请求。
- 是否允许打开新窗口。
- 用户项目代码的执行权限。
- 崩溃和死循环的隔离方式。
- `postMessage` 来源与协议版本验证。

## 13. 工程准备

仓库初始化前确定：

- Node 版本。
- pnpm 版本。
- TypeScript 版本。
- ESM/CJS 策略。
- 包命名和导出规范。
- Lint 和 Format 规范。
- Commit 规范。
- CI 基础任务。
- 依赖升级策略。

CI 第一版至少运行：

```text
typecheck
lint
unit test
contract test
build
```

### 13.1 Schema 版本

从第一天加入：

```json
{
  "schemaVersion": "1.0.0"
}
```

版本规则：

- Patch 必须声明协议版本。
- 旧文档不能被新版本静默修改。
- 破坏性变更必须提供 Migration。
- 组件注册表保存版本或内容 Hash。
- Token 和 Pattern 引用能够检测失效。

## 14. 最小代码结构

第一阶段只创建完成无界面闭环所需的包：

```text
/
├── packages/
│   ├── document-schema/
│   ├── document-codec/
│   ├── design-tokens/
│   ├── component-registry/
│   ├── rule-engine/
│   ├── command-engine/
│   ├── document-engine/
│   ├── api-protocol/
│   └── context-exporter/
├── apps/
│   └── workspace-server/
├── examples/
│   ├── golden-pricing/
│   └── sample-components/
├── tests/
│   ├── contracts/
│   └── invalid-cases/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

暂不创建 Studio、Preview Host、MCP Server、云端服务和多人协作模块。

## 15. 无界面内核

第一份可运行代码需要完成：

```text
读取 PageDocument
      ↓
验证 JSON Schema
      ↓
验证组件和 Token 引用
      ↓
运行布局规则
      ↓
接受一条 Command
      ↓
产生 Document Patch
      ↓
重新验证
      ↓
生成 Schema Context Package
```

建议开发命令：

```bash
pnpm ui validate examples/golden-pricing/page.ui.json
pnpm ui apply examples/golden-pricing/commands/add-card.json
pnpm ui export examples/golden-pricing/page.ui.json
```

编译输出：

```text
examples/golden-pricing/.ui-context/
├── document.json
├── components.json
├── tokens.json
├── policies.json
├── actions.json
├── constraints.json
└── manifest.json
```

第一份代码的完成标准是：

> `page.ui.json` 能通过验证，`absolute-position.json` 会被拒绝，并且能够生成完整、带版本和内容 Hash 的 Schema Context Package。

## 16. 后续实施阶段

### 16.1 M0：领域语言

完成：

- Golden Page。
- Design Token。
- 15 个真实组件定义。
- Layout Policy。
- 非法操作矩阵。
- 领域词汇表。

### 16.2 M1：无界面内核

完成：

- Schema 验证。
- Rule Engine。
- Command。
- Patch。
- Document Codec 与版本迁移。
- Context Exporter。
- CLI 验证、应用和导出命令。

### 16.3 M2：Workspace Server

完成：

- Document Service。
- Catalog Service。
- Validation Service。
- History Service。
- HTTP 和 WebSocket 协议。
- 使用 `baseRevision` 的事务提交与冲突检测。

验收：Studio 之外的测试客户端能够读取文档、提交 Command、获得新 Revision，并在冲突时收到明确拒绝。

### 16.4 M3：真实渲染

创建：

```text
packages/react-renderer/
apps/preview-host/
```

验收：

- Golden Page 使用真实 React 组件渲染。
- Desktop、Tablet、Mobile 正确切换。
- Schema 不包含任意 CSS。
- Badge Overlay 正确显示。
- Token 修改影响所有引用节点。
- 渲染异常不会导致宿主应用崩溃。

### 16.5 M4：人类优先的最小编辑器

创建 `apps/studio`，第一版只实现：

1. 显示已注册组件。
2. 渲染 Golden Page。
3. 将组件插入合法 Slot。
4. 重新排列节点。
5. 修改合法 Props 和 Token。
6. 显示规则错误和修复建议。
7. 撤销和重做。

暂不实现自由缩放、复杂快捷键、多人协作和高保真动画。

### 16.6 M5：Schema 导出闭环

完成：

- 从正式 Document Revision 导出 Context Package。
- 只解析当前页面实际引用的组件、Token、Policy 和 Action。
- 输出协议版本和内容 Hash。
- 使用固定 Golden Page 验证导出可重复。

MVP 在 M5 完成后成立：人类可以独立完成页面设计，并把高质量 Schema Context Package 交给任意外部 AI 编码工具。

### 16.7 M6：MCP 与 AI 修改（后置）

第一个 AI 任务：

> 在 Pricing Grid 中新增 Team Plan，复用 PricingCard，不创建新颜色、间距或组件，并保持现有响应式规则。

AI 通过 MCP 返回 Proposed Commands，必须走和人类拖拽完全相同的 Command、Rule Engine、Revision 和审查流程。

验收：

- AI 使用现有 PricingCard。
- AI 不创建新 Token 或 Variant。
- AI 不使用任意 CSS。
- 移动端布局保持合法。
- Patch 可逐项审查和撤销。

## 17. 正式开工条件

以下条件满足后再开始主要实现：

1. 确定 PageDocument、确定性导出器和下游 AI 的职责边界。
2. 确定 SaaS Pricing Page 为首个 Golden Scenario。
3. 确定 React + TypeScript + Vite 为首个目标。
4. 确定生成文件所有权规则。
5. 完成领域词汇表。
6. 完成第一版 Layout Policy。
7. 确定首批组件清单。
8. 手写一份完整 Golden Page Schema。
9. 准备非法操作矩阵。
10. 明确 `document-schema` 的零业务依赖边界。
11. 明确 Studio 与 Workspace Server 的 API、Revision 和事务边界。
12. 明确 Workspace Server 和 Preview Host 的安全边界。

最优先完成的三项资产是：

> Golden Page Schema + 15 个组件定义 + 非法操作矩阵。

它们将直接验证项目设计的页面语言是否足以让人类通过拖拽表达意图，并稳定导出高质量、无歧义、可验证的 Schema Context Package。

## 18. 当前不阻塞 MVP 的事项

- 云端数据库。
- 用户和团队系统。
- 多人协作与 CRDT。
- 桌面应用。
- 插件市场。
- Vue Renderer。
- Web Components Renderer。
- Next.js 支持。
- 完整富文本。
- 动画时间轴。
- 任意代码反向解析。
- MCP Server 和 AI 修改画布。
