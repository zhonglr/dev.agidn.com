# ADR-0001：运行时协议验证使用 TypeBox Schema Compiler

- 状态：Accepted
- 日期：2026-07-22

## 背景

PageDocument、Command、Patch 和 Workspace Server 消息会跨越文件与进程边界，TypeScript 静态类型不能验证这些输入。技术决策要求使用 JSON Schema 2020-12 对等模型，并在 Ajv 与 TypeBox Schema Compiler 之间选择运行时验证器。

## 决策

首个实现使用 TypeBox 定义权威 Schema，并使用 TypeBox Schema Compiler 编译验证器。

静态类型尽量通过 `Static<typeof Schema>` 从同一 Schema 派生。所有外部 Object Schema 默认禁止额外字段。

## 结果

- Schema 与 TypeScript 类型共享权威定义。
- 验证器无额外 Ajv 配置层，适合当前小型协议包。
- 外部消息能在进入 Application Service 前被拒绝。
- 如果未来出现 JSON Schema 兼容性或错误报告需求，可通过新 ADR 迁移到 Ajv。

## 替代方案

- 只使用 TypeScript Interface：不能验证运行时输入，拒绝。
- Ajv：能力完整，但当前没有证据表明额外配置复杂度有收益，暂不采用。
