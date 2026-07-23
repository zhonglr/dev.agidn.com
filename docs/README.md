# 项目文档中心

`docs/` 是项目文档的唯一入口；仓库根目录只保留面向首次访问者的 `README.md`。先从“当前状态”判断项目进度，再按需要进入产品、架构、API、质量或历史记录，避免把旧计划当成当前事实。

## 当前项目

- [项目状态](./project/status.md)：当前已经实现、尚未完成和下一步顺序的唯一快照。
- [项目路线图](./project/roadmap.md)：跨 Cycle 的计划、优先级和后置能力。
- [Development Cycles](./project/cycles/README.md)：每轮范围、Git 边界、测试、UAT 和 carryover。

## 产品与架构

- [产品设计](./product/ai-low-code-designer.md)：产品定位、核心能力和 MVP 验收标准。
- [Studio Authoring Model](./product/studio-authoring-model.md)：多页面根节点与 Editor Tab、自定义组件专注工作台、变量/Slot 及默认双面板布局。
- [Logic / Integration Editor 产品设计](./product/logic-integration-editor.md)：前端事件连接业务 Action 与后端 Operation 的产品范围、首个闭环和验收标准。
- [系统架构](./architecture/system-overview.md)：模块职责、依赖边界和核心数据流。
- [Logic / Integration Editor 架构](./architecture/logic-integration-editor.md)：Integration Schema、运行时、编辑器、Revision、安全边界和分阶段实施设计。
- [Studio Workbench](./architecture/studio-workbench.md)：工作区、面板注册和 Canvas Viewport。
- [Studio UI 系统](./architecture/studio-ui-system.md)：UI 门面、组件契约和迁移门槛。
- [技术决策汇总](./architecture/technical-decisions.md)：仍然有效的技术选择和后置决策。
- [ADR 索引](./adr/README.md)：已经落地且不能靠静默改文档覆盖的长期决策。

## 协议与开发

- [Workspace Server API](./api/workspace-server.md)：HTTP 端点、状态码和示例。
- [Revision Store](./api/revision-store.md)：持久化格式、恢复与原子写入保证。
- [Schema Context Package](./api/context-package.md)：导出文件内容、引用裁剪和 Hash 规则的权威定义。
- [开发贡献指南](./contributing/development.md)：环境、依赖、编码、测试和提交要求。
- [前端开发规范](./contributing/frontend.md)：Studio 的结构、组件、状态、样式、可访问性和验收要求。
- [文档贡献规范](./contributing/documentation.md)：文档分类、命名、格式、生命周期和检查规则。

## 质量与验收

- [质量记录](./quality/README.md)：统一说明 Issue、UAT、Verification 的职责、创建触发条件和当前索引。
- [Studio Issue 台账](./quality/issues.md)：`STUDIO-*` 当前状态、根因、验收条件和关闭证据。
- [Studio UAT Round 02](./quality/uat/2026-07-23-studio-round-02.md)：当前最近一份满足固定基线要求的人工验收记录；第三、四批反馈已进入 Issue 台账，尚未开始正式 Round 03。
- [Studio UI Gate 00](./quality/verification/2026-07-23-studio-ui-gate-00.md) / [Gate 01](./quality/verification/2026-07-23-studio-ui-gate-01.md)：Spectrum 迁移与包体积专项验证。

## 模板与历史

- [文档模板](./templates/README.md)：Issue、UAT、Cycle 的强制字段模板。
- [归档索引](./archive/README.md)：已经失效但仍有追溯价值、不得作为当前依据的文档。

## 事实优先级

出现冲突时按以下顺序判断：

1. 运行时 Schema、实现和自动化测试决定“系统实际做什么”。
2. API/架构文档和 Accepted ADR 决定“公开契约与设计意图是什么”。
3. [项目状态](./project/status.md) 决定“当前完成到哪里”。
4. Issue、UAT 和 Cycle 记录决定“何时发现、验证或遗留了什么”。
5. 路线图和归档文档只表达计划或历史，不得覆盖前四项事实。

提交前运行 `pnpm docs:check`。任何文件迁移必须在同一变更中修复内部链接；不允许为了链接稳定保留两份内容相同的文档。
