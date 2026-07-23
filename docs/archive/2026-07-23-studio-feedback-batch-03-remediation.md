# Studio 第三批反馈整改摘要

> 状态：Archived
> 日期：2026-07-23
> 来源：Studio 第三批用户反馈
> 原路径：`docs/quality/uat/2026-07-23-studio-round-03.md`
> 当前依据：[Studio Issue 台账](../quality/issues.md)

本文最初以 Round 03 UAT 名义记录整改结果，但没有锁定基线 commit、验收人、环境、场景结果和接受结论，不符合当前 UAT 规范，因此归档为反馈与实现摘要。它不代表第三轮 UAT 已开始或产品已接受；问题当前状态、根因和验收条件以 Issue 台账为准，正式 Round 03 应在验收条件齐备后另行创建。

## 结构编辑

| 反馈 | 当前 Issue | 当时记录的实现结果 | 待验收重点 |
| --- | --- | --- | --- |
| 新组件插入位置不可见 | [STUDIO-004](../quality/issues.md#studio-004组件插入移动与-slot-拖放链路不完整) | Component 拖动经过 Canvas 时持续请求 Preview hit-test，以绿色 before / inside / after 几何层和文字显示最终位置 | 不同缩放和 breakpoint 下提示与实际插入位置一致 |
| Outline 无法可靠排序或换父节点 | [STUDIO-004](../quality/issues.md#studio-004组件插入移动与-slot-拖放链路不完整) | 拖动源状态移入 Studio Session，不再依赖浏览器在 `dragover` 阶段暴露 DataTransfer 内容；Outline 与 Canvas 共用 MoveTarget | 同组排序、跨父级移动、named Slot、非法目标和 undo/redo |
| 组件不能放入组件内部 | [STUDIO-004](../quality/issues.md#studio-004组件插入移动与-slot-拖放链路不完整) | Registry Slot 是唯一合法内部入口；Button 新增 leading Icon、content Text、trailing Icon Slot，Renderer 消费这些 Slot | Icon/Text 拖入 Button 后 Preview、Outline、Revision 一致 |
| 保存自定义组件入口缺失 | [STUDIO-019](../quality/issues.md#studio-019缺少保存和复用节点子树的工作流) | Inspector 新增“保存为可复用组件”，Components 新增 Saved components 分组，可点击或拖动重复插入并重新生成全部 node ID | 保存、刷新后保留、插入多次不产生 ID 冲突、删除 |

“保存为可复用组件”保存的是由已注册组件组成的选中节点子树，持久化在当前浏览器。它不创建新的代码组件；代码组件仍需通过 Component Registry 和 Preview Runtime 注册。

## Revision History

| 反馈 | 当前 Issue | 当时记录的实现结果 | 待验收重点 |
| --- | --- | --- | --- |
| History 只能查看、不能恢复 | [STUDIO-020](../quality/issues.md#studio-020revision-history-缺少安全恢复能力) | 每个历史 Revision 提供 Restore 和确认操作；恢复目标快照时创建新的单调 Revision，保留完整审计记录，并将恢复前状态放入 undo 栈 | 恢复 Revision 0 / 中间 Revision、刷新后记录保留、恢复后 undo |

## 信息架构与国际化

| 反馈 | 当前 Issue | 当时记录的实现结果 |
| --- | --- | --- |
| Inspector 参数大小写混杂 | [STUDIO-021](../quality/issues.md#studio-021schema-标识符与本地化展示名称未分离) | 所有标识符先经过 Display Label 层，camelCase、点号和连字符不直接进入可见 UI |
| 实际名称与展示名称未分离 | [STUDIO-021](../quality/issues.md#studio-021schema-标识符与本地化展示名称未分离) | Component / Prop / Slot / Variant Schema 新增可本地化 display metadata；Catalog API 保留并返回该元数据 |
| Components 未分组 | [STUDIO-022](../quality/issues.md#studio-022components-面板未按组件类别分组) | Registry 增加 category，面板按 Actions、Typography、Media、Content、Layout、Navigation、Commerce 分组 |
| 缺少 i18n | [STUDIO-023](../quality/issues.md#studio-023studio-与组件元数据缺少国际化链路) | 语言包、类型、运行时和 React Provider 分层；Studio、Canvas、Workbench、ARIA 与异步错误均使用类型化消息 key；Catalog 提供展示元数据；支持 Settings、`VITE_STUDIO_LOCALE` 和运行时配置 |

## Workbench 与视觉层级

| 反馈 | 当前 Issue | 当时记录的实现结果 |
| --- | --- | --- |
| Outline 层级难辨 | [STUDIO-024](../quality/issues.md#studio-024outline-深层节点缺少连续层级引导) | 按树深度绘制连续纵向引导线，不影响 selection 和 drop indicator |
| Dock 轮盘难唤出且边框太小 | [STUDIO-018](../quality/issues.md#studio-018dock-compass-难发现且目标命中区域过小) | `dragover` 即激活目标，拖动期间显示操作提示；compass 从 92px 增至 136px，目标从 28px 增至 40px |
| 面板显示/隐藏入口集中在左侧 | [STUDIO-025](../quality/issues.md#studio-025面板显隐入口未按工作区方位组织) | 建立周边工具栏：左侧项目类、右侧内容类、底部状态类；按钮可切换显示/隐藏；顶部新增 File / Edit / View 菜单 |

## 当时的开发证据

- `pnpm typecheck`：通过。
- `pnpm test`：24 个文件、99 项测试通过。
- `pnpm build`、`pnpm studio:build`、`pnpm preview:build`：通过。
- Chrome 1600×1000 静态渲染检查：顶部菜单、三侧工具栏、Outline 引导线和面板布局无溢出。
- Catalog 运行冒烟：category、displayName 和 Button Slot 均由 Workspace Server 返回。

这些证据只说明开发检查在当时通过，不替代真实交互 UAT。
