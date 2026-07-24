# 前端开发规范

本文约束 Studio Canvas Runtime 及前端共享包的结构、组件、状态、样式和测试。通用 TypeScript、
协议与领域规则继续遵循[开发贡献指南](./development.md)，Studio UI 门面的具体架构遵循
[Studio UI 系统](../architecture/studio-ui-system.md)和
[ADR-0004](../adr/0004-studio-ui-facade-and-spectrum-to-rac.md)。

## 适用原则

- 重构默认保持行为不变。业务能力、视觉调整和结构迁移应拆成可独立验证的变更。
- 优先在现有应用内按职责拆分；没有第二个真实消费者时，不创建新的 workspace package。
- Studio 是工作台式单页应用，按 feature 和工作区职责组织，不套用传统营销网站的 page-first 目录。
- Workbench、Canvas Runtime 和 Document Command 是领域能力，通用 UI 工具库不能拥有其状态模型。
- 对本规范的长期例外必须写明原因、范围和退出条件；不能用局部注释永久绕过规则。

## 目录与依赖

Studio 前端按以下边界演进。这是目标结构；当前 `apps/studio/src` 仍保留部分早期扁平文件（如 `App.tsx`、`panels.tsx`），迁移按本规范渐进进行，当前布局以代码为准：

```text
apps/studio/src/
├── app/                 # composition root、全局命令和顶层 provider
├── components/
│   ├── ui/              # 唯一通用 UI 门面
│   └── studio/          # 跨 feature 的 Studio 领域组件
├── features/            # outline、components、inspector、history、problems
├── canvas/              # 直接 DOM Runtime、坐标、手势和画布 overlay
├── session/             # 文档会话、服务调用和 command actions
├── i18n/                # 文案与 locale runtime
├── themes/              # Studio chrome 主题插件
└── styles/              # foundation、shell 和共享样式
```

依赖方向：

```text
app → features / canvas / components/studio
features / canvas / components/studio → components/ui
components/ui → 当前 UI toolkit
features / canvas → session / domain protocols
```

强制规则：

- 业务代码只能通过 `components/ui/index.ts` 使用通用控件。
- 只有 `components/ui/**` 可以导入 Spectrum 2 或 React Aria Components。
- `components/ui/**` 不能依赖 Studio Session、PageDocument、Command Engine 或具体 feature。
- `packages/studio-workbench` 保持 UI toolkit 无关，通过语义 props 或 render slot 与应用集成。
- 禁止从其他 package 的 `src/` 深层导入；跨 package 只使用公开入口。
- `index.ts` 只导出稳定接口，不放置业务逻辑或副作用。

## 文件与组件

- 文件和目录使用 `kebab-case`；React 组件、类型和枚举使用 `PascalCase`。
- 使用具名导出。只有框架明确要求时才使用默认导出。
- 一个文件承担一个可描述的职责。超过约 250 行时必须评估拆分，但不能按行数机械拆出无语义文件。
- `App` 只负责 provider、路由或工作区组装；菜单、标题栏、状态栏、弹窗层和业务面板使用独立组件。
- 不在 render 中声明有状态组件；稳定常量、注册表和静态映射放在模块级。
- Props 表达产品语义，不继承第三方组件 Props，不公开第三方事件、variant 或 collection 类型。
- 不为透传 `className` 添加无语义外层元素。布局由父级领域组件或明确的布局 primitive 负责。

## React 与状态

状态按所有权分开：

| 状态                | 所有者                                | 示例                           |
| ------------------- | ------------------------------------- | ------------------------------ |
| Document / Revision | Studio Session 与服务端               | 当前文档、revision、undo/redo  |
| Server state        | application service / session adapter | catalog、history、export task  |
| Workbench state     | Workbench layout                      | panel、split、dock、hidden ids |
| URL / route state   | app route                             | Design / Logic 工作区          |
| 临时 UI state       | 最近的 feature 或 component           | 搜索词、展开项、弹窗开关       |

- 不复制可计算状态；能从 props、context 或其他 state 推导的值在 render 或 `useMemo` 中计算。
- Effect 只同步外部系统，不用于普通派生计算或模拟事件处理。
- 网络请求、订阅、计时器和 DOM 事件必须具备清理、失败和过期响应处理。
- 异步用户动作必须防止重复提交，并区分 loading、success、domain rejection 与 transport failure。
- Context 按变化频率和职责拆分；不能用单个 Context 承载整个应用所有瞬时状态。
- Hook 名称使用 `use<Domain><Intent>`，返回产品语义，不泄漏 transport 或 toolkit 细节。

## UI、可访问性与国际化

- 采用“项目门面优先”的顺序：先复用现有 UI 门面；底层组件库已有对应能力时，在门面中增加语义 Adapter；
  只有组件库无法表达该领域交互时才使用原生元素。禁止为了自定义外观重写组件库已提供的 Button、Menu、
  Dialog、Disclosure、Field、Picker、Tooltip、ListBox、TreeView 等通用控件。
- 页面、Feature 和 Panel 不能直接导入底层组件库；它们统一从 `components/ui/index.ts` 使用项目门面。门面负责将
  AGIDN 产品语义映射到底层 props，而不是复制底层实现。`@react-spectrum/s2` 是当前实现依赖，不是产品设计系统的名称。
- 原生交互例外必须说明底层组件库不适用的原因，并具有正确 role、可访问名称、键盘模型、焦点样式和自动化测试。
  Canvas 几何手势、带领域拖放协议的 Outline/Component 节点属于合理候选；普通点击、表单和弹出层不属于例外。
- 用户可见文案全部进入 i18n；Schema ID、componentRef 和错误码不能直接作为最终显示文本。
- 无文字操作必须具有 `aria-label` 和产品 tooltip。
- Overlay 必须验证初始焦点、焦点陷阱、Escape、背景交互和关闭后的焦点恢复。
- 编辑界面的右键菜单统一通过 Studio Context Menu Registry 贡献，并由 UI 门面使用 Spectrum Menu 呈现；禁止在
  Feature 内自制彼此不一致的原生菜单。贡献项必须声明目标类型、分组、排序和适用条件，修改文档时调用现有
  Command / Rule / Revision 链路。
- 右键、Context Menu 键和 `Shift+F10` 必须解析同一目标；关闭后焦点返回触发对象。上下文菜单不能成为关键操作的
  唯一路径。
- 拖放不能是唯一操作方式；结构编辑必须同时提供可预测的点击或键盘路径。
- 不只依靠颜色表达 selection、error、saving 或 disabled 状态。

## 样式与主题

- Studio chrome 只消费 `themes/types.ts` 定义的语义 CSS variables；feature 选择器中禁止硬编码主题颜色。
- Studio chrome 主题与用户 PageDocument Design Token 是两套不同边界，不能互相导入或复用状态源。
- AGIDN 的视觉语言使用自己的语义名称。不得照搬外部设计系统的品牌名、token 名、主题名或受限字体；
  外部体系只用于研究信息层级、对比度、交互状态和可访问性。
- Studio 正文使用 `--studio-text-body`（`0.875rem`，默认等价 14px）；面板标题、紧凑控件、状态栏、
  元数据和辅助标签使用 `--studio-text-control` / `--studio-text-caption`（`0.75rem`，默认等价 12px）；
  编辑器上下文标题使用 `--studio-text-title`（`1rem`，默认等价 16px）。不能再新增低于 12px 的 UI 文本。
- Studio 全局只使用操作系统 UI 字体栈；正文、控件、标签和技术信息不得分别声明其他字体。
  通过 `--s2-font-family-sans` 让底层控件继承同一排版，不内嵌或声明第三方产品专用字体。
- 颜色按 AGIDN 角色表达：`canvas` 负责层级，`foreground` 负责文字，`border` 负责边界，
  `accent` 只强调主操作、焦点和选中，`success` / `attention` / `danger` 表达状态。状态不能只依赖颜色。
- 字号使用 `rem` 令浏览器缩放和用户默认字号生效；禁止以减小字号代替合理的截断、换行或面板布局。
- 样式按以下 cascade layer 组织：

```css
@layer reset, foundation, shell, workbench, features, utilities;
```

- Reset 放在低优先级 layer；Studio 规则作用域化在 `.studio-shell`，避免污染组件库 overlay 和 Canvas 内容。
- Feature 样式与 feature 同步迁移，禁止继续向单一 `styles.css` 无边界追加。
- 类名使用稳定的领域语义；现有 BEM 风格 `block__element--modifier` 可以继续使用。
- 禁止覆盖第三方库的私有类名、DOM 层级或未公开 CSS variable。
- 动效必须支持 `prefers-reduced-motion`；滚动容器应避免出现滚动条导致的布局跳动。
- `z-index`、overlay 层级和 portal 边界集中定义，不在 feature 中随意增加大数值。

## 测试与验收

每个前端变更根据风险覆盖：

- 纯函数和状态转换：单元或表驱动测试。
- UI 门面：公共 props、ref、表单、键盘、焦点和 disabled/pending 行为契约。
- Feature：loading、empty、error、权限或规则拒绝，以及核心用户操作。
- Workbench / Canvas：布局序列化、坐标、手势、拖放和直接 DOM Runtime 契约。
- 完整编辑流程：真实浏览器 E2E。
- 视觉变化：Light / Dark × zh-CN / en-US，并覆盖常用窗口宽度。

测试优先按 role、accessible name 和用户可见结果查询；`data-testid` 只用于没有稳定语义的几何或协议边界。
快照不能替代交互断言。

## 工具与完成标准

日常检查：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

格式化由 `pnpm format` 调用 Prettier 统一处理，CSS 由 Stylelint 检查。开始大范围格式化前必须先固定当前业务基线，
格式化提交不能混入功能或视觉变化。当前仓库仍有历史格式偏差；在独立格式基线变更完成前，不启用全仓
`format:check` 门禁。

前端任务完成必须满足：

- 没有越过模块和 UI 门面边界。
- 没有新增未本地化文案、硬编码主题颜色或无键盘路径的交互。
- 状态和错误所有权明确，异步操作具备可恢复反馈。
- 对应层级的自动化测试已增加或更新。
- `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build` 全部通过。
- 用户可见交互按适用矩阵完成真实浏览器复验。
- 架构、公开契约或长期规则改变时同步更新文档或 ADR。
