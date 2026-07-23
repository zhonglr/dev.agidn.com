import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  checkCommitCommandsResponse,
  checkExportContextResponse,
  checkGetCatalogResponse,
  checkGetDocumentResponse,
  checkGetHistoryResponse,
  checkNavigationResponse,
  type CommitCommandsResponse,
  type ExportContextResponse,
  type GetCatalogResponse,
  type GetDocumentResponse,
  type GetHistoryResponse,
  type NavigationResponse
} from "@agidn/api-protocol";
import type { DocumentCommand } from "@agidn/command-engine";
import { findNode, type ComponentNode, type PageDocument, type PageNode } from "@agidn/document-schema";
import { useI18n, type MessageDescriptor, type MessageKey } from "./i18n.js";
import { message, messageError, messageFromError } from "./i18n/types.js";
import type { MoveTarget } from "./structure-drag.js";

type SessionStatus = "loading" | "saved" | "saving" | "error";

const VIOLATION_MESSAGE_KEYS: Readonly<Record<string, MessageKey>> = {
  COMMAND_INVALID: "errors.commandInvalid",
  COMMAND_TARGET_INVALID: "errors.commandTargetInvalid",
  SCHEMA_INVALID: "errors.schemaInvalid",
  DUPLICATE_NODE_ID: "errors.duplicateNodeId",
  RAW_COLOR_FORBIDDEN: "errors.rawColorForbidden",
  RAW_SPACING_FORBIDDEN: "errors.rawSpacingForbidden",
  RAW_STYLE_FORBIDDEN: "errors.rawStyleForbidden",
  ABSOLUTE_POSITION_FORBIDDEN: "errors.absolutePositionForbidden",
  UNKNOWN_COMPONENT: "errors.unknownComponent",
  UNKNOWN_PROP: "errors.unknownProp",
  INVALID_PROP_VALUE: "errors.invalidPropValue",
  INVALID_SLOT: "errors.invalidSlot",
  INVALID_SLOT_CONTENT: "errors.invalidSlotContent",
  REQUIRED_SLOT_MISSING: "errors.requiredSlotMissing",
  MISSING_RESPONSIVE_RULE: "errors.missingResponsiveRule",
  INVALID_OVERLAY: "errors.invalidOverlay",
  ACCESSIBLE_NAME_REQUIRED: "errors.accessibleNameRequired",
  UNKNOWN_ACTION: "errors.unknownAction",
  INVALID_ACTION_ARGUMENT: "errors.invalidActionArgument",
  UNKNOWN_VARIANT: "errors.unknownVariant",
  UNKNOWN_STATE: "errors.unknownState",
  UNKNOWN_TOKEN: "errors.unknownToken",
  TOKEN_TYPE_MISMATCH: "errors.tokenTypeMismatch",
  INVALID_LAYOUT_NESTING: "errors.invalidLayoutNesting",
  LAYOUT_DEPTH_EXCEEDED: "errors.layoutDepthExceeded"
};

export interface InsertTarget {
  parentId: string;
  slot?: string;
  beforeNodeId?: string;
}

export interface SavedComponent {
  id: string;
  displayName: string;
  node: PageNode;
  createdAt: string;
  customComponentId?: string;
}

export type InsertDragPayload = { type: "component" | "saved"; id: string };

export interface WorkspacePage {
  id: string;
  name: string;
  document: PageDocument;
  revision: number;
  isPrimary: boolean;
}

interface LocalWorkspacePage {
  id: string;
  name: string;
  document: PageDocument;
  revision: number;
}

interface StudioSessionValue {
  document?: PageDocument;
  pages: readonly WorkspacePage[];
  activePageId?: string;
  openPageIds: readonly string[];
  catalog?: GetCatalogResponse;
  revision: number;
  selectedNodeId?: string;
  selectedNode?: PageNode;
  status: SessionStatus;
  error?: MessageDescriptor;
  canUndo: boolean;
  canRedo: boolean;
  history: GetHistoryResponse["entries"];
  savedComponents: readonly SavedComponent[];
  activeInsertDrag?: InsertDragPayload;
  activeNodeDragId?: string;
  createPage: () => string;
  activatePage: (pageId: string) => void;
  closePage: (pageId: string) => void;
  selectNode: (nodeId?: string) => void;
  setProp: (nodeId: string, property: string, value: unknown) => Promise<boolean>;
  setVariant: (nodeId: string, variant: string) => Promise<boolean>;
  insertComponent: (componentRef: string, target?: InsertTarget) => Promise<boolean>;
  insertSavedComponent: (savedId: string, target?: InsertTarget) => Promise<boolean>;
  saveSelectedComponent: (displayName: string) => boolean;
  upsertCustomComponentTemplate: (customComponentId: string, displayName: string, node: PageNode) => void;
  removeSavedComponent: (savedId: string) => void;
  beginInsertDrag: (payload: InsertDragPayload) => void;
  endInsertDrag: () => void;
  beginNodeDrag: (nodeId: string) => void;
  endNodeDrag: () => void;
  moveNode: (nodeId: string, target: MoveTarget) => Promise<boolean>;
  removeNode: (nodeId: string) => Promise<boolean>;
  restoreRevision: (targetRevision: number) => Promise<boolean>;
  exportRevision: () => Promise<ExportContextResponse>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  reload: () => Promise<void>;
}

const StudioSessionContext = createContext<StudioSessionValue | undefined>(undefined);

function commandId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function jsonResponse(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  if (!response.ok && response.status >= 500) throw messageError("errors.workspaceRequest");
  return value;
}

function allNodes(document: PageDocument): PageNode[] {
  const result: PageNode[] = [];
  const visit = (node: PageNode): void => {
    result.push(node);
    (node.kind === "layout" ? node.children : Object.values(node.slots ?? {}).flat()).forEach(visit);
  };
  document.children.forEach(visit);
  return result;
}

function defaultValue(definition: GetCatalogResponse["components"]["components"][string]["props"][string], defaultContent: string): unknown {
  if (definition.type === "boolean") return false;
  if (definition.type === "number") return 0;
  if (definition.type === "enum") return definition.values?.[0] ?? "";
  return defaultContent;
}

function createComponentNode(catalog: GetCatalogResponse, componentRef: string, defaultContent: string, depth = 0): ComponentNode | undefined {
  const definition = catalog.components.components[componentRef];
  if (!definition) return undefined;
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const props = Object.fromEntries(Object.entries(definition.props)
    .filter(([, prop]) => prop.required)
    .map(([name, prop]) => [name, defaultValue(prop, defaultContent)]));
  const slots: Record<string, PageNode[]> = {};
  if (depth < 3) {
    for (const [slotName, slot] of Object.entries(definition.slots)) {
      const count = Math.max(slot.minItems ?? 0, slot.required ? 1 : 0);
      if (count === 0) continue;
      const childRef = slot.accepts?.find((candidate) => candidate !== "*") ?? "Text";
      const children = Array.from({ length: count }, () => createComponentNode(catalog, childRef, defaultContent, depth + 1)).filter((node): node is ComponentNode => Boolean(node));
      if (children.length) slots[slotName] = children;
    }
  }
  return {
    id: `${componentRef.toLowerCase()}_${suffix}`,
    kind: "component",
    componentRef,
    ...(definition.variants[0] ? { variant: definition.variants[0] } : {}),
    ...(Object.keys(props).length ? { props } : {}),
    ...(Object.keys(slots).length ? { slots } : {})
  };
}

function cloneNodeWithFreshIds(node: PageNode): PageNode {
  const cloned = structuredClone(node);
  const refresh = (current: PageNode): void => {
    current.id = `${current.kind === "component" ? current.componentRef.toLowerCase() : current.layout}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
    (current.kind === "layout" ? current.children : Object.values(current.slots ?? {}).flat()).forEach(refresh);
  };
  refresh(cloned);
  return cloned;
}

function childCollections(node: PageNode): PageNode[][] {
  return node.kind === "layout" ? [node.children] : Object.values(node.slots ?? {});
}

function insertNode(document: PageDocument, target: InsertTarget, node: PageNode): boolean {
  let collection: PageNode[] | undefined;
  if (target.parentId === document.id) collection = document.children;
  else {
    const parent = findNode(document, target.parentId);
    if (parent?.kind === "layout" && !target.slot) collection = parent.children;
    if (parent?.kind === "component" && target.slot) {
      (parent.slots ??= {});
      collection = (parent.slots[target.slot] ??= []);
    }
  }
  if (!collection) return false;
  const index = target.beforeNodeId
    ? collection.findIndex(({ id }) => id === target.beforeNodeId)
    : collection.length;
  if (index < 0) return false;
  collection.splice(index, 0, node);
  return true;
}

function removeNode(document: PageDocument, nodeId: string): PageNode | undefined {
  const remove = (collection: PageNode[]): PageNode | undefined => {
    const index = collection.findIndex(({ id }) => id === nodeId);
    if (index >= 0) return collection.splice(index, 1)[0];
    for (const node of collection) {
      for (const children of childCollections(node)) {
        const removed = remove(children);
        if (removed) return removed;
      }
    }
    return undefined;
  };
  return remove(document.children);
}

function loadLocalPages(): LocalWorkspacePage[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("agidn.studio.workspace.pages") ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (page): page is LocalWorkspacePage =>
        Boolean(
          page &&
            typeof page === "object" &&
            "id" in page &&
            typeof page.id === "string" &&
            "name" in page &&
            typeof page.name === "string" &&
            "document" in page &&
            "revision" in page &&
            typeof page.revision === "number"
        )
    );
  } catch {
    return [];
  }
}

function loadPageViewState(): { activePageId?: string; openPageIds: string[] } {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("agidn.studio.workspace.page-view") ?? "{}"
    );
    if (!value || typeof value !== "object") return { openPageIds: [] };
    const state = value as { activePageId?: unknown; openPageIds?: unknown };
    return {
      ...(typeof state.activePageId === "string" ? { activePageId: state.activePageId } : {}),
      openPageIds: Array.isArray(state.openPageIds)
        ? state.openPageIds.filter((id): id is string => typeof id === "string")
        : []
    };
  } catch {
    return { openPageIds: [] };
  }
}

export function createWorkspacePageDocument(name: string): PageDocument {
  const pageId = `page_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  return {
    schemaVersion: "1.0.0",
    id: pageId,
    kind: "page",
    role: "page",
    name,
    children: [
      {
        id: `${pageId}_root`,
        kind: "layout",
        layout: "stack",
        role: "main",
        name: "Page root",
        children: []
      }
    ]
  };
}

function loadSavedComponents(): SavedComponent[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("agidn.studio.saved-components") ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SavedComponent => Boolean(item && typeof item === "object" && "id" in item && "displayName" in item && "node" in item));
  } catch { return []; }
}

function defaultInsertTarget(document: PageDocument, catalog: GetCatalogResponse, selectedNode: PageNode | undefined, componentRef: string): InsertTarget | undefined {
  if (selectedNode?.kind === "layout") return { parentId: selectedNode.id };
  if (selectedNode?.kind === "component") {
    const definition = catalog.components.components[selectedNode.componentRef];
    for (const [slotName, slot] of Object.entries(definition?.slots ?? {})) {
      const accepts = slot.accepts ?? ["*"];
      const count = selectedNode.slots?.[slotName]?.length ?? 0;
      if ((accepts.includes("*") || accepts.includes(componentRef)) && (slot.maxItems === undefined || count < slot.maxItems)) {
        return { parentId: selectedNode.id, slot: slotName };
      }
    }
  }
  const fallback = allNodes(document).find((node) => node.kind === "layout");
  return fallback ? { parentId: fallback.id } : undefined;
}

export function StudioSessionProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [revisionState, setRevisionState] = useState<GetDocumentResponse["revision"]>();
  const revisionRef = useRef<GetDocumentResponse["revision"] | undefined>(undefined);
  revisionRef.current = revisionState;
  const [catalog, setCatalog] = useState<GetCatalogResponse>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [localPages, setLocalPages] = useState<LocalWorkspacePage[]>(loadLocalPages);
  const initialPageView = useRef(loadPageViewState());
  const [activePageId, setActivePageId] = useState<string | undefined>(
    initialPageView.current.activePageId
  );
  const [openPageIds, setOpenPageIds] = useState<string[]>(
    initialPageView.current.openPageIds
  );
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<MessageDescriptor>();
  const [savedComponents, setSavedComponents] = useState<SavedComponent[]>(loadSavedComponents);
  const [activeInsertDrag, setActiveInsertDrag] = useState<InsertDragPayload>();
  const [activeNodeDragId, setActiveNodeDragId] = useState<string>();
  const [historyState, setHistoryState] = useState<GetHistoryResponse>({
    protocolVersion: "1.0.0", ok: true, currentRevision: 0, canUndo: false, canRedo: false, entries: []
  });

  const loadHistory = useCallback(async (): Promise<void> => {
    const value = await jsonResponse(await fetch("/api/v1/history"));
    if (!checkGetHistoryResponse(value)) throw messageError("errors.historyProtocol");
    setHistoryState(value as GetHistoryResponse);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    setStatus("loading");
    try {
      const [documentValue, catalogValue] = await Promise.all([
        jsonResponse(await fetch("/api/v1/document")),
        jsonResponse(await fetch("/api/v1/catalog"))
      ]);
      if (!checkGetDocumentResponse(documentValue)) throw messageError("errors.documentProtocol");
      if (!checkGetCatalogResponse(catalogValue)) throw messageError("errors.catalogProtocol");
      const response = documentValue as GetDocumentResponse;
      setRevisionState(response.revision);
      setCatalog(catalogValue as GetCatalogResponse);
      setError(undefined);
      setStatus("saved");
      await loadHistory();
    } catch (caught) {
      setError(messageFromError(caught, "errors.workspaceLoad"));
      setStatus("error");
    }
  }, [loadHistory]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    localStorage.setItem("agidn.studio.workspace.pages", JSON.stringify(localPages));
  }, [localPages]);

  useEffect(() => {
    localStorage.setItem(
      "agidn.studio.workspace.page-view",
      JSON.stringify({ activePageId, openPageIds })
    );
  }, [activePageId, openPageIds]);

  useEffect(() => {
    const primaryId = revisionState?.document.id;
    if (!primaryId || activePageId) return;
    setActivePageId(primaryId);
    setOpenPageIds((current) => (current.includes(primaryId) ? current : [...current, primaryId]));
  }, [activePageId, revisionState?.document.id]);

  const activeLocalPage = localPages.find(({ id }) => id === activePageId);
  const activeDocument = activeLocalPage?.document ?? revisionState?.document;
  const activeRevision = activeLocalPage?.revision ?? revisionState?.revision ?? 0;
  const pages = useMemo<WorkspacePage[]>(() => {
    const primary = revisionState
      ? [
          {
            id: revisionState.document.id,
            name: revisionState.document.name ?? revisionState.document.id,
            document: revisionState.document,
            revision: revisionState.revision,
            isPrimary: true
          }
        ]
      : [];
    return [
      ...primary,
      ...localPages.map((page) => ({
        ...page,
        isPrimary: false
      }))
    ];
  }, [localPages, revisionState]);

  useEffect(() => {
    if (!pages.length) return;
    const validIds = new Set(pages.map(({ id }) => id));
    const nextActive =
      activePageId && validIds.has(activePageId) ? activePageId : pages[0]!.id;
    const nextOpen = openPageIds.filter((id) => validIds.has(id));
    if (!nextOpen.includes(nextActive)) nextOpen.push(nextActive);
    if (nextActive !== activePageId) setActivePageId(nextActive);
    if (
      nextOpen.length !== openPageIds.length ||
      nextOpen.some((id, index) => id !== openPageIds[index])
    )
      setOpenPageIds(nextOpen);
  }, [activePageId, openPageIds, pages]);

  const updateActiveLocalDocument = useCallback(
    (update: (document: PageDocument) => boolean | void): boolean => {
      if (!activeLocalPage) return false;
      setLocalPages((current) =>
        current.map((page) => {
          if (page.id !== activeLocalPage.id) return page;
          const document = structuredClone(page.document);
          if (update(document) === false) return page;
          return {
            ...page,
            name: document.name ?? page.name,
            document,
            revision: page.revision + 1
          };
        })
      );
      return true;
    },
    [activeLocalPage]
  );

  const commit = useCallback(async (command: DocumentCommand): Promise<boolean> => {
    const current = revisionRef.current;
    if (!current || status === "saving") return false;
    setStatus("saving");
    setError(undefined);
    try {
      const value = await jsonResponse(await fetch("/api/v1/commands", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", baseRevision: current.revision, source: "human", commands: [command] })
      }));
      if (!checkCommitCommandsResponse(value)) throw messageError("errors.commitProtocol");
      const response = value as CommitCommandsResponse;
      if (!response.ok) {
        await reload();
        setError(response.error === "REVISION_CONFLICT"
          ? message("errors.revisionConflict")
          : message(VIOLATION_MESSAGE_KEYS[response.violations?.[0]?.code ?? ""] ?? "errors.serverRejected"));
        setStatus("error");
        return false;
      }
      setRevisionState(response.revision);
      setStatus("saved");
      await loadHistory();
      return true;
    } catch (caught) {
      setError(messageFromError(caught, "errors.changeSave"));
      setStatus("error");
      return false;
    }
  }, [loadHistory, reload, status]);

  const setProp = useCallback(
    async (nodeId: string, property: string, value: unknown): Promise<boolean> => {
      if (activeLocalPage)
        return updateActiveLocalDocument((document) => {
          const node = findNode(document, nodeId);
          if (node?.kind !== "component") return false;
          (node.props ??= {})[property] = value;
        });
      return commit({
        protocolVersion: "1.0.0",
        commandId: commandId("set_prop"),
        type: "node.setProp",
        nodeId,
        property,
        value
      });
    },
    [activeLocalPage, commit, updateActiveLocalDocument]
  );

  const setVariant = useCallback(
    async (nodeId: string, variant: string): Promise<boolean> => {
      if (activeLocalPage)
        return updateActiveLocalDocument((document) => {
          const node = findNode(document, nodeId);
          if (node?.kind !== "component") return false;
          node.variant = variant;
        });
      return commit({
        protocolVersion: "1.0.0",
        commandId: commandId("set_variant"),
        type: "node.setVariant",
        nodeId,
        variant
      });
    },
    [activeLocalPage, commit, updateActiveLocalDocument]
  );

  const insertComponent = useCallback(async (componentRef: string, explicitTarget?: InsertTarget): Promise<boolean> => {
    const currentDocument = activeDocument;
    if (!currentDocument || !catalog) return false;
    const selected = selectedNodeId ? findNode(currentDocument, selectedNodeId) : undefined;
    const target = explicitTarget ?? defaultInsertTarget(currentDocument, catalog, selected, componentRef);
    const node = createComponentNode(catalog, componentRef, t("defaults.newContent"));
    if (!target || !node) {
      setError(message("errors.noInsertTarget"));
      setStatus("error");
      return false;
    }
    const accepted = activeLocalPage
      ? updateActiveLocalDocument((document) => insertNode(document, target, node))
      : await commit({
      protocolVersion: "1.0.0", commandId: commandId("insert"), type: "node.insert",
      targetParentId: target.parentId, ...(target.slot ? { targetSlot: target.slot } : {}),
      ...(target.beforeNodeId ? { beforeNodeId: target.beforeNodeId } : {}), node
    });
    if (accepted) setSelectedNodeId(node.id);
    return accepted;
  }, [activeDocument, activeLocalPage, catalog, commit, selectedNodeId, t, updateActiveLocalDocument]);

  const insertSavedComponent = useCallback(async (savedId: string, explicitTarget?: InsertTarget): Promise<boolean> => {
    const saved = savedComponents.find(({ id }) => id === savedId);
    if (!activeDocument || !catalog || !saved) return false;
    const selected = selectedNodeId ? findNode(activeDocument, selectedNodeId) : undefined;
    const componentRef = saved.node.kind === "component" ? saved.node.componentRef : "";
    const target = explicitTarget ?? (componentRef ? defaultInsertTarget(activeDocument, catalog, selected, componentRef) : selected?.kind === "layout" ? { parentId: selected.id } : undefined);
    const node = cloneNodeWithFreshIds(saved.node);
    if (!target) { setError(message("errors.noSavedInsertTarget")); setStatus("error"); return false; }
    const accepted = activeLocalPage
      ? updateActiveLocalDocument((document) => insertNode(document, target, node))
      : await commit({
      protocolVersion: "1.0.0", commandId: commandId("insert_saved"), type: "node.insert",
      targetParentId: target.parentId, ...(target.slot ? { targetSlot: target.slot } : {}),
      ...(target.beforeNodeId ? { beforeNodeId: target.beforeNodeId } : {}), node
    });
    if (accepted) setSelectedNodeId(node.id);
    return accepted;
  }, [activeDocument, activeLocalPage, catalog, commit, savedComponents, selectedNodeId, updateActiveLocalDocument]);

  const persistSavedComponents = useCallback((update: (current: SavedComponent[]) => SavedComponent[]): void => {
    setSavedComponents((current) => {
      const next = update(current);
      localStorage.setItem("agidn.studio.saved-components", JSON.stringify(next));
      return next;
    });
  }, []);

  const saveSelectedComponent = useCallback((displayName: string): boolean => {
    const current = revisionRef.current;
    const node = current && selectedNodeId ? findNode(current.document, selectedNodeId) : undefined;
    const normalizedName = displayName.trim();
    if (!node || !normalizedName) return false;
    persistSavedComponents((items) => [...items, {
      id: `saved_${crypto.randomUUID().replaceAll("-", "")}`,
      displayName: normalizedName,
      node: structuredClone(node),
      createdAt: new Date().toISOString()
    }]);
    return true;
  }, [persistSavedComponents, selectedNodeId]);

  const upsertCustomComponentTemplate = useCallback((customComponentId: string, displayName: string, node: PageNode): void => {
    persistSavedComponents((items) => {
      const savedId = `custom_${customComponentId}`;
      const existing = items.find(({ id }) => id === savedId);
      const template: SavedComponent = {
        id: savedId,
        displayName,
        node: structuredClone(node),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        customComponentId
      };
      return existing
        ? items.map((item) => item.id === savedId ? template : item)
        : [...items, template];
    });
  }, [persistSavedComponents]);

  const moveNode = useCallback(async (nodeId: string, target: MoveTarget): Promise<boolean> => {
    const accepted = activeLocalPage
      ? updateActiveLocalDocument((document) => {
          const node = removeNode(document, nodeId);
          if (!node) return false;
          if (!insertNode(document, target, node)) return false;
        })
      : await commit({
      protocolVersion: "1.0.0", commandId: commandId("move"), type: "node.move", nodeId,
      targetParentId: target.parentId, ...(target.slot ? { targetSlot: target.slot } : {}),
      ...(target.beforeNodeId ? { beforeNodeId: target.beforeNodeId } : {})
    });
    if (accepted) setSelectedNodeId(nodeId);
    return accepted;
  }, [activeLocalPage, commit, updateActiveLocalDocument]);

  const removeDocumentNode = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const accepted = activeLocalPage
        ? updateActiveLocalDocument((document) => Boolean(removeNode(document, nodeId)))
        : await commit({
            protocolVersion: "1.0.0",
            commandId: commandId("remove"),
            type: "node.remove",
            nodeId
          });
      if (accepted && selectedNodeId === nodeId) setSelectedNodeId(undefined);
      return accepted;
    },
    [activeLocalPage, commit, selectedNodeId, updateActiveLocalDocument]
  );

  const exportRevision = useCallback(async (): Promise<ExportContextResponse> => {
    const revision = revisionRef.current?.revision;
    if (revision === undefined) throw messageError("errors.documentNotLoaded");
    const value = await jsonResponse(await fetch("/api/v1/export", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ protocolVersion: "1.0.0", revision })
    }));
    if (!checkExportContextResponse(value)) throw messageError("errors.exportProtocol");
    return value as ExportContextResponse;
  }, []);

  const navigate = useCallback(async (direction: "undo" | "redo"): Promise<void> => {
    const current = revisionRef.current;
    if (!current || status === "saving") return;
    setStatus("saving"); setError(undefined);
    try {
      const value = await jsonResponse(await fetch(`/api/v1/${direction}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", baseRevision: current.revision, source: "human" })
      }));
      if (!checkNavigationResponse(value)) throw messageError("errors.navigationProtocol");
      const response = value as NavigationResponse;
      if (!response.ok) throw messageError(direction === "undo" ? "actions.nothingToUndo" : "actions.nothingToRedo");
      setRevisionState(response.revision); setStatus("saved"); await loadHistory();
    } catch (caught) {
      setError(messageFromError(caught, "errors.historyNavigation")); setStatus("error");
    }
  }, [loadHistory, status]);

  const restoreRevision = useCallback(async (targetRevision: number): Promise<boolean> => {
    if (activeLocalPage) return false;
    const current = revisionRef.current;
    if (!current || status === "saving" || targetRevision === current.revision) return false;
    setStatus("saving"); setError(undefined);
    try {
      const value = await jsonResponse(await fetch("/api/v1/history/restore", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", baseRevision: current.revision, targetRevision, source: "human" })
      }));
      if (!checkNavigationResponse(value)) throw messageError("errors.restoreProtocol");
      const response = value as NavigationResponse;
      if (!response.ok) {
        if (response.error === "REVISION_CONFLICT") await reload();
        throw response.error === "REVISION_NOT_FOUND"
          ? messageError("errors.revisionUnavailable", { revision: targetRevision })
          : response.error === "ALREADY_CURRENT" ? messageError("errors.revisionAlreadyCurrent") : messageError("errors.restoreFailed");
      }
      setRevisionState(response.revision);
      if (selectedNodeId && !findNode(response.revision.document, selectedNodeId)) setSelectedNodeId(undefined);
      setStatus("saved"); await loadHistory();
      return true;
    } catch (caught) {
      setError(messageFromError(caught, "errors.restoreFailed")); setStatus("error");
      return false;
    }
  }, [activeLocalPage, loadHistory, reload, selectedNodeId, status]);

  const selectNode = useCallback((nodeId?: string): void => {
    if (nodeId && activeDocument && !findNode(activeDocument, nodeId)) return;
    setSelectedNodeId(nodeId);
  }, [activeDocument]);

  const createPage = useCallback((): string => {
    const name = `Page ${pages.length + 1}`;
    const document = createWorkspacePageDocument(name);
    const page: LocalWorkspacePage = {
      id: document.id,
      name,
      document,
      revision: 0
    };
    setLocalPages((current) => [...current, page]);
    setOpenPageIds((current) => (current.includes(page.id) ? current : [...current, page.id]));
    setActivePageId(page.id);
    setSelectedNodeId(undefined);
    return page.id;
  }, [pages.length]);

  const activatePage = useCallback(
    (pageId: string): void => {
      if (!pages.some(({ id }) => id === pageId)) return;
      setOpenPageIds((current) => (current.includes(pageId) ? current : [...current, pageId]));
      setActivePageId(pageId);
      setSelectedNodeId(undefined);
    },
    [pages]
  );

  const closePage = useCallback(
    (pageId: string): void => {
      if (openPageIds.length <= 1) return;
      const index = openPageIds.indexOf(pageId);
      if (index < 0) return;
      const nextOpen = openPageIds.filter((id) => id !== pageId);
      setOpenPageIds(nextOpen);
      if (activePageId === pageId) {
        const nextId = nextOpen[Math.min(index, nextOpen.length - 1)];
        setActivePageId(nextId);
        setSelectedNodeId(undefined);
      }
    },
    [activePageId, openPageIds]
  );

  const selectedNode = activeDocument && selectedNodeId ? findNode(activeDocument, selectedNodeId) : undefined;
  const value = useMemo<StudioSessionValue>(() => ({
    ...(activeDocument ? { document: activeDocument } : {}),
    pages,
    ...(activePageId ? { activePageId } : {}),
    openPageIds,
    ...(catalog ? { catalog } : {}),
    revision: activeRevision,
    ...(selectedNodeId ? { selectedNodeId } : {}),
    ...(selectedNode ? { selectedNode } : {}),
    status,
    ...(error ? { error } : {}),
    canUndo: activeLocalPage ? false : historyState.canUndo,
    canRedo: activeLocalPage ? false : historyState.canRedo,
    history: activeLocalPage ? [] : historyState.entries,
    savedComponents, ...(activeInsertDrag ? { activeInsertDrag } : {}), ...(activeNodeDragId ? { activeNodeDragId } : {}),
    createPage,
    activatePage,
    closePage,
    selectNode, setProp, setVariant, insertComponent, insertSavedComponent, saveSelectedComponent, upsertCustomComponentTemplate,
    removeSavedComponent: (savedId) => persistSavedComponents((items) => items.filter(({ id }) => id !== savedId)),
    beginInsertDrag: setActiveInsertDrag, endInsertDrag: () => setActiveInsertDrag(undefined),
    beginNodeDrag: setActiveNodeDragId, endNodeDrag: () => setActiveNodeDragId(undefined),
    moveNode,
    removeNode: removeDocumentNode,
    restoreRevision,
    exportRevision,
    undo: () => (activeLocalPage ? Promise.resolve() : navigate("undo")),
    redo: () => (activeLocalPage ? Promise.resolve() : navigate("redo")),
    reload
  }), [
    activatePage,
    activeDocument,
    activeInsertDrag,
    activeLocalPage,
    activeNodeDragId,
    activePageId,
    activeRevision,
    catalog,
    closePage,
    createPage,
    error,
    exportRevision,
    historyState,
    insertComponent,
    insertSavedComponent,
    moveNode,
    navigate,
    openPageIds,
    pages,
    persistSavedComponents,
    removeDocumentNode,
    reload,
    restoreRevision,
    saveSelectedComponent,
    savedComponents,
    selectNode,
    selectedNode,
    selectedNodeId,
    setProp,
    setVariant,
    status,
    upsertCustomComponentTemplate
  ]);

  return <StudioSessionContext.Provider value={value}>{children}</StudioSessionContext.Provider>;
}

export function useStudioSession(): StudioSessionValue {
  const value = useContext(StudioSessionContext);
  if (!value) throw new Error("useStudioSession must be used inside StudioSessionProvider.");
  return value;
}
