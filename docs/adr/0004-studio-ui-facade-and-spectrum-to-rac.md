# ADR-0004：Studio UI 使用稳定门面并从 Spectrum 2 渐进迁移到 RAC

- 状态：Accepted
- 日期：2026-07-23

## 背景

Studio 已经具有 Workbench、Canvas Viewport、Panel Registry、主题插件和国际化基础，但表单、按钮、弹窗、菜单、列表等操作界面仍以项目内手写组件和原生元素为主。继续扩展这套实现会把团队精力消耗在通用交互、无障碍、焦点管理和跨输入设备行为上。

产品当前更需要快速建立成熟、一致的操作空间；品牌视觉尚未稳定，暂时不值得从无样式基础组件开始完整建设设计系统。产品成熟后又需要摆脱固定视觉，使用自己的 Token 和组件样式。

React Spectrum 2 能为当前阶段提供完整且可访问的组件，React Aria Components（RAC）适合在品牌规范稳定后构建自有视觉。二者共享交互和无障碍基础，但公共 Props、组合结构、DOM、集合模型和样式能力并不等价，不能把未来迁移建立在“直接替换 import”上。

## 决策

1. Studio 当前组件库采用 Spectrum 2，依赖包为 `@react-spectrum/s2`，不引入旧的 `@adobe/react-spectrum`。
2. 在 `apps/studio/src/components/ui/` 建立唯一的 UI 门面。Studio 页面、Feature、Panel 和 Workbench 集成代码不得直接导入 Spectrum 2 或 RAC。
3. UI 门面定义项目自己的语义 Props、事件、状态、ref 和无障碍契约，不继承、不透传、不公开第三方组件 Props 或类型。
4. 当前主题插件仍是 Studio 主题选择的唯一事实来源。UI Provider 只把活动主题的 `uiTheme: "light" | "dark"` 和当前 locale 映射给 Spectrum Provider；Spectrum 控制其组件内部视觉，主题插件继续控制 Studio Shell、Workbench 和 Canvas chrome。
5. Spectrum 阶段不为了未来迁移而预装 Tailwind、`clsx` 或 `tailwind-merge`。开始 RAC 迁移时再依据已经确认的设计系统选择 CSS 方案。
6. RAC 迁移只发生在 UI 门面内部，按基础控件、Overlay/导航、集合组件的风险顺序逐个替换。迁移期间不使用会把 Spectrum 和 RAC 同时打入生产包的长期运行时后端开关。
7. Workbench 布局、Dock、Canvas Viewport、Preview 协议、文档命令和领域状态继续由项目自研。组件库只提供这些能力内部使用的通用控件，不接管其领域模型。
8. `packages/studio-workbench` 保持组件库无关。若它需要消费 UI 门面，优先通过渲染槽位或应用层组合；只有出现第二个真实消费者后，才评估把门面提升为 `packages/studio-ui`。
9. 通过契约测试强制第三方 UI 依赖边界，并为每个公开组件维护行为测试和 Light/Dark、中文/英文视觉矩阵。

完整目录、组件契约、迁移批次和验收门槛见 [Studio UI 系统架构](../architecture/studio-ui-system.md)。

## 结果

- 当前阶段可以使用成熟组件快速推进业务，同时把第三方依赖限制在可替换的 Adapter 边界内。
- 业务代码依赖稳定的产品语义，不依赖 Spectrum 的 variant、collection、trigger 或事件类型。
- 现有 `Light` / `Dark` 主题插件继续可配置，但 Spectrum 阶段不承诺主题插件能够重绘 Spectrum 组件内部颜色。
- 复杂组件迁移仍可能需要修改 UI 门面内部的数据和组合 Adapter；“业务零改动”是由契约测试保护的目标，不是由同一供应商自动保证的事实。
- 初期需要维护门面和测试，且 Spectrum 固定视觉与现有 Studio chrome 可能存在差异；这些差异必须在技术验证阶段评估。

## 替代方案

- 业务直接导入 Spectrum：交付最快，但第三方 Props 和组合模型会扩散到整个 Studio，拒绝。
- 立即使用 RAC 自建全部组件：品牌规范尚未稳定，会提前承担样式、状态矩阵和无障碍验收成本，暂不采用。
- 继续维护全部手写控件：无法有效复用成熟的焦点、触摸、键盘、国际化和集合交互能力，拒绝。
- 同时保留 Spectrum/RAC 并使用运行时开关：便于演示切换，但会增加包体积和双实现维护成本，不作为正式迁移方案。
- 从第一天在业务代码中使用 Tailwind className：会把样式技术和局部视觉决策重新泄漏到业务层，拒绝。
