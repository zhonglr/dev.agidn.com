# Workspace Server API

> 当前协议版本：`1.0.0`

Workspace Server 是 Studio 与本地项目之间的边界。HTTP Transport 只解析和验证协议，再调用 Application Service；它不能直接修改 PageDocument。

## 启动

```bash
pnpm workspace-server examples/golden-pricing/page.ui.json 4178
```

默认监听 `127.0.0.1:4178`。

首次启动会在 PageDocument 同目录创建 `.revision-store/<document-name>.revisions.json`。后续启动会恢复完整 Revision、Command/Patch history 和 undo/redo 状态，详见 [Revision Store 持久化格式](./revision-store.md)。

## 通用规则

- 请求和响应使用 `application/json`。
- 所有消息携带 `protocolVersion`。
- 请求对象禁止未知字段。
- 写请求携带当前 `baseRevision`。
- 请求体最大 1 MiB。

## 状态码

| HTTP | 含义 |
| --- | --- |
| 200 | 查询或事务成功 |
| 400 | JSON 或协议 Schema 无效 |
| 404 | Endpoint 或请求的 Revision 不存在 |
| 405 | Endpoint 不支持该 Method |
| 409 | `baseRevision` 已过期 |
| 413 | 请求体超过限制 |
| 422 | Command、Rule 或导航操作被拒绝 |
| 500 | Transport、Application 或持久化失败 |

## GET `/v1/document`

返回当前正式 Revision。

```json
{
  "protocolVersion": "1.0.0",
  "ok": true,
  "revision": {
    "revision": 0,
    "document": {},
    "createdAt": "2026-07-22T00:00:00.000Z"
  }
}
```

`document` 是完整 PageDocument；示例中省略了具体内容。

## GET `/v1/history`

返回单调 Revision 事件流和当前导航能力。Commit 条目包含正式解析后的 Command 和 Patch；undo/redo/restore 条目包含目标 Revision。

```json
{
  "protocolVersion": "1.0.0",
  "ok": true,
  "currentRevision": 2,
  "canUndo": true,
  "canRedo": true,
  "entries": [
    {
      "kind": "commit",
      "revision": 1,
      "parentRevision": 0,
      "createdAt": "2026-07-22T00:00:01.000Z",
      "source": "human",
      "commands": [
        {
          "commandId": "cmd_set_pricing_role",
          "protocolVersion": "1.0.0",
          "type": "node.setRole",
          "nodeId": "text_hero",
          "role": "pricing-summary"
        }
      ],
      "patches": [
        {
          "protocolVersion": "1.0.0",
          "commandId": "cmd_set_pricing_role",
          "operations": [
            {
              "op": "node.update",
              "nodeId": "text_hero",
              "changes": { "role": "pricing-summary" }
            }
          ]
        }
      ]
    },
    {
      "kind": "undo",
      "revision": 2,
      "parentRevision": 1,
      "createdAt": "2026-07-22T00:00:02.000Z",
      "source": "human",
      "targetRevision": 0
    }
  ]
}
```

## GET `/v1/catalog`

返回当前 Workspace 的完整只读 Catalog：

```json
{
  "protocolVersion": "1.0.0",
  "ok": true,
  "components": { "version": "1.0.0", "components": {} },
  "tokens": { "version": "1.0.0", "tokens": {} },
  "policies": {},
  "actions": { "version": "1.0.0", "actions": {}, "dataSources": {} },
  "constraints": {}
}
```

Catalog 用于 Studio 的资源面板和属性配置。Context Exporter 仍只把指定 Revision 实际引用的组件、Token 和 Action 写入导出包。

## POST `/v1/commands`

原子提交一组领域 Command。

```json
{
  "protocolVersion": "1.0.0",
  "baseRevision": 0,
  "source": "human",
  "commands": [
    {
      "commandId": "cmd_set_pricing_role",
      "protocolVersion": "1.0.0",
      "type": "node.setRole",
      "nodeId": "text_hero",
      "role": "pricing-summary"
    }
  ]
}
```

成功响应包含新 Revision 和 Patch：

```json
{
  "protocolVersion": "1.0.0",
  "ok": true,
  "revision": {
    "revision": 1,
    "document": {},
    "createdAt": "2026-07-22T00:00:01.000Z"
  },
  "patches": [
    {
      "protocolVersion": "1.0.0",
      "commandId": "cmd_set_pricing_role",
      "operations": [
        {
          "op": "node.update",
          "nodeId": "text_hero",
          "changes": { "role": "pricing-summary" }
        }
      ]
    }
  ]
}
```

Revision 冲突：

```json
{
  "protocolVersion": "1.0.0",
  "ok": false,
  "error": "REVISION_CONFLICT",
  "currentRevision": 3
}
```

规则拒绝：

```json
{
  "protocolVersion": "1.0.0",
  "ok": false,
  "error": "COMMAND_REJECTED",
  "currentRevision": 3,
  "commandIndex": 0,
  "violations": [
    {
      "code": "ABSOLUTE_POSITION_FORBIDDEN",
      "message": "Normal nodes cannot set 'top'; use a controlled Overlay.",
      "nodeId": "grid_plans"
    }
  ]
}
```

## POST `/v1/undo`

```json
{
  "protocolVersion": "1.0.0",
  "baseRevision": 1,
  "source": "human"
}
```

成功后创建新的 Revision，不会把 Revision 数字向后移动。

## POST `/v1/redo`

请求结构与 undo 相同。没有可重做状态时返回 422 和 `NOTHING_TO_REDO`。

## POST `/v1/history/restore`

把指定历史 Revision 的文档快照恢复为当前状态：

```json
{
  "protocolVersion": "1.0.0",
  "baseRevision": 8,
  "targetRevision": 3,
  "source": "human"
}
```

恢复不会移动或覆盖既有 Revision，而是创建一个新的单调 Revision，并写入 `kind: "restore"`、`targetRevision: 3` 的 History 条目。恢复前的状态会进入 undo 栈，因此恢复操作本身也可以撤销。目标 Revision 不存在时返回 404 和 `REVISION_NOT_FOUND`；目标已经是当前 Revision 时返回 422 和 `ALREADY_CURRENT`。

## POST `/v1/export`

从指定的正式 Revision 导出 Schema Context Package。省略 `revision` 时导出当前 Revision。

```json
{
  "protocolVersion": "1.0.0",
  "revision": 3
}
```

成功响应：

```json
{
  "protocolVersion": "1.0.0",
  "ok": true,
  "revision": 3,
  "outputDirectory": "/workspace/project/.ui-context",
  "manifest": {
    "protocolVersion": "1.0.0",
    "documentId": "page_pricing",
    "schemaVersion": "1.0.0",
    "hashAlgorithm": "sha256",
    "files": {},
    "contentHash": "0000000000000000000000000000000000000000000000000000000000000000"
  }
}
```

如果 Revision 不存在，返回 404 和 `REVISION_NOT_FOUND`。客户端不能传入输出目录；Workspace Server 只写入启动时配置的目录，默认是 PageDocument 同目录的 `.ui-context`。指向同一目录的导出会按请求顺序写入，避免并发文件交错。

## 当前限制

- 暂无独立 Validation 和 WebSocket Endpoint。
- 暂无 Revision Store 格式迁移和外部 PageDocument 文件变更协调。
- 当前仅监听本机回环地址。
