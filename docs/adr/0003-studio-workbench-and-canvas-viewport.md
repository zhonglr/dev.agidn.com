# ADR-0003：Studio 使用数据驱动 Workbench 和独立 Canvas Viewport

- 状态：Accepted
- 日期：2026-07-22

## 背景

固定左中右三栏布局可以快速形成演示，但无法支撑长时间使用的专业编辑器。随着页面结构、组件资源、Inspector、History、Problems 和未来扩展增加，固定布局会持续侵占画布并促使 Studio Shell 反复重写。

画布还需要触控板缩放和平移。如果缩放作用于整个 Studio，面板、工具栏和文字会一起改变尺寸，无法形成稳定的专业工作区。

## 决策

1. Studio Shell 使用可版本化的布局树，表达嵌套 Split、Tab Group 和 Panel Host。
2. 所有内置面板通过 Panel Registry 注册，默认布局只是可替换配置。
3. 面板支持调整尺寸、移动、停靠、标签合并、折叠、关闭和持久化恢复。
4. 画布使用独立 Canvas Viewport；只对 Canvas Surface 和 Interaction Overlay 应用 scale/translation。
5. 触控板手势、指针中心缩放、Fit 命令和直接 DOM 边界映射共用单一坐标转换服务。Canvas Runtime 的具体边界由后续 [ADR-0005](./0005-studio-canvas-direct-dom-rendering.md) 确定。
6. 建立 Panel、Command、Inspector、Route 和 Status Item 的内部 Contribution API，为未来插件保留稳定扩展点。
7. 插件和内置功能都不得直接写入 PageDocument，页面修改仍统一经过 Command、Rule Engine 和 Revision。

详细模型、交互和验收基线见 [Studio Workbench 架构](../architecture/studio-workbench.md)。

## 结果

- Studio 首个可用版本的工作量增加，但避免后续为 History、Problems、Token 和插件重写 Shell。
- Workbench State、Canvas State 和 PageDocument 必须分开存储与测试。
- 布局恢复需要版本和 migration，失效面板不能阻止 Studio 启动。
- 画布交互必须建立专门的手势、坐标和性能测试。
- 公开第三方插件市场仍属于后置能力，但内置能力从首版开始遵循扩展点边界。

## 替代方案

- 固定三栏：实现快，但面板增长后必然重写，拒绝。
- 只支持拖动分隔条，不支持停靠和标签：不能满足用户自定义每个面板位置的要求，拒绝。
- 使用浏览器缩放或缩放 Studio 根节点：会同时改变工具界面尺寸，拒绝。
- 首版即加载任意第三方代码：权限、隔离和升级成本过高，拒绝；先建立内部 Contribution API。
