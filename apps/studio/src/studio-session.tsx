import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  checkCommitProjectCommandsResponse,
  checkExportContextResponse,
  checkGetCatalogResponse,
  checkGetProjectHistoryResponse,
  checkGetProjectResponse,
  checkProjectNavigationResponse,
  type CommitProjectCommandsResponse,
  type ExportContextResponse,
  type GetCatalogResponse,
  type GetProjectHistoryResponse,
  type GetProjectResponse,
  type ProjectNavigationResponse
} from "@agidn/api-protocol";
import {
  applyCommand,
  type DocumentCommand,
  type SetLayoutPropertyCommand
} from "@agidn/command-engine";
import {
  findNode,
  type Accessibility,
  type Interaction,
  type PageDocument,
  type PageNode,
  type Placement,
  type Visibility
} from "@agidn/document-schema";
import { layoutCanContain, type InsertSource } from "@agidn/layout-engine";
import { studioStorage } from "./browser-storage.js";
import { useI18n, type MessageDescriptor, type MessageKey } from "./i18n.js";
import { message, messageError, messageFromError } from "./i18n/types.js";
import {
  createNodesForPayload,
  insertSourcesForPayload,
  type InsertDragPayload
} from "./insert-source.js";
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
  UNKNOWN_EVENT: "errors.unknownEvent",
  INVALID_ROLE: "errors.invalidRole",
  INVALID_PLACEMENT: "errors.invalidPlacement",
  ACCESSIBILITY_CONFLICT: "errors.accessibilityConflict",
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

export type { InsertDragPayload } from "./insert-source.js";

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
  history: GetProjectHistoryResponse["entries"];
  activeInsertDrag?: InsertDragPayload;
  activeNodeDragId?: string;
  createPage: () => string;
  activatePage: (pageId: string) => void;
  closePage: (pageId: string) => void;
  selectNode: (nodeId?: string) => void;
  setName: (nodeId: string, name?: string) => Promise<boolean>;
  setRole: (nodeId: string, role?: string) => Promise<boolean>;
  setProp: (nodeId: string, property: string, value: unknown) => Promise<boolean>;
  setVariant: (nodeId: string, variant?: string) => Promise<boolean>;
  setStyleBinding: (nodeId: string, property: string, tokenRef?: string) => Promise<boolean>;
  setPlacement: (nodeId: string, placement?: Placement) => Promise<boolean>;
  setVisibility: (nodeId: string, visibility?: Visibility) => Promise<boolean>;
  setAccessibility: (nodeId: string, accessibility?: Accessibility) => Promise<boolean>;
  setInteractions: (nodeId: string, interactions: Interaction[]) => Promise<boolean>;
  setLayoutProperty: (
    nodeId: string,
    property: SetLayoutPropertyCommand["property"],
    value: unknown
  ) => Promise<boolean>;
  insertNode: (payload: InsertDragPayload, target?: InsertTarget) => Promise<boolean>;
  insertPattern: (patternId: string, target?: InsertTarget) => Promise<boolean>;
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

type JsonResponseResult =
  | { ok: true; value: unknown }
  | { ok: false };

async function tryJsonResponse(response: Response): Promise<JsonResponseResult> {
  if (!response.ok && response.status >= 500) return { ok: false };
  try {
    return { ok: true, value: await response.json() as unknown };
  } catch {
    return { ok: false };
  }
}

async function jsonResponse(response: Response): Promise<unknown> {
  const result = await tryJsonResponse(response);
  if (!result.ok) throw messageError("errors.workspaceRequest");
  return result.value;
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

function loadLocalPages(): LocalWorkspacePage[] {
  try {
    const value: unknown = JSON.parse(studioStorage.getItem("agidn.studio.v2.pages") ?? "[]");
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
      studioStorage.getItem("agidn.studio.v2.page-view") ?? "{}"
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
    schemaVersion: "2.0.0",
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

function defaultInsertTarget(
  document: PageDocument,
  catalog: GetCatalogResponse,
  selectedNode: PageNode | undefined,
  source: InsertSource
): InsertTarget | undefined {
  if (selectedNode?.kind === "layout" && layoutCanContain(selectedNode, source)) {
    return { parentId: selectedNode.id };
  }
  if (selectedNode?.kind === "component") {
    const definition = catalog.components.components[selectedNode.componentRef];
    for (const [slotName, slot] of Object.entries(definition?.slots ?? {})) {
      const accepts = slot.accepts ?? ["*"];
      const count = selectedNode.slots?.[slotName]?.length ?? 0;
      const accepted =
        accepts.includes("*") ||
        (source.kind === "component" && accepts.includes(source.componentRef));
      if (accepted && (slot.maxItems === undefined || count < slot.maxItems)) {
        return { parentId: selectedNode.id, slot: slotName };
      }
    }
  }
  if (source.kind === "layout" && source.layout === "section") {
    return { parentId: document.id };
  }
  const fallback = allNodes(document).find(
    (node) => node.kind === "layout" && layoutCanContain(node, source)
  );
  return fallback ? { parentId: fallback.id } : undefined;
}

export function StudioSessionProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [revisionState, setRevisionState] =
    useState<GetProjectResponse["revision"]>();
  const revisionRef = useRef<
    GetProjectResponse["revision"] | undefined
  >(undefined);
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
  const [activeInsertDrag, setActiveInsertDrag] = useState<InsertDragPayload>();
  const [activeNodeDragId, setActiveNodeDragId] = useState<string>();
  const [historyState, setHistoryState] =
    useState<GetProjectHistoryResponse>({
    protocolVersion: "2.0.0", ok: true, currentRevision: 0, canUndo: false, canRedo: false, entries: []
  });

  const loadHistory = useCallback(async (): Promise<void> => {
    const value = await jsonResponse(
      await fetch("/api/v1/project/history")
    );
    if (!checkGetProjectHistoryResponse(value)) {
      throw messageError("errors.historyProtocol");
    }
    setHistoryState(value as GetProjectHistoryResponse);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    setStatus("loading");
    try {
      const [documentResult, catalogResult] = await Promise.all([
        fetch("/api/v1/project").then(tryJsonResponse),
        fetch("/api/v1/catalog").then(tryJsonResponse)
      ]);
      if (!documentResult.ok || !catalogResult.ok) {
        setError(message("errors.workspaceRequest"));
        setStatus("error");
        return;
      }
      const documentValue = documentResult.value;
      const catalogValue = catalogResult.value;
      if (!checkGetProjectResponse(documentValue)) {
        setError(message("errors.documentProtocol"));
        setStatus("error");
        return;
      }
      if (!checkGetCatalogResponse(catalogValue)) {
        setError(message("errors.catalogProtocol"));
        setStatus("error");
        return;
      }
      const response = documentValue as GetProjectResponse;
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
    studioStorage.setItem("agidn.studio.v2.pages", JSON.stringify(localPages));
  }, [localPages]);

  useEffect(() => {
    studioStorage.setItem(
      "agidn.studio.v2.page-view",
      JSON.stringify({ activePageId, openPageIds })
    );
  }, [activePageId, openPageIds]);

  useEffect(() => {
    const primaryId = revisionState?.project.document.id;
    if (!primaryId || activePageId) return;
    setActivePageId(primaryId);
    setOpenPageIds((current) => (current.includes(primaryId) ? current : [...current, primaryId]));
  }, [activePageId, revisionState?.project.document.id]);

  const activeLocalPage = localPages.find(({ id }) => id === activePageId);
  const activeDocument =
    activeLocalPage?.document ?? revisionState?.project.document;
  const activeRevision = activeLocalPage?.revision ?? revisionState?.revision ?? 0;
  const pages = useMemo<WorkspacePage[]>(() => {
    const primary = revisionState
      ? [
          {
            id: revisionState.project.document.id,
            name:
              revisionState.project.document.name ??
              revisionState.project.document.id,
            document: revisionState.project.document,
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

  const commit = useCallback(async (input: DocumentCommand | readonly DocumentCommand[]): Promise<boolean> => {
    const current = revisionRef.current;
    if (!current || status === "saving") return false;
    const commands = Array.isArray(input) ? [...input] : [input as DocumentCommand];
    setStatus("saving");
    setError(undefined);
    try {
      const value = await jsonResponse(await fetch("/api/v1/project/commands", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "2.0.0", baseRevision: current.revision, source: "human", commands })
      }));
      if (!checkCommitProjectCommandsResponse(value)) {
        throw messageError("errors.commitProtocol");
      }
      const response = value as CommitProjectCommandsResponse;
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

  const dispatch = useCallback(
    async (command: DocumentCommand): Promise<boolean> => {
      if (!activeLocalPage) return commit(command);
      if (!catalog) return false;
      let rejectionCode: string | undefined;
      const accepted = updateActiveLocalDocument((document) => {
        const result = applyCommand(document, command, {
          components: catalog.components,
          tokens: catalog.tokens,
          actions: catalog.actions
        });
        if (!result.accepted) {
          rejectionCode = result.violations[0]?.code;
          return false;
        }
        Object.assign(document, result.document);
      });
      if (!accepted) {
        setError(
          message(VIOLATION_MESSAGE_KEYS[rejectionCode ?? ""] ?? "errors.serverRejected")
        );
        setStatus("error");
        return false;
      }
      setError(undefined);
      setStatus("saved");
      return true;
    },
    [activeLocalPage, catalog, commit, updateActiveLocalDocument]
  );

  const dispatchMany = useCallback(
    async (commands: readonly DocumentCommand[]): Promise<boolean> => {
      if (commands.length === 0) return false;
      if (!activeLocalPage) return commit(commands);
      if (!catalog) return false;
      let rejectionCode: string | undefined;
      const accepted = updateActiveLocalDocument((document) => {
        let candidate = document;
        for (const command of commands) {
          const result = applyCommand(candidate, command, {
            components: catalog.components,
            tokens: catalog.tokens,
            actions: catalog.actions
          });
          if (!result.accepted) {
            rejectionCode = result.violations[0]?.code;
            return false;
          }
          candidate = result.document;
        }
        Object.assign(document, candidate);
      });
      if (!accepted) {
        setError(
          message(VIOLATION_MESSAGE_KEYS[rejectionCode ?? ""] ?? "errors.serverRejected")
        );
        setStatus("error");
        return false;
      }
      setError(undefined);
      setStatus("saved");
      return true;
    },
    [activeLocalPage, catalog, commit, updateActiveLocalDocument]
  );

  const setName = useCallback(
    (nodeId: string, name?: string): Promise<boolean> =>
      dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_name"),
        type: "node.setName",
        nodeId,
        name: name || null
      }),
    [dispatch]
  );

  const setRole = useCallback(
    (nodeId: string, role?: string): Promise<boolean> =>
      dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_role"),
        type: "node.setRole",
        nodeId,
        role: role || null
      }),
    [dispatch]
  );

  const setProp = useCallback(
    async (nodeId: string, property: string, value: unknown): Promise<boolean> => {
      return dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_prop"),
        type: "node.setProp",
        nodeId,
        property,
        value
      });
    },
    [dispatch]
  );

  const setVariant = useCallback(
    async (nodeId: string, variant?: string): Promise<boolean> => {
      return dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_variant"),
        type: "node.setVariant",
        nodeId,
        variant: variant ?? null
      });
    },
    [dispatch]
  );

  const setStyleBinding = useCallback(
    (nodeId: string, property: string, tokenRef?: string): Promise<boolean> =>
      dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_style_binding"),
        type: "node.setStyleBinding",
        nodeId,
        property,
        tokenRef: tokenRef ?? null
      }),
    [dispatch]
  );

  const setPlacement = useCallback(
    (nodeId: string, placement?: Placement): Promise<boolean> =>
      dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_placement"),
        type: "node.setPlacement",
        nodeId,
        placement: placement ?? null
      }),
    [dispatch]
  );

  const setVisibility = useCallback(
    (nodeId: string, visibility?: Visibility): Promise<boolean> =>
      dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_visibility"),
        type: "node.setVisibility",
        nodeId,
        visibility: visibility ?? null
      }),
    [dispatch]
  );

  const setAccessibility = useCallback(
    (nodeId: string, accessibility?: Accessibility): Promise<boolean> =>
      dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_accessibility"),
        type: "node.setAccessibility",
        nodeId,
        accessibility: accessibility ?? null
      }),
    [dispatch]
  );

  const setInteractions = useCallback(
    (nodeId: string, interactions: Interaction[]): Promise<boolean> =>
      dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_interactions"),
        type: "node.setInteractions",
        nodeId,
        interactions
      }),
    [dispatch]
  );

  const setLayoutProperty = useCallback(
    (
      nodeId: string,
      property: SetLayoutPropertyCommand["property"],
      value: unknown
    ): Promise<boolean> =>
      dispatch({
        protocolVersion: "2.0.0",
        commandId: commandId("set_layout"),
        type: "node.setLayoutProperty",
        nodeId,
        property,
        value: value ?? null
      } as DocumentCommand),
    [dispatch]
  );

  const insertNode = useCallback(async (payload: InsertDragPayload, explicitTarget?: InsertTarget): Promise<boolean> => {
    const currentDocument = activeDocument;
    if (!currentDocument || !catalog) return false;
    const selected = selectedNodeId ? findNode(currentDocument, selectedNodeId) : undefined;
    const source = insertSourcesForPayload(catalog, payload)[0];
    const target =
      explicitTarget ??
      (source
        ? defaultInsertTarget(currentDocument, catalog, selected, source)
        : undefined);
    const nodes = createNodesForPayload(
      catalog,
      payload,
      t("defaults.newContent")
    );
    if (!target || nodes.length === 0) {
      setError(message("errors.noInsertTarget"));
      setStatus("error");
      return false;
    }
    const commands: DocumentCommand[] = nodes.map((node, index) => ({
      protocolVersion: "2.0.0",
      commandId: commandId(`insert_${payload.type}_${index}`),
      type: "node.insert",
      targetParentId: target.parentId,
      ...(target.slot ? { targetSlot: target.slot } : {}),
      ...(target.beforeNodeId ? { beforeNodeId: target.beforeNodeId } : {}),
      node
    }));
    const accepted =
      commands.length === 1
        ? await dispatch(commands[0]!)
        : await dispatchMany(commands);
    if (accepted) setSelectedNodeId(nodes[0]!.id);
    return accepted;
  }, [
    activeDocument,
    catalog,
    dispatch,
    dispatchMany,
    selectedNodeId,
    t
  ]);

  const insertPattern = useCallback(
    async (patternId: string, explicitTarget?: InsertTarget): Promise<boolean> => {
      return insertNode({ type: "pattern", id: patternId }, explicitTarget);
    },
    [insertNode]
  );

  const moveNode = useCallback(async (nodeId: string, target: MoveTarget): Promise<boolean> => {
    const accepted = await dispatch({
      protocolVersion: "2.0.0", commandId: commandId("move"), type: "node.move", nodeId,
      targetParentId: target.parentId, ...(target.slot ? { targetSlot: target.slot } : {}),
      ...(target.beforeNodeId ? { beforeNodeId: target.beforeNodeId } : {})
    });
    if (accepted) setSelectedNodeId(nodeId);
    return accepted;
  }, [dispatch]);

  const removeDocumentNode = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const accepted = await dispatch({
            protocolVersion: "2.0.0",
            commandId: commandId("remove"),
            type: "node.remove",
            nodeId
          });
      if (accepted && selectedNodeId === nodeId) setSelectedNodeId(undefined);
      return accepted;
    },
    [dispatch, selectedNodeId]
  );

  const exportRevision = useCallback(async (): Promise<ExportContextResponse> => {
    const revision = revisionRef.current?.revision;
    if (revision === undefined) throw messageError("errors.documentNotLoaded");
    const value = await jsonResponse(await fetch("/api/v1/export", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ protocolVersion: "2.0.0", revision })
    }));
    if (!checkExportContextResponse(value)) throw messageError("errors.exportProtocol");
    return value as ExportContextResponse;
  }, []);

  const navigate = useCallback(async (direction: "undo" | "redo"): Promise<void> => {
    const current = revisionRef.current;
    if (!current || status === "saving") return;
    setStatus("saving"); setError(undefined);
    try {
      const value = await jsonResponse(await fetch(`/api/v1/project/${direction}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "2.0.0", baseRevision: current.revision, source: "human" })
      }));
      if (!checkProjectNavigationResponse(value)) {
        throw messageError("errors.navigationProtocol");
      }
      const response = value as ProjectNavigationResponse;
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
      const value = await jsonResponse(await fetch("/api/v1/project/history/restore", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "2.0.0", baseRevision: current.revision, targetRevision, source: "human" })
      }));
      if (!checkProjectNavigationResponse(value)) {
        throw messageError("errors.restoreProtocol");
      }
      const response = value as ProjectNavigationResponse;
      if (!response.ok) {
        if (response.error === "REVISION_CONFLICT") await reload();
        throw response.error === "REVISION_NOT_FOUND"
          ? messageError("errors.revisionUnavailable", { revision: targetRevision })
          : response.error === "ALREADY_CURRENT" ? messageError("errors.revisionAlreadyCurrent") : messageError("errors.restoreFailed");
      }
      setRevisionState(response.revision);
      if (
        selectedNodeId &&
        !findNode(
          response.revision.project.document,
          selectedNodeId
        )
      ) {
        setSelectedNodeId(undefined);
      }
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
    ...(activeInsertDrag ? { activeInsertDrag } : {}), ...(activeNodeDragId ? { activeNodeDragId } : {}),
    createPage,
    activatePage,
    closePage,
    selectNode,
    setName,
    setRole,
    setProp,
    setVariant,
    setStyleBinding,
    setPlacement,
    setVisibility,
    setAccessibility,
    setInteractions,
    setLayoutProperty,
    insertNode,
    insertPattern,
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
    insertNode,
    insertPattern,
    moveNode,
    navigate,
    openPageIds,
    pages,
    removeDocumentNode,
    reload,
    restoreRevision,
    selectNode,
    selectedNode,
    selectedNodeId,
    setProp,
    setName,
    setRole,
    setVariant,
    setStyleBinding,
    setPlacement,
    setVisibility,
    setAccessibility,
    setInteractions,
    setLayoutProperty,
    status
  ]);

  return <StudioSessionContext.Provider value={value}>{children}</StudioSessionContext.Provider>;
}

export function useStudioSession(): StudioSessionValue {
  const value = useContext(StudioSessionContext);
  if (!value) throw new Error("useStudioSession must be used inside StudioSessionProvider.");
  return value;
}
