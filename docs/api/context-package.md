# Schema Context Package

> 当前协议版本：`2.0.0`
> 最后更新：2026-07-24

本文是 Schema Context Package 文件内容与导出规则的唯一权威定义。导出实现位于 `packages/context-exporter`，HTTP 入口见 [Workspace Server API](./workspace-server.md) 的 `POST /v1/export`；其他文档只描述概念并链接本文，不复制文件清单。

## 1. 文件内容

```text
.ui-context/
├── document.json          PageDocument，页面唯一事实来源
├── components.json        当前页面引用的组件定义
├── tokens.json            当前页面引用的 Token
├── policies.json          当前页面适用的规则
├── actions.json           Action 和 Data Source
├── constraints.json       禁止事项
├── assets.json            项目级 Composite 与 Pattern 资产
└── manifest.json          协议版本与内容 Hash
```

`document.json` 是页面唯一事实来源；其他文件只帮助下游工具解析其中的引用，不构成第二份页面事实来源。

## 2. 导出规则

- 引用裁剪：只导出指定 Revision 实际引用的组件、Token、Policy 和 Action，不导出整个项目 Catalog。
- 稳定序列化：同一 Document Revision 重复导出的文件内容逐字节一致。
- `manifest.json` 记录协议版本、Schema 版本、每个文件的 SHA-256 和整体内容 Hash。
- Exporter 只读取文档和引用注册表，不修改 PageDocument，也不写入任何 AI 厂商特定字段。
- `assets.json` 输出 Workspace 已严格校验的正式项目资产快照；它不包含任何旧浏览器资产或兼容字段。
- 输出目录由 Workspace Server 在启动时配置，客户端不能传入任意路径；指向同一目录的导出按请求顺序串行执行。

## 3. 计划演进

Logic / Integration Editor 计划增加 `operations.json` 和 `integrations.json`。该变更会改变协议内容与整体 Hash，实施时必须同步升级协议版本策略、Manifest Schema、稳定序列化与 Hash 契约测试以及本文档，见 [Logic / Integration Editor 架构](../architecture/logic-integration-editor.md)。
