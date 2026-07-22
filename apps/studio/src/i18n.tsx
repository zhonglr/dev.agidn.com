import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type StudioLocale = "en-US" | "zh-CN";

const messages = {
  "en-US": {
    pageOutline: "Page Outline", components: "Components", canvas: "Canvas", inspector: "Inspector",
    problems: "Problems", history: "History", search: "Search", filterPage: "Filter page…",
    findComponent: "Find component…", content: "Content", appearance: "Appearance", variant: "Variant",
    selectNode: "Select a node", selectNodeHelp: "Choose an element on the canvas or in Page Outline to inspect it.",
    registeredComponents: "Registered components", savedComponents: "Saved components", saveReusable: "Save as reusable component",
    save: "Save", cancel: "Cancel", locale: "Language", editorAppearance: "Editor appearance",
    settings: "Studio settings", noSavedComponents: "Select a node in Page Outline, then save it from Inspector.",
    insertInside: "Insert inside", insertBefore: "Insert before", insertAfter: "Insert after",
    dragToInsert: "Drag to insert", dragToMove: "Drag to move", remove: "Remove",
    file: "File", edit: "Edit", view: "View", exportRevision: "Export current revision",
    undo: "Undo", redo: "Redo", resetLayout: "Reset layout", commands: "Commands",
    revision: "Revision {{revision}}", current: "Current", workspace: "Workspace", initialDocument: "Initial document",
    restore: "Restore", restoring: "Restoring…", restoreRevision: "Restore Revision {{revision}}?",
    restoreCreatesRevision: "The current document will be preserved and this restore will create Revision {{revision}}.",
    restoredRevision: "Restored Revision {{revision}}", undoToRevision: "Undo to Revision {{revision}}", redoToRevision: "Redo to Revision {{revision}}"
  },
  "zh-CN": {
    pageOutline: "页面大纲", components: "组件", canvas: "画布", inspector: "检查器",
    problems: "问题", history: "历史", search: "搜索", filterPage: "筛选页面节点…",
    findComponent: "查找组件…", content: "内容", appearance: "外观", variant: "变体",
    selectNode: "请选择节点", selectNodeHelp: "在画布或页面大纲中选择一个元素进行编辑。",
    registeredComponents: "已注册组件", savedComponents: "已保存组件", saveReusable: "保存为可复用组件",
    save: "保存", cancel: "取消", locale: "语言", editorAppearance: "编辑器外观",
    settings: "Studio 设置", noSavedComponents: "先在页面大纲中选择节点，再从检查器保存。",
    insertInside: "插入内部", insertBefore: "插入前方", insertAfter: "插入后方",
    dragToInsert: "拖拽插入", dragToMove: "拖拽移动", remove: "移除",
    file: "文件", edit: "编辑", view: "视图", exportRevision: "导出当前版本",
    undo: "撤销", redo: "重做", resetLayout: "重置布局", commands: "命令",
    revision: "版本 {{revision}}", current: "当前", workspace: "工作区", initialDocument: "初始文档",
    restore: "恢复", restoring: "正在恢复…", restoreRevision: "恢复版本 {{revision}}？",
    restoreCreatesRevision: "当前文档会被保留，本次恢复将创建版本 {{revision}}。",
    restoredRevision: "已恢复版本 {{revision}}", undoToRevision: "撤销至版本 {{revision}}", redoToRevision: "重做至版本 {{revision}}"
  }
} as const;

type MessageKey = keyof typeof messages["en-US"];
type MessageVariables = Readonly<Record<string, string | number>>;
interface I18nValue { locale: StudioLocale; setLocale: (locale: StudioLocale) => void; t: (key: MessageKey, variables?: MessageVariables) => string }
const I18nContext = createContext<I18nValue | undefined>(undefined);

function initialLocale(): StudioLocale {
  const configured = window.__AGIDN_STUDIO_CONFIG__?.locale ?? import.meta.env.VITE_STUDIO_LOCALE ?? localStorage.getItem("agidn.studio.locale");
  return configured === "zh-CN" ? "zh-CN" : "en-US";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<StudioLocale>(initialLocale);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale: (next) => { updateLocale(next); localStorage.setItem("agidn.studio.locale", next); document.documentElement.lang = next; },
    t: (key, variables) => {
      const message: string = messages[locale][key];
      return variables
        ? message.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) => name in variables ? String(variables[name]) : placeholder)
        : message;
    }
  }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}
