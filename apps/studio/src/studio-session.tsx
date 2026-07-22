import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  checkCommitCommandsResponse,
  checkGetDocumentResponse,
  checkGetHistoryResponse,
  checkNavigationResponse,
  type CommitCommandsResponse,
  type GetDocumentResponse,
  type GetHistoryResponse,
  type NavigationResponse
} from "@agidn/api-protocol";
import type { DocumentCommand } from "@agidn/command-engine";
import { findNode, type PageDocument, type PageNode } from "@agidn/document-schema";

type SessionStatus = "loading" | "saved" | "saving" | "error";

interface StudioSessionValue {
  document?: PageDocument;
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

export function StudioSessionProvider({ children }: { children: ReactNode }) {
  const [revisionState, setRevisionState] = useState<GetDocumentResponse["revision"]>();
  const revisionRef = useRef<GetDocumentResponse["revision"] | undefined>(undefined);
  revisionRef.current = revisionState;
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string>();
  const [historyState, setHistoryState] = useState<GetHistoryResponse>({
    protocolVersion: "1.0.0",
    ok: true,
    currentRevision: 0,
    canUndo: false,
    canRedo: false,
    entries: []
  });

  const loadHistory = useCallback(async (): Promise<void> => {
    const value = await jsonResponse(await fetch("/api/v1/history"));
    if (!checkGetHistoryResponse(value)) throw new Error("Workspace history response failed protocol validation.");
    setHistoryState(value as GetHistoryResponse);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    setStatus("loading");
    try {
      const value = await jsonResponse(await fetch("/api/v1/document"));
      if (!checkGetDocumentResponse(value)) throw new Error("Workspace document response failed protocol validation.");
      const response = value as GetDocumentResponse;
      setRevisionState(response.revision);
      setError(undefined);
      setStatus("saved");
      await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workspace could not be loaded.");
      setStatus("error");
    }
  }, [loadHistory]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const commit = useCallback(async (command: DocumentCommand): Promise<boolean> => {
    const current = revisionRef.current;
    if (!current || status === "saving") return false;
    setStatus("saving");
    setError(undefined);
    try {
      const value = await jsonResponse(await fetch("/api/v1/commands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          protocolVersion: "1.0.0",
          baseRevision: current.revision,
          source: "human",
          commands: [command]
        })
      }));
      if (!checkCommitCommandsResponse(value)) throw new Error("Workspace commit response failed protocol validation.");
      const response = value as CommitCommandsResponse;
      if (!response.ok) {
        setError(response.error === "REVISION_CONFLICT" ? "The document changed elsewhere. Reloaded the latest revision." : `Change rejected: ${response.error}`);
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
    protocolVersion: "1.0.0",
    commandId: commandId("set_prop"),
    type: "node.setProp",
    nodeId,
    property,
    value
  }), [commit]);

  const setVariant = useCallback((nodeId: string, variant: string) => commit({
    protocolVersion: "1.0.0",
    commandId: commandId("set_variant"),
    type: "node.setVariant",
    nodeId,
    variant
  }), [commit]);

  const navigate = useCallback(async (direction: "undo" | "redo"): Promise<void> => {
    const current = revisionRef.current;
    if (!current || status === "saving") return;
    setStatus("saving");
    setError(undefined);
    try {
      const value = await jsonResponse(await fetch(`/api/v1/${direction}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: "1.0.0", baseRevision: current.revision, source: "human" })
      }));
      if (!checkNavigationResponse(value)) throw new Error("Workspace navigation response failed protocol validation.");
      const response = value as NavigationResponse;
      if (!response.ok) throw new Error(direction === "undo" ? "There is nothing to undo." : "There is nothing to redo.");
      setRevisionState(response.revision);
      setStatus("saved");
      await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "History navigation failed.");
      setStatus("error");
    }
  }, [loadHistory, status]);

  const selectNode = useCallback((nodeId?: string): void => {
    if (nodeId && revisionRef.current && !findNode(revisionRef.current.document, nodeId)) return;
    setSelectedNodeId(nodeId);
  }, []);

  const selectedNode = revisionState && selectedNodeId ? findNode(revisionState.document, selectedNodeId) : undefined;
  const value = useMemo<StudioSessionValue>(() => ({
    ...(revisionState ? { document: revisionState.document } : {}),
    revision: revisionState?.revision ?? 0,
    ...(selectedNodeId ? { selectedNodeId } : {}),
    ...(selectedNode ? { selectedNode } : {}),
    status,
    ...(error ? { error } : {}),
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    history: historyState.entries,
    selectNode,
    setProp,
    setVariant,
    undo: () => navigate("undo"),
    redo: () => navigate("redo"),
    reload
  }), [error, historyState, navigate, reload, revisionState, selectNode, selectedNode, selectedNodeId, setProp, setVariant, status]);

  return <StudioSessionContext.Provider value={value}>{children}</StudioSessionContext.Provider>;
}

export function useStudioSession(): StudioSessionValue {
  const value = useContext(StudioSessionContext);
  if (!value) throw new Error("useStudioSession must be used inside StudioSessionProvider.");
  return value;
}
