# 项目文档中心

项目文档统一保存在 `docs/`。根目录只保留面向首次访问者的 `README.md`。

## 产品

- [产品设计](./product/AI_LOW_CODE_DESIGNER.md)：产品定位、核心能力、页面结构和 MVP 验收标准。

## 架构

- [技术架构](./architecture/ARCHITECTURE.md)：模块职责、依赖边界和核心数据流。
- [技术决策](./architecture/TECHNICAL_DECISIONS.md)：已确定选型、MVP 默认和后置能力。

## 开发

- [当前实现状态](./development/CURRENT_STATUS.md)：完成度、可运行能力和后续顺序。
- [贡献指南](./development/CONTRIBUTING.md)：编码、文件拆分、依赖和测试规范。
- [实施准备](./development/IMPLEMENTATION_READINESS.md)：M0～M6 路线与验收基线。

## API

- [Workspace Server API](./api/WORKSPACE_SERVER.md)：本地 HTTP API 协议和示例。
- [Revision Store](./api/REVISION_STORE.md)：版本化持久化格式、恢复与原子写入保证。

## ADR

- [ADR 索引](./adr/README.md)：已经落地的工程决策及其理由。

## 文档维护规则

- 功能完成度发生变化时更新 `CURRENT_STATUS.md`。
- 外部协议变化时同时更新运行时 Schema、契约测试和 API 文档。
- 架构边界或技术选型变化时新增 ADR，不能只修改现有结论。
- 文档中的命令必须能够在仓库根目录执行。
