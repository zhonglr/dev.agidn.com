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
import type { MoveTarget } from "./structure-drag.js";

type SessionStatus = "loading" | "saved" | "saving" | "error";

interface InsertTarget {
  parentId: string;
  slot?: string;
  beforeNodeId?: string;
}

interface StudioSessionValue {
  document?: PageDocument;
  catalog?: GetCatalogResponse;
  revision: number;
  selectedNodeId?: string;
  selectedNode?: PageNode;
  status: SessionStatus;
  error?: string;
  canUndo: boolean;
  canRedo: boolean;
  history: GetHistoryResponse["entries"];
  selectNode: (nodeId?: string) => void;
  setProp: (nodeId: string, property: string, value: unknown) => Promise<boolean>;
  setVariant: (nodeId: string, variant: string) => Promise<boolean>;
  insertComponent: (componentRef: string, target?: InsertTarget) => Promise<boolean>;
  moveNode: (nodeId: string, target: MoveTarget) => Promise<boolean>;
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
  if (!response.ok && response.status >= 500) throw new Error("Workspace Server could not process the request.");
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

function defaultValue(definition: GetCatalogResponse["components"]["components"][string]["props"][string]): unknown {
  if (definition.type === "boolean") return false;
  if (definition.type === "number") return 0;
  if (definition.type === "enum") return definition.values?.[0] ?? "";
  return "New content";
}

function createComponentNode(catalog: GetCatalogResponse, componentRef: string, depth = 0): ComponentNode | undefined {
  const definition = catalog.components.components[componentRef];
  if (!definition) return undefined;
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const props = Object.fromEntries(Object.entries(definition.props)
    .filter(([, prop]) => prop.required)
    .map(([name, prop]) => [name, defaultValue(prop)]));
  const slots: Record<string, PageNode[]> = {};
  if (depth < 3) {
    for (const [slotName, slot] of Object.entries(definition.slots)) {
      const count = Math.max(slot.minItems ?? 0, slot.required ? 1 : 0);
      if (count === 0) continue;
      const childRef = slot.accepts?.find((candidate) => candidate !== "*") ?? "Text";
      const children = Array.from({ length: count }, () => createComponentNode(catalog, childRef, depth + 1)).filter((node): node is ComponentNode => Boolean(node));
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
  const [revisionState, setRevisionState] = useState<GetDocumentResponse["revision"]>();
  const revisionRef = useRef<GetDocumentResponse["revision"] | undefined>(undefined);
  revisionRef.current = revisionState;
  const [catalog, setCatalog] = useState<GetCatalogResponse>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string>();
  const [historyState, setHistoryState] = useState<GetHistoryResponse>({
    protocolVersion: "1.0.0", ok: true, currentRevision: 0, canUndo: false, canRedo: false, entries: []
  });

  const loadHistory = useCallback(async (): Promise<void> => {
    const value = await jsonResponse(await fetch("/api/v1/history"));
    if (!checkGetHistoryResponse(value)) throw new Error("Workspace history response failed protocol validation.");
    setHistoryState(value as GetHistoryResponse);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    setStatus("loading");
    try {
      const [documentValue, catalogValue] = await Promise.all([
        jsonResponse(await fetch("/api/v1/document")),
        jsonResponse(await fetch("/api/v1/catalog"))
      ]);
      if (!checkGetDocumentResponse(documentValue)) throw new Error("Workspace document response failed protocol validation.");
      if (!checkGetCatalogResponse(catalogValue)) throw new Error("Workspace catalog response failed protocol validation.");
      const response = documentValue as GetDocumentResponse;
      setRevisionState(response.revision);
      setCatalog(catalogValue as GetCatalogResponse);
      setError(undefined);
      setStatus("saved");
      await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workspace could not be loaded.");
      setStatus("error");
    }
  }, [loadHistory]);

  useEffect(() => { void reload(); }, [reload]);

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
      if (!checkCommitCommandsResponse(value)) throw new Error("Workspace commit response failed protocol validation.");
      const response = value as CommitCommandsResponse;
      if (!response.ok) {
        setError(response.error === "REVISION_CONFLICT" ? "Revision conflict: reloaded the latest document." : response.violations?.[0]?.message ?? `Server rejected the change: ${response.error}`);
        await reload();
        return false;
      }
      setRevisionState(response.revision);
      setStatus("saved");
      await loadHistory();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Change could not be saved.");
      setStatus("error");
      return false;
    }
  }, [loadHistory, reload, status]);

  const setProp = useCallback((nodeId: string, property: string, value: unknown) => commit({
    protocolVersion: "1.0.0", commandId: commandId("set_prop"), type: "node.setProp", nodeId, property, value
  }), [commit]);

  const setVariant = useCallback((nodeId: string, variant: string) => commit({
    protocolVersion: "1.0.0", commandId: commandId("set_variant"), type: "node.setVariant", nodeId, variant
  }), [commit]);

  const insertComponent = useCallback(async (componentRef: string, explicitTarget?: InsertTarget): Promise<boolean> => {
    const current = revisionRef.current;
    if (!current || !catalog) return false;
    const selected = selectedNodeId ? findNode(current.document, selectedNodeId) : undefined;
    const target = explicitTarget ?? defaultInsertTarget(current.document, catalog, selected, componentRef);
    const node = createComponentNode(catalog, componentRef);
    if (!target || !node) {
      setError("No compatible insertion target is available for this component.");
      setStatus("error");
      return false;
    }
    const accepted = await commit({
      protocolVersion: "1.0.0", commandId: commandId("insert"), type: "node.insert",
      targetParentId: target.parentId, ...(target.slot ? { targetSlot: target.slot } : {}),
      ...(target.beforeNodeId ? { beforeNodeId: target.beforeNodeId } : {}), node
    });
    if (accepted) setSelectedNodeId(node.id);
    return accepted;
  }, [catalog, commit, selectedNodeId]);

  const moveNode = useCallback(async (nodeId: string, target: MoveTarget): Promise<boolean> => {
    const accepted = await commit({
      protocolVersion: "1.0.0", commandId: commandId("move"), type: "node.move", nodeId,
      targetParentId: target.parentId, ...(target.slot ? { targetSlot: target.slot } : {}),
      ...(target.beforeNodeId ? { beforeNodeId: target.beforeNodeId } : {})
    });
    if (accepted) setSelectedNodeId(nodeId);
    return accepted;
  }, [commit]);

  const exportRevision = useCallback(async (): Promise<ExportContextResponse> => {
    const revision = revisionRef.current?.revision;
    if (revision === undefined) throw new Error("The document has not loaded yet.");
    const value = await jsonResponse(await fetch("/api/v1/export", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ protocolVersion: "1.0.0", revision })
    }));
    if (!checkExportContextResponse(value)) throw new Error("Workspace export response failed protocol validation.");
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
      if (!checkNavigationResponse(value)) throw new Error("Workspace navigation response failed protocol validation.");
      const response = value as NavigationResponse;
      if (!response.ok) throw new Error(direction === "undo" ? "There is nothing to undo." : "There is nothing to redo.");
      setRevisionState(response.revision); setStatus("saved"); await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "History navigation failed."); setStatus("error");
    }
  }, [loadHistory, status]);

  const selectNode = useCallback((nodeId?: string): void => {
    if (nodeId && revisionRef.current && !findNode(revisionRef.current.document, nodeId)) return;
    setSelectedNodeId(nodeId);
  }, []);

  const selectedNode = revisionState && selectedNodeId ? findNode(revisionState.document, selectedNodeId) : undefined;
  const value = useMemo<StudioSessionValue>(() => ({
    ...(revisionState ? { document: revisionState.document } : {}), ...(catalog ? { catalog } : {}),
    revision: revisionState?.revision ?? 0, ...(selectedNodeId ? { selectedNodeId } : {}), ...(selectedNode ? { selectedNode } : {}),
    status, ...(error ? { error } : {}), canUndo: historyState.canUndo, canRedo: historyState.canRedo, history: historyState.entries,
    selectNode, setProp, setVariant, insertComponent, moveNode, exportRevision,
    undo: () => navigate("undo"), redo: () => navigate("redo"), reload
  }), [catalog, error, exportRevision, historyState, insertComponent, moveNode, navigate, reload, revisionState, selectNode, selectedNode, selectedNodeId, setProp, setVariant, status]);

  return <StudioSessionContext.Provider value={value}>{children}</StudioSessionContext.Provider>;
}

export function useStudioSession(): StudioSessionValue {
  const value = useContext(StudioSessionContext);
  if (!value) throw new Error("useStudioSession must be used inside StudioSessionProvider.");
  return value;
}
