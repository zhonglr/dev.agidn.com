# Project Revision Store 持久化格式

> 当前项目格式版本：`3.0.0`

Workspace Server 将 `PageDocument + ProjectAssets` 的完整 Project Revision 状态保存在文档同目录下：

```text
<document-directory>/.revision-store/<document-name>.project-revisions.json
```

例如 `examples/foundation/page.ui.json` 对应：

```text
examples/foundation/.revision-store/page.ui.project-revisions.json
```

`.revision-store/` 是本地运行状态，默认不进入 Git。启动日志会输出实际文件路径；应用装配测试也可以显式传入其他路径。

## 状态内容

```json
{
  "formatVersion": "3.0.0",
  "revisions": [],
  "history": [],
  "undoStack": [],
  "redoStack": []
}
```

- `revisions` 保存从 0 开始、连续递增的完整 `{ document, assets }` 项目快照。
- `history` 保存每次 commit、undo、redo 和 restore 的来源，以及 Document/Asset Command 与对应 Patch。
- `undoStack` 和 `redoStack` 保存导航所需的完整项目检查点。
- 已使用的 `commandId` 从 commit history 派生，重启后仍会拒绝重复 Command。

所有字段都经过 TypeBox Schema 和领域不变量校验。未知格式版本、断裂的 Revision 序列、非法 PageDocument/Assets、越界检查点或 Command/Patch 不一致都会阻止服务启动，避免静默恢复损坏状态。

## 原子写入

每次成功写操作按以下顺序发布：

```text
候选内存状态 → 同目录临时文件 → fsync → atomic rename → 发布为当前内存状态
```

如果落盘失败，Application Service 返回内部错误，当前内存 Revision 保持不变。临时文件会被清理，同一进程中的写操作按顺序执行。

## 初始文档一致性

Revision 0 保留首次启动时的完整项目快照。恢复时，Revision Store 的文档 ID 必须与启动参数指向的 PageDocument ID 一致；不匹配时服务拒绝启动。

当前项目 Store 只接受精确 `3.0.0` 格式；旧 `2.0.0` Document-only Revision Store、Service、Endpoint 和状态文件均已删除，不读取、不迁移、不兼容。
