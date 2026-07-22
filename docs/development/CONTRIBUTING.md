# 贡献指南

## 基础环境

- Node.js 22 或更高版本。
- pnpm 10.13.1。
- TypeScript ESM，模块解析使用 NodeNext。
- 仓库只允许一个 `pnpm-lock.yaml`，不要提交 `package-lock.json` 或 yarn lockfile。

安装和验证：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## 核心写入原则

任何客户端都不能直接修改正式 PageDocument。所有写入必须经过：

```text
Command → Rule Engine → Patch → Transaction → Document Revision
```

Studio、HTTP Transport、Workspace Server 和未来 MCP 都必须复用同一条路径。

## 依赖方向

```text
document-schema
      ↑
codec / registry / rules
      ↑
command-engine
      ↑
document-engine
      ↑
application ports/services
      ↑
transport / infrastructure
```

强制规则：

- `document-schema` 不依赖任何内部业务包。
- `document-codec` 只依赖 `document-schema`。
- Command Handler 不依赖持久化、HTTP 或具体 Registry Adapter。
- `document-engine` 不依赖文件系统、网络和 `apps/`。
- Transport 只依赖 Application Port 和 API Protocol。
- Application 不依赖 Transport 或 Infrastructure 实现。
- Infrastructure 不能绕过 Application Service 写 Document。
- 具体实现只在 composition root 中组装。

修改边界时必须更新 `tests/contracts/module-boundaries.test.ts`。

## Package 和文件拆分

- 只有存在独立依赖边界、多个消费者或独立发布需要时才创建 package。
- 优先在现有 package 内按职责拆文件，避免一个概念一个 workspace。
- 一个文件只承担一个清晰职责。
- Command 使用独立 Handler 文件。
- Schema、静态类型、业务执行、传输和 Adapter 分开。
- `index.ts` 只公开稳定 API，不承载业务逻辑。
- 跨 package 使用 `@agidn/*` 和 `workspace:*`，禁止跨 package 相对路径。

## TypeScript 约定

仓库启用 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 和 `verbatimModuleSyntax`。

- 类型导入使用 `import type`。
- 相对 ESM 导入保留 `.js` 后缀。
- 不使用 `any` 绕过协议或领域类型。
- 外部 JSON、HTTP 和文件输入不能只做类型断言，必须运行时验证。
- 不把调用者传入的可变对象直接保存到 Document 或 Revision；先 `structuredClone`。
- 函数返回领域结果联合类型，不使用异常表达正常的规则拒绝或 Revision 冲突。

## Schema 和协议

- 跨进程协议使用 TypeBox 和 TypeBox Schema Compiler。
- Object Schema 默认设置 `additionalProperties: false`。
- 请求、响应、Command、Patch 和持久化格式必须有版本。
- Schema 和 TypeScript 类型应来自同一权威定义，避免手工复制并产生漂移。
- 协议字段变化必须同时更新契约测试和对应文档。

## PageDocument 约束

PageDocument 不能包含：

- `style`、`className`、任意 CSS 或 Tailwind arbitrary value。
- 原始颜色、像素、任意尺寸和局部样式对象。
- 普通节点的 `x`、`y`、`top`、`left` 或通用 `position`。
- 任意 JavaScript、React、DOM、后端存储状态或客户端临时状态。

页面只保存 Component、Token、Variant、Policy、Action 等注册引用。

## Command 和 Revision

- Command 必须有稳定 `commandId` 和 `protocolVersion`。
- 外部写入必须携带 `baseRevision`。
- 批量 Command 原子执行，任意一条失败都不能产生 Revision。
- Command ID 不能重复提交。
- Revision 单调递增；undo/redo 也创建新 Revision。
- 存储信息和网络状态不能写入 PageDocument。

## 测试约定

每项功能至少覆盖：

- 合法路径。
- 非法输入或规则拒绝。
- 原始文档没有被污染。
- Runtime Schema 拒绝未知字段。
- 涉及写入时的事务回滚和 Revision 冲突。
- 涉及新依赖时的模块边界。

规则测试优先使用表驱动和 JSON fixture。负向测试与合法测试同等重要。

提交前必须通过：

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 命名习惯

- Package：`@agidn/<kebab-case>`。
- 文件：`kebab-case.ts`。
- Command：`node.<verbOrIntent>`。
- Rule/Error Code：大写下划线，例如 `ABSOLUTE_POSITION_FORBIDDEN`。
- Token：点分语义引用，例如 `spacing.lg`、`color.action.primary`。
- Schema/Protocol Version：语义版本字符串。

## 文档和决策

- 完成功能后更新 `CURRENT_STATUS.md`。
- API 变化后更新 `docs/api/`。
- 架构或技术选择改变时新增 ADR。
- 不通过静默修改旧文档来掩盖已经发生的决策变化。
