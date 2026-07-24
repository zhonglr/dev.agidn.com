# V2 重构 TODO

> 最后更新：2026-07-24

本文是 V2 从零重构的唯一活动待办清单。它只记录尚未完成的工作；已经完成的事实见[项目状态](./status.md)，设计约束见[组件系统与 Canvas 联合重构方案](../architecture/component-system-and-canvas-refactor.md)。所有任务都以“不兼容 V1、不迁移旧数据、不恢复旧字段”为前提。

## 优先级

| 标记 | 含义 | 调度规则 |
| --- | --- | --- |
| `P0 Blocker` | 当前编辑器无法完成基础创作或存在数据/运行时中断 | 立即处理，不得被新能力插队 |
| `P1 Critical` | V2 基础模型已有但关键闭环缺失 | P0 清零后按依赖顺序处理 |
| `P2 High` | 完整性、可维护性和生产稳定性 | 不阻塞基础搭建，但进入正式验收前必须完成 |
| `P3 Normal` | 能力包、集成和后置扩展 | P0/P1 核心退出条件完成后启动 |

同一优先级按本文顺序执行。优先级变化必须同时修改本文和[项目状态](./status.md)，不能只在口头计划中调整。

## P0 Blocker：恢复并锁住基础创作能力

- [x] 修复 Components 面板把无 Preset 组件静默隐藏的问题。
- [x] 区分组件目录加载中、加载失败、真正空目录和搜索无结果。
- [x] 让 Foundation Catalog 的 9 个 Primitive 都进入 Components 面板模型并增加契约测试。
- [x] 使用 `editor.icon` 渲染组件卡片的语义图标，未知图标稳定回退。
- [x] 移除 sandbox 环境中直接访问 `localStorage` 导致编辑器和拖拽链路中断的问题。
- [x] 将 Section、Container、Stack、Row、Grid、Overlay 六个 Layout 接入 Components 面板。
- [x] 建立严格的 `component | layout | pattern` 插入源、独立 Drag MIME、Canvas Ghost 和单 Revision Drop 链路。
- [x] 为 Section/Container 的新插入实现向最近合法祖先集合回退，禁止预览合法但提交被嵌套规则拒绝。
- [x] 使用隔离的真实 Chrome E2E 验证 9 个 Primitive、1 个 Composite、6 个 Layout 和 1 个 Pattern 均可拖入 Canvas；每次 Drop 只产生一个 Revision。
- [x] 增加 Components 面板状态浏览器 E2E：Catalog 服务离线、空 Registry、无 Preset 和搜索结果。
- [x] 完成基础编辑冒烟矩阵：创建、选择、修改、移动、删除、undo、redo、刷新恢复和错误回滚。
- [x] 删除 iframe、Preview Host、跨窗口协议和独立预览端口；Canvas 改为 Studio 内直接 DOM 渲染、命中与测量。
- [x] 修复直接 DOM Canvas 空白区域把 Page 根误判为“放置目标已不存在”，并加入 Page 根 Drop 浏览器回归。
- [ ] 创建正式 Studio UAT Round 03；未通过前不得把 M4 标记为产品可用。

退出条件：空项目无需修改 JSON 即可建立 Section → Container → Stack/Grid → Component 页面；所有基础操作有浏览器自动化；Console 无未处理异常。

## P1 Critical：完成 V2 核心闭环

### Composite 与项目资产

- [x] 将 Composite Definition 合成到活动 Component Registry，同时保持 Primitive、Composite 和 Pattern 的类型边界。
- [x] 实现 Composite 页面实例运行时、公开 Prop/Slot/Variant 绑定和单一可选中边界。
- [x] 为 Pattern 增加完整拖拽、多根 Drop Preview、目标联合校验和单 Revision 原子提交。
- [x] 实现严格的 Project Asset Command/Patch 执行层：Composite/Pattern upsert、remove、整库校验和引用保护。
- [x] 将 Project Asset Command/Patch 接入项目级 Revision、History、undo/redo、`3.0.0` 原子持久化和严格项目 HTTP API。
- [x] 让 Studio Session 切换到唯一 Project Revision API，并删除 Document-only Store、持久化格式、Service 和 Endpoint。
- [ ] 实现复用同一 Canvas/Inspector 的 Composite 专注编辑器。
- [ ] 实现依赖影响分析、接口版本变更检查、安全删除和循环引用诊断。

### Canvas 拖拽与布局

- [ ] 用统一 Pointer Sensor 取代 HTML5 DnD 热路径，并覆盖鼠标、触控和笔输入。
- [ ] 建立带 Epoch 的 Geometry Snapshot、显式 Slot Zone 和空容器命中区域。
- [ ] 用局部 Placeholder/Projection 取代整文档 Ghost 热路径。
- [ ] 完成自动滚动、嵌套边缘命中、换行 Grid 二维排序和快速跨目标稳定性。
- [ ] 增加键盘拖拽 Sensor 和完整可访问反馈。
- [ ] 让 Page Canvas 与 Composite 专注编辑器复用同一个 Drag Controller。
- [ ] 在 50%～200% 缩放以及 Desktop/Tablet/Mobile 下完成真实浏览器矩阵验收。

退出条件：刷新、服务重启、历史恢复和导出均不丢失资产；拖动不创建 Revision，Drop 恰好创建一次；受挤压节点无往返抖动。

## P2 High：补齐规则、项目模型和生产门禁

### Inspector 与 Rule Engine

- [ ] 增加 Overlay 的 anchor、boundary、offset 和受控定位编辑器。
- [ ] 增加 Slot 合同、数量、接受类型、定位跳转和错误展示。
- [ ] 增加 Advanced 区域，只读显示 Node ID、Component Ref 和 Definition Version。
- [ ] 在服务端强制执行 Prop `min`、`max`、`pattern` 等 Validation 元数据。
- [ ] 校验 Accessibility `describedBy` 指向当前 Document 内存在且合法的目标。
- [ ] 为多字段修改建立原子 Transaction，并为连续输入增加 debounce/commit 边界。
- [ ] 增加乐观更新、服务端拒绝回滚和对应 Problems 定位。

### Workspace 项目模型

- [ ] 用正式 Workspace Project Schema 取代 Studio 本地多页面模型。
- [ ] 将 Page、Asset、引用图和项目设置纳入同一项目级 Revision 边界。
- [ ] 增加页面与资产的创建、重命名、删除、引用保护和原子持久化 API。
- [ ] 删除 V2 正式项目模型落地后不再需要的页面 `localStorage` 状态。
- [ ] 增加文件变化监听、版本化 WebSocket、断线重连和过期消息处理。

### 图标与质量

- [x] 定义 Studio Chrome 的语义图标门面，并复用按文件导入的 Spectrum 2 图标。
- [x] Components 面板通过 Registry `editor.icon` 解析图标，未知名称稳定回退。
- [ ] 定义框架无关的 Project Icon Asset Schema 和 Core / Project / Plugin Pack。
- [ ] 实现安全 SVG 导入、冲突检测、按需加载和引用裁剪导出。
- [ ] 让 Foundation `Icon` 使用统一 SVG Runtime，删除字符占位渲染。
- [ ] 增加 Icon Picker、缺失诊断、包体积门禁和重复 SVG 检测。
- [ ] 增加 Workbench、Canvas、Components、Inspector 和完整编辑流程 E2E。
- [ ] 建立全仓 `format:check`、CI 和 Canvas 运行时诊断门禁。

完整图标决策见[统一图标系统](../architecture/icon-system.md)。

## P3 Normal：基础稳定后扩展

- [ ] Forms 能力包。
- [ ] Feedback 能力包。
- [ ] Navigation 能力包。
- [ ] Media 能力包。
- [ ] Data Display 能力包。
- [ ] Overlay 能力包。
- [ ] Data Source / Binding Schema 及完整引用验证。
- [ ] Logic / Integration Editor。
- [ ] MCP 与 AI Proposed Commands。

P3 不得早于 P1 核心退出条件；增加能力包不能重新引入 V1 组件、旧数据导入或兼容字段。
