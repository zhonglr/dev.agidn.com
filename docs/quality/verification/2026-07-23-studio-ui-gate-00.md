# Studio UI Gate 00：Spectrum 2 兼容性验证

> 日期：2026-07-23
> 状态：通过，可继续增量迁移；包体积与自动化浏览器测试列为后续门槛。
> 架构基线：[Studio UI 系统架构](../../architecture/studio-ui-system.md) / [ADR-0004](../../adr/0004-studio-ui-facade-and-spectrum-to-rac.md)

## 验证范围

- 安装 `@react-spectrum/s2@1.5.1`，未安装旧的 `@adobe/react-spectrum`。
- 建立 `StudioUiProvider`、`Button`、`TextField`、`Dialog` 四个门面组件。
- Provider 接收现有 Studio locale 和活动主题的 `uiTheme`，不保存第二份主题状态。
- ExportDialog 使用带动作区的任务 Dialog 和门面 Button。
- SettingsDialog 使用可关闭 Dialog；主题选择仍由现有主题插件控制。
- Workbench、CanvasViewport、Preview、Command 和 Session 领域逻辑没有移入 UI 门面。

## 实际环境

| 项目 | 验证值 |
| --- | --- |
| Spectrum 2 | 1.5.1 |
| React 实际解析版本 | 19.2.8 |
| Vite 实际解析版本 | 7.3.6 |
| TypeScript | strict + exactOptionalPropertyTypes |
| 主题 | Light / Dark |
| Locale | en-US / zh-CN Provider 映射 |

## 验证结果

### 构建与类型

- `pnpm typecheck` 通过。
- `pnpm studio:build` 通过。
- Spectrum 的 Provider、Button、TextField、DialogContainer API 与当前 React 19 / Vite 构建兼容。
- 门面针对 `exactOptionalPropertyTypes` 只传递真实存在的可选 Props，不把 `undefined` 透传给第三方接口。

### 浏览器检查

- Provider 外层保持 100% 宽高，未破坏 Workbench 满屏布局。
- Light 模式下 Export 任务 Dialog 的标题、内容、主次动作和遮罩正常。
- Dark 模式下 Settings 可关闭 Dialog、原有设置表单、Token Browser 和 Component Registry 正常显示。
- 从 Settings 切换主题后，Studio chrome 和 Spectrum Dialog 在同一次状态更新中切换明暗模式。
- Escape 能关闭 Settings Dialog，并在存在稳定触发器时把焦点恢复到“打开设置”按钮。
- Export 主动作已连接真实 Workspace Server；导出成功状态能在 Dialog 内正确通告。
- 设置界面仍显示 `Light` / `Dark`，没有向用户暴露底层组件库品牌。

### 样式边界

- 原有全局 reset 已放入 `studio-reset` cascade layer，降低其覆盖 Spectrum 内部样式的风险。
- UI Provider 的外层 class 只负责根布局尺寸，不用于覆盖 Spectrum 组件内部视觉。
- 未引入 Tailwind、`clsx` 或 `tailwind-merge`。

## Bundle 基线

| 构建 | JS 原始值 | JS gzip | CSS 原始值 | CSS gzip |
| --- | ---: | ---: | ---: | ---: |
| 引入前最近基线 | 约 397.1 kB | 约 115.5 kB | 未单独记录 | 未单独记录 |
| Gate 0 | 579.72 kB | 169.44 kB | 63.37 kB | 11.64 kB |
| JS 增量 | 约 182.6 kB | 约 53.9 kB | — | — |

当前增量可以接受为兼容性 Spike 成本，但不能直接视为最终预算。进入大规模迁移前必须：

1. 检查 Dialog、Provider 和基础组件共享代码是否已经正确 tree-shake。
2. 为 Settings、Command Palette 等低频入口评估路由或动态加载边界。
3. 在 P2/P3 复杂组件加入后重新设定 Studio 主包和异步 chunk 预算。
4. 不通过同时保留自定义组件和 Spectrum 组件来换取短期兼容。

## 已建立的防线

- `tests/contracts/module-boundaries.test.ts` 禁止 UI 门面以外导入 Spectrum 2 或 RAC，并全局禁止旧 Spectrum 包。
- `tests/contracts/studio-ui-facade.test.tsx` 验证 Provider、Button、TextField 状态语义以及 Dialog 非法组合。
- `TextField` 拒绝同时传入 `value` 与 `defaultValue`。
- 有 action group 的 Dialog 必须采用任务型关闭方式；可关闭 Dialog 不允许同时声明 action group，避免 Spectrum 后端隐藏动作区。

## 后续工作

1. P0：补齐 IconButton、Tooltip 门面；确定 Workbench Tooltip 的 renderer 接口，不让 Workbench 依赖 Spectrum。
2. P1：在 Inspector 的真实编辑字段中验证 TextField、NumberField、Checkbox、Picker。
3. 建立浏览器自动化用例，覆盖 Escape、遮罩关闭、关闭后焦点恢复和主题切换。
4. 审计剩余的全局 element selector；迁移一个控件后删除对应旧 CSS。
5. 记录每个批次的构建产物，若主 chunk 持续增长则在引入集合组件前完成代码分割。
