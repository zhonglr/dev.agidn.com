# ADR-0005：Studio Next 的三项不可破坏边界

> 状态：Accepted
> 日期：2026-07-24

## 背景

Studio Next 将借鉴 Unity 等专业图形化编辑器的对象模型、选择上下文、资产实例、专注编辑、直接操作、属性编辑和可恢复工作流，但本产品不是游戏场景编辑器，也不是任意网页画板。

本产品的核心价值是把人的设计意图保存为严格、可验证、可供机器消费的 UI 规格。如果为了模仿成熟编辑器的表面能力而开放任意坐标、任意样式、任意扩展写入或自动倾倒全部 Schema 字段，系统会失去语义、约束和可解释性。

因此，以下三项边界作为 Studio Next 的基础宪法。它们高于单个功能、面板、插件和实现便利性；后续 ADR 不得静默削弱它们。

## 决策

### 1. 不引入自由坐标、任意 Transform 和任意样式

- 普通页面内容只通过受控 Layout、Slot、Placement、Responsive Policy、Design Token 和 Component Variant 表达。
- 普通节点不保存任意 `x`、`y`、`top`、`left`、Transform matrix、CSS 字符串或未注册样式值。
- Canvas 的平移、缩放、选框、拖拽投影和辅助线属于编辑器视图状态，不能进入项目文档。
- 确有叠加需求时只能通过受控 Overlay、Anchor、Boundary、Offset Token 和 Collision Policy 表达。
- 新的布局或视觉能力必须先成为正式 Schema、Registry 或 Policy 契约，不能通过“高级模式”绕过约束。

### 2. 不允许扩展、插件、AI 或 UI 直接写项目事实

- 所有持久化修改必须提交结构化 Command，并经过 Capability、Rule、Patch、Transaction 和 Revision。
- Custom Inspector、Context Menu、Canvas Tool、Plugin、MCP 和 AI Proposed Change 使用同一命令入口。
- 扩展可以贡献描述、控件、命令工厂、诊断和渲染适配器，但不能获得可变项目对象或持久化 Store 的直接写权限。
- UI 乐观状态只是可丢弃 Projection；Workspace Server 的正式 Transaction 是提交结果。
- 任何绕过统一链路的“临时写入”都视为架构缺陷。

### 3. 不把 Inspector 做成 Schema 字段的机械倾倒

- Schema 定义“什么可以存在”，Property Model 定义“人在当前上下文中应如何理解和编辑它”。
- Inspector 只展示对当前目标、能力、模式和选择集合有意义的属性。
- 属性必须携带语义分组、来源、默认值、继承/覆盖状态、可编辑条件、校验、帮助和对应 Command。
- 高频属性优先，低频属性渐进展开；内部 ID、版本和诊断可以只读显示。
- 未实现、只读、被策略限制和提交失败必须使用不同状态，不得统一伪装成 disabled 控件。
- 自动生成 Inspector 只能消费显式 Property Descriptor，不能把任意 JSON Schema 递归渲染成产品界面。

## 强制准入问题

任何新功能、插件或领域字段进入主干前必须回答：

1. 它是否引入任意坐标、样式或未注册实现值？
2. 它是否存在绕过 Command、Rule、Transaction 和 Revision 的写入路径？
3. 它是否把底层字段直接暴露给用户，而没有定义编辑语义和上下文？

任一答案为“是”，默认拒绝合并；若产品需求确实要求改变边界，必须新增 ADR，明确替代本 ADR，并同时修改 Schema、规则、导出和验收体系。

## 结果

### 正面结果

- Page、Component、Pattern、Plugin 和 AI 仍产生一致、可验证的项目事实。
- Canvas 可以持续增强交互，但不会退化成坐标画板。
- Inspector 可以扩展到更多对象类型，同时保持可理解和可维护。
- 插件生态不会形成绕过领域规则的第二套写入系统。

### 代价

- 新能力需要先设计正式契约，交付速度可能慢于直接暴露自由字段。
- 某些自由设计需求会被拒绝，或必须升级为全局 Token、Variant、Layout/Overlay Policy。
- Property Model 和 Capability 系统需要独立建设，不能仅依赖 Schema 表单生成器。

## 被拒绝的替代方案

- 提供“专家模式”直接编辑 CSS、Transform 或原始 JSON。
- 允许插件通过共享 Store、DOM 或文件系统直接修改项目。
- 使用通用 JSON Schema Form 自动构建全部 Inspector。
- 为了兼容旧数据保留自由字段、别名、默认 fallback 或双写路径。
