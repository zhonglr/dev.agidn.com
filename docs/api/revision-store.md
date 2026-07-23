# Revision Store 持久化格式

> 当前格式版本：`1.0.0`

Workspace Server 将每个 PageDocument 的 Revision 状态保存在文档同目录下：

```text
<document-directory>/.revision-store/<document-name>.revisions.json
```

例如 `examples/golden-pricing/page.ui.json` 对应：

```text
examples/golden-pricing/.revision-store/page.ui.revisions.json
```

`.revision-store/` 是本地运行状态，默认不进入 Git。启动日志会输出实际文件路径；应用装配测试也可以显式传入其他路径。

## 状态内容

```json
{
  "formatVersion": "1.0.0",
  "revisions": [],
  "history": [],
  "undoStack": [],
  "redoStack": []
}
```

- `revisions` 保存从 0 开始、连续递增的完整 PageDocument 快照。
- `history` 保存每次 commit、undo 和 redo 的来源、Command 与 Patch。
- `undoStack` 和 `redoStack` 保存导航所需的文档检查点。
- 已使用的 `commandId` 从 commit history 派生，重启后仍会拒绝重复 Command。

所有字段都经过 TypeBox Schema 和领域不变量校验。未知格式版本、断裂的 Revision 序列、非法 PageDocument 或 Command/Patch 不一致都会阻止服务启动，避免静默恢复损坏状态。

## 原子写入

每次成功写操作按以下顺序发布：

```text
候选内存状态 → 同目录临时文件 → fsync → atomic rename → 发布为当前内存状态
```

如果落盘失败，Application Service 返回内部错误，当前内存 Revision 保持不变。临时文件会被清理，同一进程中的写操作按顺序执行。

## 初始文档一致性

Revision 0 保留首次启动时的 PageDocument。恢复时，Revision Store 的文档 ID 必须与启动参数指向的 PageDocument ID 一致；不匹配时服务拒绝启动。

当前还没有 Revision Store migration。升级格式前需要先提供显式迁移路径，不能直接修改 `1.0.0` 的含义。
