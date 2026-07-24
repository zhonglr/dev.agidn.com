# Workspace Server API

> 当前协议版本：`2.0.0`

Workspace Server 是 Studio 与本地项目之间的唯一写入边界。HTTP Transport 只验证协议并调用 Project Application Service，不能直接修改 PageDocument 或 `assets.json`。

## 启动

```bash
pnpm workspace-server examples/foundation/page.ui.json 4178
```

默认监听 `127.0.0.1:4178`。首次启动会创建：

```text
<document-directory>/.revision-store/<document-name>.project-revisions.json
```

该文件保存完整 `PageDocument + ProjectAssets` Revision、History 和 undo/redo 检查点，详见 [Project Revision Store](./revision-store.md)。

## 通用规则

- 请求和响应使用 `application/json`。
- 所有消息携带 `protocolVersion: "2.0.0"`。
- 请求对象禁止未知字段。
- 写请求携带当前 `baseRevision`。
- 请求体最大 1 MiB。
- Document Command 与 Asset Command 可处于同一原子事务。

## Endpoint

```text
GET  /v1/project
GET  /v1/project/history
GET  /v1/catalog
POST /v1/project/commands
POST /v1/project/undo
POST /v1/project/redo
POST /v1/project/history/restore
POST /v1/export
```

不存在 Document-only Endpoint，也不提供旧 Revision 格式迁移或 Adapter。

## 状态码

| HTTP | 含义 |
| --- | --- |
| 200 | 查询或事务成功 |
| 400 | JSON 或协议 Schema 无效 |
| 404 | Endpoint 或 Revision 不存在 |
| 405 | Endpoint 不支持该 Method |
| 409 | `baseRevision` 已过期 |
| 413 | 请求体超过限制 |
| 422 | Command、Rule 或导航操作被拒绝 |
| 500 | Transport、Application 或持久化失败 |

## GET `/v1/project`

返回当前完整 Project Revision：

```json
{
  "protocolVersion": "2.0.0",
  "ok": true,
  "revision": {
    "revision": 0,
    "project": {
      "document": {},
      "assets": {
        "schemaVersion": "2.0.0",
        "composites": {},
        "patterns": {}
      }
    },
    "createdAt": "2026-07-24T00:00:00.000Z"
  }
}
```

成功的 undo、redo 和 restore 使用同一 Revision 结构，不会只返回 PageDocument。

## GET `/v1/project/history`

返回单调 Revision 事件流和当前导航能力。Commit 条目包含按顺序一一对应的 Document/Asset Command 与 Patch；导航条目包含目标 Revision。

## GET `/v1/catalog`

返回基于当前 Project Revision 动态合成的 Registry、Token、Action、Policy、Constraint 和 Assets。成功 Asset Command 后，Catalog 不读取启动时旧快照。

## POST `/v1/project/commands`

原子提交一组领域 Command：

```json
{
  "protocolVersion": "2.0.0",
  "baseRevision": 0,
  "source": "human",
  "commands": [
    {
      "protocolVersion": "2.0.0",
      "commandId": "asset_upsert_callout",
      "type": "asset.composite.upsert",
      "asset": {}
    },
    {
      "protocolVersion": "2.0.0",
      "commandId": "insert_callout_instance",
      "type": "node.insert",
      "targetParentId": "stack_main",
      "node": {}
    }
  ]
}
```

整个数组要么共同进入一个 Revision，要么整体回滚。成功响应返回完整 Project Revision 和同序 Patch；冲突返回 409，Schema 无效返回 400，领域拒绝返回 422。

## 导航

`POST /v1/project/undo` 与 `POST /v1/project/redo`：

```json
{
  "protocolVersion": "2.0.0",
  "baseRevision": 1,
  "source": "human"
}
```

`POST /v1/project/history/restore`：

```json
{
  "protocolVersion": "2.0.0",
  "baseRevision": 8,
  "targetRevision": 3,
  "source": "human"
}
```

导航不会覆盖既有 Revision，而是创建新的单调 Revision。restore 本身可以 undo；目标不存在返回 404，目标已是当前版本返回 422。

## POST `/v1/export`

从指定 Project Revision 导出 Context Package；省略 `revision` 时导出当前版本：

```json
{
  "protocolVersion": "2.0.0",
  "revision": 3
}
```

导出使用该历史 Revision 自身的 Document 和 Assets，不会混入当前 Catalog。客户端不能指定输出路径；同目录导出按请求顺序写入。

## 当前限制

- 暂无独立 Validation 和 WebSocket Endpoint。
- 暂无外部项目文件变化协调。
- 当前仅监听本机回环地址。
