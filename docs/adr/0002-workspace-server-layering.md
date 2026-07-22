# ADR-0002：Workspace Server 使用分层模块化单体

- 状态：Accepted
- 日期：2026-07-22

## 背景

Workspace Server 同时承担本地文件访问、协议验证、Document Transaction 和未来 Preview 生命周期管理。如果 HTTP、文件系统和领域逻辑直接互相调用，Studio 与未来 MCP 将难以复用同一应用服务。

## 决策

Workspace Server 使用以下单向分层：

```text
Transport → Application Port/Service → Document Engine
Infrastructure ────────────────↗
Composition Root 负责组装具体实现
```

- Transport 只处理 HTTP 和 API Protocol。
- Application Service 映射协议请求与领域结果。
- Infrastructure 实现文件系统和未来持久化 Adapter。
- Document Engine 不知道 HTTP、文件系统或具体应用。

## 结果

- HTTP、未来 WebSocket 和 MCP 可以复用同一 Application Service。
- 持久化实现可以替换而不修改 Command 和 Rule Engine。
- 依赖边界通过契约测试自动检查。
- 需要维护 Port 和结果映射，但换来明确的安全与测试边界。

## 替代方案

- 在 HTTP Route 中直接操作 Document Engine：实现快，但会复制规则、弱化安全边界，拒绝。
- 早期微服务：当前没有部署或扩展需求，会增加不必要复杂度，拒绝。
