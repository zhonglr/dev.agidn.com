# Workspace Server API

> 当前协议版本：`1.0.0`

Workspace Server 是 Studio 与本地项目之间的边界。HTTP Transport 只解析和验证协议，再调用 Application Service；它不能直接修改 PageDocument。

## 启动

```bash
pnpm workspace-server examples/golden-pricing/page.ui.json 4178
```

默认监听 `127.0.0.1:4178`。

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
| 404 | Endpoint 不存在 |
| 405 | Endpoint 不支持该 Method |
| 409 | `baseRevision` 已过期 |
| 413 | 请求体超过限制 |
| 422 | Command、Rule 或导航操作被拒绝 |
| 500 | Transport 或 Application 返回无效结果 |

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

## 当前限制

- Revision 仅保存在内存中，进程重启后恢复到页面文件初始状态。
- 暂无 History、Catalog、Export 和 WebSocket Endpoint。
- 当前仅监听本机回环地址。
