# Studio UI Gate 01：表单替换与按需加载

> 日期：2026-07-23
> 状态：通过；首屏体积恢复到 Spectrum 引入前附近，低频组件改为按需加载。
> 前序报告：[UI Gate 00](./2026-07-23-studio-ui-gate-00.md)

## 验证范围

- 新增 AGIDN `Select` 门面，内部使用 Spectrum 2 Picker。
- 新增 AGIDN `SearchField` 门面，内部使用 Spectrum 2 SearchField。
- Settings 的语言和主题原生 `<select>` 替换为门面 Select。
- Command Palette 的原生搜索 `<input>` 替换为门面 SearchField。
- Settings、Export、Command Palette 从 `App.tsx` 拆分为动态 import。
- Spectrum Provider 从首屏根节点移动到各低频 UI 加载边界，但仍接收应用 composition root 提供的同一 locale 和活动 `uiTheme`。
- Settings、Export、Command Palette 入口增加 pointer/focus 意图预取，降低首次打开等待。
- Command Palette 关闭后恢复到实际触发按钮，窄屏入口同样有效。

## 浏览器检查

- Settings 首次打开后能渲染两个 Picker，分别显示语言和主题。
- 主题 Picker 只显示 `Follow system`、`Light`、`Dark` 等产品名称；选择 `Dark` 后主题插件状态和 Dialog 配色同步更新。
- Command Palette SearchField 自动获得焦点，输入 `theme` 后只保留三个主题命令。
- SearchField 的清除按钮、Escape 关闭和关闭后焦点恢复正常。
- Workbench、Canvas、Preview 和已有 Panel 布局没有因 Provider 移出首屏根节点而变化。

## 首屏构建对比

| 指标 | Gate 00 | Gate 01 | 变化 |
| --- | ---: | ---: | ---: |
| 首屏 JS | 579.72 kB | 398.28 kB | -181.44 kB（-31.3%） |
| 首屏 JS gzip | 169.44 kB | 116.70 kB | -52.74 kB（-31.1%） |
| 首屏 CSS | 63.37 kB | 30.68 kB | -32.69 kB（-51.6%） |
| 首屏 CSS gzip | 11.64 kB | 6.13 kB | -5.51 kB（-47.3%） |

Gate 01 的首屏 JS gzip 仅比 Spectrum 引入前最近基线约高 1.2 kB。首屏不再静态导入 Spectrum 2；动态入口映射和 React lazy 运行时代码仍保留在主 chunk。

## 按需 chunk

| Chunk | JS gzip | CSS gzip | 说明 |
| --- | ---: | ---: | --- |
| Provider shared | 38.77 kB | 1.63 kB | 首个 Spectrum 操作面加载一次，之后复用 |
| Dialog shared | 15.50 kB | 4.57 kB | Settings / Export 共享 |
| Form validation shared | 6.24 kB | 2.88 kB | Picker / SearchField 共享 |
| Command Palette entry | 5.15 kB | 1.20 kB | SearchField 和命令组合逻辑 |
| Export entry | 0.97 kB | — | 导出业务状态和动作 |
| Settings entry | 48.31 kB | 5.77 kB | 两个 Picker、集合和设置业务内容 |

如果用户在一次会话中打开所有低频功能，全部 JS chunk 合计约 231.6 kB gzip、CSS 约 22.2 kB gzip。这个总量高于 Gate 00，因为本轮新增了 Picker 和 SearchField；优化目标是首屏和按需复用，不声称全功能总代码量下降。

Settings entry 较大主要来自 Spectrum Picker 的集合、Popover 和虚拟化能力。它已隔离在低频入口；在没有产品数据证明其首次交互成本不可接受前，不用私有导入或复制 Spectrum 内部实现换取更小数字。

## 自动化防线

- UI 门面契约测试覆盖 Select/SearchField 渲染和受控/非受控冲突。
- 加载边界测试禁止 Settings、Export、Command Palette 回退为静态 import。
- 加载边界测试要求每个懒加载 Spectrum 操作面建立受控 `StudioUiProvider`。
- 模块边界测试继续禁止 UI 门面以外直接导入 Spectrum/RAC。

## 后续门槛

1. Inspector TextField、NumberField、Checkbox 迁移前，先确定高频编辑控件是否建立独立 Panel chunk，避免重新放大首屏。
2. 为动态 import 失败增加可恢复 Error Boundary，而不是长期使用空白 fallback。
3. 为首次打开延迟和 chunk 缓存命中增加正式性能采样。
4. Command Palette 的命令列表后续迁移 ListBox 时，必须先比较键盘模型和新增 chunk 成本。
