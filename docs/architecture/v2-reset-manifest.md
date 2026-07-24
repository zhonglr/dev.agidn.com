# V2 破坏性重置清单

> 状态：Completed
> 执行日期：2026-07-24

本清单只记录 V2 基线切换时明确删除的旧目标，不是迁移输入，也不授权删除工作区根目录或任何未列出的路径。

## 已删除仓库目标

- `examples/golden-pricing/`
- `examples/sample-components/`
- `apps/preview-host/`
- `packages/preview-protocol/`
- `apps/studio/src/ComponentWorkbench.tsx`
- `apps/studio/src/component-workbench-navigation.tsx`
- `apps/studio/src/custom-components.ts`
- `tests/contracts/golden-page.test.ts`
- `tests/contracts/studio-custom-components.test.ts`
- 只引用旧组件、旧字段、Saved/Custom MIME 和旧 Revision 协议的 Fixture、样式与测试
- iframe、跨窗口消息、`VITE_PREVIEW_URL`、`4174` 独立预览进程和对应兼容代码

## 已废止浏览器键

- `agidn.studio.custom-components`
- `agidn.studio.saved-components`
- `agidn.studio.workspace.pages`
- `agidn.studio.workspace.page-view`
- `agidn.studio.workbench.layout.v2`
- `agidn.studio.workbench.layout.v3`
- `agidn.studio.palette.recent.v1`

新代码不得读取、迁移或写入这些键。浏览器偏好与当前 Studio 状态只使用全新 V2 命名空间；项目 Composite/Pattern 禁止进入浏览器存储。

## 持续验证

`pnpm reset:verify` 只验证精确旧仓库目标不存在，不执行删除。它可以重复运行，并且不会触碰当前 Foundation Project、Revision Store 或导出结果。
