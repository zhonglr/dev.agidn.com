import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  decodePreviewToStudioMessage,
  PREVIEW_PROTOCOL_VERSION,
  type PreviewRect,
  type StudioToPreviewMessage
} from "@agidn/preview-protocol";
import type { GetCatalogResponse } from "@agidn/api-protocol";
import type { PageDocument, PageNode } from "@agidn/document-schema";
import { useStudioSession } from "../studio-session.js";
import { NODE_DRAG_MIME, resolveMoveTarget, type MoveTarget } from "../structure-drag.js";
import { screenToCanvas, zoomAtScreenPoint } from "./coordinates.js";

type Breakpoint = "mobile" | "tablet" | "desktop";
type PreviewStatus = "connecting" | "ready" | "error";

interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const SIZE_BY_BREAKPOINT: Record<Breakpoint, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1200, height: 900 }
};

const MIN_SCALE = 0.15;
const MAX_SCALE = 2;

interface NodeLocation { node: PageNode; parent?: PageNode; slot?: string }

function findLocation(document: PageDocument, nodeId: string): NodeLocation | undefined {
  const visit = (nodes: readonly PageNode[], parent?: PageNode, slot?: string): NodeLocation | undefined => {
    for (const node of nodes) {
      if (node.id === nodeId) return { node, ...(parent ? { parent } : {}), ...(slot ? { slot } : {}) };
      if (node.kind === "layout") { const found = visit(node.children, node); if (found) return found; }
      else for (const [slotName, children] of Object.entries(node.slots ?? {})) { const found = visit(children, node, slotName); if (found) return found; }
    }
    return undefined;
  };
  return visit(document.children);
}

function targetForDrop(document: PageDocument, catalog: GetCatalogResponse, hitNodeId: string, componentRef: string): { parentId: string; slot?: string; beforeNodeId?: string } | undefined {
  const location = findLocation(document, hitNodeId);
  if (!location) return undefined;
  if (location.node.kind === "layout") return { parentId: location.node.id };
  const definition = catalog.components.components[location.node.componentRef];
  for (const [slotName, slot] of Object.entries(definition?.slots ?? {})) {
    const count = location.node.slots?.[slotName]?.length ?? 0;
    if ((slot.accepts?.includes("*") || slot.accepts?.includes(componentRef)) && (slot.maxItems === undefined || count < slot.maxItems)) return { parentId: location.node.id, slot: slotName };
  }
  if (!location.parent) return undefined;
  return { parentId: location.parent.id, ...(location.slot ? { slot: location.slot } : {}), beforeNodeId: location.node.id };
}

export function CanvasViewport() {
  const session = useStudioSession();
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef<ViewportState>({ scale: 0.68, offsetX: 56, offsetY: 46 });
  const pendingRef = useRef<ViewportState | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const panningRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | undefined>(undefined);
  const spacePressedRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const pendingDropsRef = useRef(new Map<string, string>());
  const moveRequestsRef = useRef(new Map<string, { sourceNodeId: string; commit: boolean }>());
  const moveCandidateRef = useRef<{ sourceNodeId: string; target: MoveTarget } | undefined>(undefined);
  const lastMoveRequestRef = useRef(0);
  const initializedRef = useRef(false);
  const [viewport, setViewport] = useState(stateRef.current);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [panning, setPanning] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("connecting");
  const [frameAttempt, setFrameAttempt] = useState(0);
  const [selectionRect, setSelectionRect] = useState<PreviewRect>();
  const [previewError, setPreviewError] = useState<string>();
  const [previewContentHeight, setPreviewContentHeight] = useState(0);
  const [movePreview, setMovePreview] = useState<{ rect: PreviewRect; position: "before" | "inside" | "after" }>();
  const baseSize = SIZE_BY_BREAKPOINT[breakpoint];
  const contentSize = { width: baseSize.width, height: Math.max(baseSize.height, previewContentHeight) };
  const previewUrl = import.meta.env.VITE_PREVIEW_URL ?? "http://127.0.0.1:4174/";

  const nextRequestId = useCallback((prefix: string): string => `${prefix}_${++requestSequenceRef.current}`, []);
  const post = useCallback((message: StudioToPreviewMessage): void => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  const messageBase = useCallback((requestId: string) => ({
    source: "agidn.studio" as const,
    protocolVersion: PREVIEW_PROTOCOL_VERSION,
    requestId,
    documentRevision: session.revision
  }), [session.revision]);

  const queueViewport = useCallback((update: (current: ViewportState) => ViewportState) => {
    pendingRef.current = update(pendingRef.current ?? stateRef.current);
    if (frameRef.current !== undefined) return;
    frameRef.current = requestAnimationFrame(() => {
      const next = pendingRef.current;
      pendingRef.current = undefined;
      frameRef.current = undefined;
      if (!next) return;
      stateRef.current = next;
      setViewport(next);
    });
  }, []);

  const centerAtScale = useCallback((scale: number) => {
    const element = viewportRef.current;
    if (!element) return;
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    queueViewport(() => ({
      scale: nextScale,
      offsetX: (element.clientWidth - contentSize.width * nextScale) / 2,
      offsetY: Math.max(28, (element.clientHeight - contentSize.height * nextScale) / 2)
    }));
  }, [contentSize.height, contentSize.width, queueViewport]);

  const fitPage = useCallback(() => {
    const element = viewportRef.current;
    if (!element) return;
    const scale = Math.min(
      (element.clientWidth - 88) / contentSize.width,
      (element.clientHeight - 72) / contentSize.height,
      1
    );
    centerAtScale(scale);
  }, [centerAtScale, contentSize.height, contentSize.width]);

  const fitSelection = useCallback(() => {
    const element = viewportRef.current;
    if (!element || !selectionRect || selectionRect.width === 0 || selectionRect.height === 0) return;
    const scale = Math.min(
      (element.clientWidth - 160) / selectionRect.width,
      (element.clientHeight - 130) / selectionRect.height,
      1.5
    );
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    queueViewport(() => ({
      scale: nextScale,
      offsetX: (element.clientWidth - selectionRect.width * nextScale) / 2 - selectionRect.x * nextScale,
      offsetY: (element.clientHeight - selectionRect.height * nextScale) / 2 - selectionRect.y * nextScale
    }));
  }, [queueViewport, selectionRect]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const decoded = decodePreviewToStudioMessage(event.data);
      if (!decoded.valid) return;
      const message = decoded.message;
      if (message.type === "preview.ready") {
        setPreviewReady(true);
        setPreviewStatus("ready");
        return;
      }
      if (message.documentRevision !== session.revision) return;
      if (message.type === "preview.nodePointerDown") {
        session.selectNode(message.nodeId);
        setSelectionRect(message.rect);
      } else if (message.type === "preview.nodeBounds" && message.nodeId === session.selectedNodeId) {
        setSelectionRect(message.rect);
      } else if (message.type === "preview.dropIntent") {
        const componentRef = pendingDropsRef.current.get(message.requestId);
        pendingDropsRef.current.delete(message.requestId);
        if (!componentRef || !session.document || !session.catalog) return;
        const target = targetForDrop(session.document, session.catalog, message.nodeId, componentRef);
        if (!target) {
          setPreviewError("This component has no legal drop target at that position.");
          return;
        }
        setSelectionRect(message.rect);
        void session.insertComponent(componentRef, target);
      } else if (message.type === "preview.moveIntent") {
        const request = moveRequestsRef.current.get(message.requestId);
        moveRequestsRef.current.delete(message.requestId);
        if (!request || !session.document || !session.catalog) return;
        const resolution = resolveMoveTarget(session.document, session.catalog, request.sourceNodeId, message.nodeId, message.pointerY, message.rect);
        if (!resolution.valid) {
          moveCandidateRef.current = undefined;
          setMovePreview(undefined);
          if (request.commit && !resolution.reason.includes("already at")) setPreviewError(resolution.reason);
          return;
        }
        moveCandidateRef.current = { sourceNodeId: request.sourceNodeId, target: resolution.target };
        setMovePreview({ rect: message.rect, position: resolution.position });
        if (request.commit) {
          void session.moveNode(request.sourceNodeId, resolution.target).finally(() => {
            moveCandidateRef.current = undefined;
            setMovePreview(undefined);
          });
        }
      } else if (message.type === "preview.renderError") {
        setPreviewError(message.message);
      } else if (message.type === "preview.contentOverflow") {
        setPreviewContentHeight(Math.ceil(message.contentHeight));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session.catalog, session.document, session.insertComponent, session.revision, session.selectNode, session.selectedNodeId]);

  useEffect(() => {
    if (previewStatus !== "connecting") return;
    const timeout = window.setTimeout(() => {
      setPreviewStatus("error");
      setPreviewError("Preview did not connect. Check Preview Host, then retry.");
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [frameAttempt, previewStatus]);

  useEffect(() => {
    if (!previewReady || !session.document) return;
    if (!initializedRef.current) {
      post({
        ...messageBase(nextRequestId("initialize")),
        type: "preview.initialize",
        document: session.document,
        breakpoint,
        ...(session.selectedNodeId ? { selectedNodeId: session.selectedNodeId } : {})
      });
      initializedRef.current = true;
      setPreviewStatus("ready");
    } else {
      post({ ...messageBase(nextRequestId("document")), type: "preview.setDocument", document: session.document });
    }
    setPreviewError(undefined);
  }, [messageBase, nextRequestId, post, previewReady, session.document, session.revision]);

  useEffect(() => {
    if (!previewReady || !initializedRef.current) return;
    post({ ...messageBase(nextRequestId("breakpoint")), type: "preview.setBreakpoint", breakpoint });
  }, [breakpoint, messageBase, nextRequestId, post, previewReady]);

  useEffect(() => {
    if (!previewReady) return;
    post({ ...messageBase(nextRequestId("selection")), type: "preview.setSelection", ...(session.selectedNodeId ? { nodeId: session.selectedNodeId } : {}) });
    if (!session.selectedNodeId) setSelectionRect(undefined);
  }, [messageBase, nextRequestId, post, previewReady, session.selectedNodeId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "Space" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        spacePressedRef.current = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "Space") spacePressedRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const bounds = element.getBoundingClientRect();
        const cursorX = event.clientX - bounds.left;
        const cursorY = event.clientY - bounds.top;
        queueViewport((current) => {
          const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * Math.exp(-event.deltaY * 0.002)));
          return zoomAtScreenPoint(current, { x: cursorX, y: cursorY }, nextScale);
        });
      } else {
        queueViewport((current) => ({
          ...current,
          offsetX: current.offsetX - event.deltaX,
          offsetY: current.offsetY - event.deltaY
        }));
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [queueViewport]);

  useEffect(() => () => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
  }, []);

  const startPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button === 1 || (event.button === 0 && spacePressedRef.current)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panningRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: stateRef.current.offsetX,
        originY: stateRef.current.offsetY
      };
      setPanning(true);
      return;
    }
    if (event.button !== 0 || previewStatus !== "ready" || !session.document) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = screenToCanvas(
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      stateRef.current
    );
    if (point.x < 0 || point.y < 0 || point.x > contentSize.width || point.y > contentSize.height) {
      session.selectNode();
      return;
    }
    post({ ...messageBase(nextRequestId("hit")), type: "preview.hitTest", x: point.x, y: point.y });
  };

  const movePan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pan = panningRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    queueViewport((current) => ({
      ...current,
      offsetX: pan.originX + event.clientX - pan.startX,
      offsetY: pan.originY + event.clientY - pan.startY
    }));
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (panningRef.current?.pointerId !== event.pointerId) return;
    panningRef.current = undefined;
    setPanning(false);
  };

  const transformStyle = {
    "--canvas-x": `${viewport.offsetX}px`,
    "--canvas-y": `${viewport.offsetY}px`,
    "--canvas-scale": viewport.scale,
    "--canvas-width": `${contentSize.width}px`,
    "--canvas-height": `${contentSize.height}px`
  } as CSSProperties;

  return (
    <div className="canvas-panel">
      <div className="canvas-toolbar">
        <div className="canvas-toolbar__group" aria-label="Responsive breakpoint">
          {(["desktop", "tablet", "mobile"] as const).map((value) => (
            <button type="button" className={breakpoint === value ? "is-active" : ""} key={value} onClick={() => {
              setPreviewContentHeight(0);
              setBreakpoint(value);
            }}>
              {value[0]!.toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        <div className="canvas-toolbar__group">
          <button type="button" onClick={() => centerAtScale(1)}>100%</button>
          <button type="button" onClick={fitPage}>Fit page</button>
          <button type="button" disabled={!selectionRect} onClick={fitSelection}>Fit selection</button>
          <span className="canvas-zoom">{Math.round(viewport.scale * 100)}%</span>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`canvas-viewport${panning ? " is-panning" : ""}`}
        aria-label="Page canvas. Use trackpad to pan and pinch to zoom."
        tabIndex={0}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDragOver={(event) => {
          const isComponent = event.dataTransfer.types.includes("application/x-agidn-component");
          const isNode = event.dataTransfer.types.includes(NODE_DRAG_MIME);
          if (!isComponent && !isNode) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = isNode ? "move" : "copy";
          if (!isNode || previewStatus !== "ready" || performance.now() - lastMoveRequestRef.current < 70) return;
          const sourceNodeId = event.dataTransfer.getData(NODE_DRAG_MIME);
          if (!sourceNodeId) return;
          lastMoveRequestRef.current = performance.now();
          const bounds = event.currentTarget.getBoundingClientRect();
          const point = screenToCanvas({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, stateRef.current);
          const requestId = nextRequestId("move_preview");
          moveRequestsRef.current.set(requestId, { sourceNodeId, commit: false });
          post({ ...messageBase(requestId), type: "preview.resolveMove", sourceNodeId, x: point.x, y: point.y });
        }}
        onDrop={(event) => {
          const component = event.dataTransfer.getData("application/x-agidn-component");
          const sourceNodeId = event.dataTransfer.getData(NODE_DRAG_MIME);
          if (!component && !sourceNodeId) return;
          event.preventDefault();
          if (previewStatus !== "ready") { setPreviewError("Preview is not connected, so the drop target cannot be resolved."); return; }
          const bounds = event.currentTarget.getBoundingClientRect();
          const point = screenToCanvas({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, stateRef.current);
          if (sourceNodeId) {
            const requestId = nextRequestId("move_commit");
            moveRequestsRef.current.set(requestId, { sourceNodeId, commit: true });
            post({ ...messageBase(requestId), type: "preview.resolveMove", sourceNodeId, x: point.x, y: point.y });
            return;
          }
          const requestId = nextRequestId("drop");
          pendingDropsRef.current.set(requestId, component);
          post({ ...messageBase(requestId), type: "preview.resolveDrop", componentRef: component, x: point.x, y: point.y });
        }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMovePreview(undefined); }}
      >
        <div className="canvas-surface" style={transformStyle}>
          <div className="canvas-artboard-label">{contentSize.width} × {contentSize.height}</div>
          <iframe
            ref={iframeRef}
            className="canvas-preview"
            title="Page preview"
            src={previewUrl}
            key={frameAttempt}
            sandbox="allow-scripts"
            width={contentSize.width}
            height={contentSize.height}
            onLoad={() => {
              initializedRef.current = false;
              setPreviewReady(false);
              setPreviewStatus("connecting");
              setPreviewError(undefined);
            }}
          />
          {selectionRect ? (
            <div
              className="canvas-selection"
              style={{ left: selectionRect.x, top: selectionRect.y, width: selectionRect.width, height: selectionRect.height }}
              draggable={Boolean(session.selectedNodeId)}
              onDragStart={(event) => {
                if (!session.selectedNodeId || spacePressedRef.current) { event.preventDefault(); return; }
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(NODE_DRAG_MIME, session.selectedNodeId);
                event.dataTransfer.setData("text/plain", session.selectedNodeId);
              }}
              onDragEnd={() => { moveCandidateRef.current = undefined; setMovePreview(undefined); }}
            >
              <span>{session.selectedNodeId} · drag to move</span>
            </div>
          ) : null}
          {movePreview ? <div className={`canvas-move-preview canvas-move-preview--${movePreview.position}`} style={{ left: movePreview.rect.x, top: movePreview.position === "after" ? movePreview.rect.y + movePreview.rect.height : movePreview.rect.y, width: movePreview.rect.width, height: movePreview.position === "inside" ? movePreview.rect.height : 3 }} /> : null}
        </div>
        {previewStatus === "connecting" ? <div className="canvas-connection" role="status">Connecting to Preview…</div> : null}
        {previewError ? <div className="canvas-error" role="alert"><span>{previewError}</span>{previewStatus === "error" ? <button type="button" onClick={() => { setPreviewError(undefined); setPreviewStatus("connecting"); setFrameAttempt((value) => value + 1); }}>Retry</button> : null}</div> : null}
        <div className="canvas-help">Trackpad to pan · Pinch to zoom · Space + drag</div>
      </div>
    </div>
  );
}
