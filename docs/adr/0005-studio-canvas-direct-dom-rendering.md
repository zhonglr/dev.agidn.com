# ADR-0005：Studio Canvas 使用直接 DOM 渲染

- 状态：Accepted
- 日期：2026-07-24
- 取代：技术决策 TD-012 中的独立 Preview Host 方案

## 背景

早期实现为每个编辑会话启动独立 Vite Preview Host，并通过 sandboxed iframe 和
`postMessage` 在 Studio 与预览文档之间传递页面、命中、边界、选择和拖放状态。当前产品
只渲染受 Component Registry 约束的声明式组件，不执行用户提交的任意脚本。

这条边界没有带来与其复杂度相称的安全收益，却引入了第二个开发服务器、opaque origin、
跨窗口时序、重复坐标转换、异步几何过期和 iframe 生命周期等故障面。部署时为每个用户
启动预览服务器也不符合纯 Web 编辑器的运行模型。

## 决策

1. `CanvasViewport` 在 Studio React 树内直接挂载 `PageRenderer`，输出同一
   `Document` 中的原生 DOM。
2. 选择、命中、边界测量、内容高度和拖放投影直接使用 DOM API 与 `ResizeObserver`，
   不经过跨窗口协议。
3. Desktop、Tablet、Mobile 以画布容器宽度和 CSS Container Query 计算，不能依赖浏览器
   顶层 viewport。
4. Canvas 继续拥有独立平移、缩放和 Interaction Overlay；直接 DOM 不等于把编辑器状态
   写入 PageDocument。
5. `PageRenderer` 保持只读。所有持久化修改仍必须经过
   `Command → Rule Engine → Patch → Project Revision`。
6. 删除 `apps/preview-host`、`packages/preview-protocol`、`VITE_PREVIEW_URL`、
   `4174` 端口以及所有 iframe / `postMessage` 兼容代码，不提供旧路径降级。
7. 当前 Registry 组件视为产品受信代码。未来若允许第三方不可信代码或任意用户脚本，
   必须另立 ADR 设计真正的隔离执行环境；不得把旧 iframe 桥接代码重新混回核心 Canvas。

## 结果

- 本地开发和生产部署都只需要 Studio 静态应用与 Workspace Server。
- Canvas 命中和几何读取同步发生在同一文档，消除 ready/load 竞态与跨窗口迟到响应。
- 画布 DOM 可直接被浏览器自动化、无障碍工具和 React 错误边界验证。
- Studio 与页面组件共享 JS 运行时；因此 Registry 审核、组件错误边界和禁止任意脚本是明确
  的安全前提。

## 替代方案

- 保留独立 Preview Host：增加部署、通信和时序复杂度，且当前没有不可信代码需要隔离，
  拒绝。
- same-origin iframe：可简化部分通信，但仍保留双 Document、坐标和生命周期问题，拒绝。
- Shadow DOM：适合样式封装，不提供脚本隔离，并会增加事件与样式系统复杂度，当前不采用。
- 每用户容器或远程沙箱：只有产品开始执行不可信项目代码时才有必要，后置评估。
