# 统一图标系统

> 状态：基础决策已落地，Project Icon Asset 尚待实现

## 1. 结论

统一使用 SVG，但不把“散落的 SVG 文件”或“某个第三方图标库的组件名”当成产品数据协议。

系统分为两个边界：

1. Studio Chrome 图标用于编辑器自身的菜单、工具栏和面板。它通过 AGIDN 的语义名称访问当前 UI Adapter；现阶段 Adapter 从已经安装的 Spectrum 2 图标集中按单文件直接导入。
2. Project Content 图标用于用户页面中的 `Icon` Primitive。它使用框架无关、可导出、可校验的 Project Icon Asset；Document 只保存稳定的命名空间 ID，不保存 React 组件或第三方包路径。

两层共享命名、可访问性、尺寸和颜色规则，但不共享运行时依赖。这样 Studio 更换 UI 工具包不会破坏页面数据，导出的页面也不需要携带整个 Spectrum。

## 2. 为什么不选择单一极端方案

### 每个图标一个外部 SVG 文件

适合 Logo、插画和需要独立缓存的大型图形，不适合作为大量小型界面图标的默认运行时。它会增加请求、资源路径、跨域、主题着色和离线导出的复杂度。

SVG 文件可以作为“导入源”，但导入后必须经过清洗、规范化和 Hash，再进入正式 Icon Asset。运行时不依赖原文件位置。

### 业务直接使用现有图标库

初期开发快，但第三方组件名会扩散到面板、Registry、Document 和插件协议。换库、升级、导出或服务端渲染都会变成数据兼容问题。

图标库只能位于 Adapter 或构建阶段。业务只使用 `history`、`add`、`component.card` 这样的 AGIDN 语义 ID。

### 把整套图标做成 SVG Sprite

Sprite 对同页高重复图标有效，但动态 Pack、Shadow Root、SSR、跨文档引用和按引用裁剪更复杂。V2 默认使用单一 `<svg>` 渲染器与内联 path 数据；只有测量证明某个导出目标因大量重复图标受益时，才允许在构建产物中生成局部 Sprite。

## 3. Studio Chrome 架构

```text
Feature / Panel
      │
      ▼
<ProductIcon name="undo" />
      │
      ▼
AGIDN semantic map
      │
      ▼
Spectrum 2 direct icon import
```

约束：

- `apps/studio/src/components/ui/**` 是唯一允许导入 Spectrum 图标的目录。
- Feature、Panel、Workbench Contribution 和 Context Menu 只能使用 `ProductIconName`。
- Catalog 的 `editor.icon` 由 `CatalogIcon` 解析；未知名称回退到通用 Components 图标，不能导致面板崩溃或条目消失。
- 只允许 `@react-spectrum/s2/icons/<ExactName>` 的静态直接导入，禁止 barrel import、通配符 import 和运行时加载整套图标。
- `ProductIconName` 表达操作语义，不表达图形外观。更换 Adapter 时业务调用保持不变。

当前 Components 面板已按上述边界渲染 `editor.icon`。

## 4. Project Content 数据模型

待实现的最小模型：

```ts
interface IconAsset {
  id: `${string}:${string}`;
  version: "1.0.0";
  viewBox: [number, number, number, number];
  paths: Array<{
    d: string;
    fillRule?: "nonzero" | "evenodd";
    clipRule?: "nonzero" | "evenodd";
    opacity?: number;
  }>;
  license: {
    name: string;
    source?: string;
  };
  contentHash: string;
}
```

正式 Schema 还必须定义：

- `core:*`、`project:*`、`plugin-id:*` 命名空间及所有权。
- 单色图标默认使用 `currentColor`；多色图标必须显式声明并与普通 Icon 区分。
- 标准设计网格优先使用 `0 0 24 24`，但不得靠缩放重写原始 path 精度。
- 同一命名空间内 ID 唯一；相同内容 Hash 可报告重复但不能静默改引用。
- Asset Version 是接口版本，不等于第三方库版本。

PageDocument 的 `Icon.props.name` 最终保存 Icon Asset ID，例如 `core:check`，而不是 `CheckmarkIcon`、包名、文件路径或原始 SVG 字符串。

## 5. Pack 与扩展

Icon Pack 是一组 Icon Asset 和一个 Manifest：

```text
Core Pack       产品随附的最小通用集合
Project Pack    当前项目导入或绘制的图标
Plugin Pack     插件显式贡献的命名空间
```

注册流程：

```text
Manifest Schema
  → Namespace ownership
  → Duplicate ID / Hash check
  → SVG safety validation
  → Registry Snapshot
  → Inspector / Runtime / Export
```

Registry Snapshot 必须是不可变的。插件注册只影响下一份 Snapshot，不能在一次渲染或拖拽中途改变名称解析。

大 Pack 不进入初始 Bundle。Picker 打开时按 Pack 分块加载元数据和预览；页面 Runtime 只打包 Document 实际引用到的图标。

## 6. SVG 安全边界

SVG 导入器必须采用白名单，至少执行：

- 允许 `viewBox`、path 几何、受控 fill/stroke、fill rule、clip rule 和 opacity。
- 删除元数据、编辑器私有节点和无意义精度。
- 拒绝 `script`、事件属性、`foreignObject`、HTML、CSS、动画和滤镜执行面。
- 拒绝外部 URL、网络字体、`use href`、远程 image 和跨文件引用。
- 限制节点数、path 长度、嵌套深度、坐标范围和文件大小，防止解析与渲染资源耗尽。
- 清洗后重新序列化并计算内容 Hash；不能信任上传文件给出的 Hash。

Logo 和插画不应伪装成单色 Icon；它们进入独立 Image/Brand Asset 类型。

## 7. 渲染与可访问性

所有内容图标通过一个 Runtime SVG 组件渲染：

- 尺寸由受控 size/token 决定，禁止任意内联宽高字段进入 Document。
- 颜色默认继承 `currentColor`，由 Token Binding 决定。
- 装饰性图标使用 `aria-hidden="true"`。
- 承担含义且没有相邻文本时，必须通过 Component Accessibility 提供名称。
- Icon-only Button 的可访问名称继续由 Button 合同验证，不能依靠 SVG `<title>` 猜测。
- 缺失图标显示稳定占位并产生可定位诊断，不能空白或抛出整页异常。

## 8. 轻量化门禁

- Studio 不增加第二套图标库；复用现有 Spectrum 依赖。
- 所有 Studio 图标都必须静态直接导入，确保 Bundler 可裁剪未使用模块。
- Project Runtime 不依赖 Spectrum、React 组件型图标库或整个 Icon Pack。
- Context Exporter 只导出当前 Document/Composite/Pattern 传递引用到的 Icon Asset。
- CI 记录 Studio 初始 JS、Icon Picker 异步 Chunk 和 Project Runtime 图标字节数；超出预算必须给出归因。
- 禁止将 base64 SVG、原始 XML 或远程 URL写入 PageDocument。

## 9. 实施顺序

1. 已完成 Studio `ProductIcon` / `CatalogIcon` 语义门面和按文件导入。
2. 定义 Project Icon Asset 与 Pack Manifest Schema。
3. 实现清洗导入器、Registry Snapshot 和引用裁剪。
4. 将 Foundation `Icon` Runtime 从字符占位替换为统一 SVG 渲染器。
5. 实现 Inspector Icon Picker 和缺失引用诊断。
6. 增加包体积、安全、导出和浏览器测试。

任务状态统一记录在[V2 重构 TODO](../project/todo.md)。
