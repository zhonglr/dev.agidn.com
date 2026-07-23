import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  decodePreviewToStudioMessage,
  PREVIEW_PROTOCOL_VERSION,
  type PreviewRect,
  type StudioToPreviewMessage
} from "@agidn/preview-protocol";
import { findNode, type PageNode } from "@agidn/document-schema";
import { createComponentNode } from "../component-node-factory.js";
import { useStudioSession } from "../studio-session.js";
import type { ContextMenuTarget } from "../context-menu/registry.js";
import {
  COMPONENT_DRAG_MIME,
  NODE_DRAG_MIME,
  resolveInsertTarget,
  resolveMoveTarget,
  SAVED_COMPONENT_DRAG_MIME,
  type MoveTarget
} from "../structure-drag.js";
import { useI18n, type MessageDescriptor, type MessageKey } from "../i18n.js";
import { structureDragErrorMessage } from "../i18n/structure-drag.js";
import { message as localizedMessage } from "../i18n/types.js";
import { ActionButton, ToggleButton, useContextMenu } from "../components/ui/index.js";
import { centerRectInViewportIfNeeded, previewRectToScreen, screenToCanvas, zoomAtScreenPoint } from "./coordinates.js";

type Breakpoint = "mobile" | "tablet" | "desktop";
type PreviewStatus = "connecting" | "ready" | "error";

interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface SelectionBounds {
  nodeId: string;
  rect: PreviewRect;
}

const SIZE_BY_BREAKPOINT: Record<Breakpoint, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1200, height: 900 }
};

const MIN_SCALE = 0.15;
const MAX_SCALE = 2;
const BREAKPOINT_KEYS: Readonly<Record<Breakpoint, MessageKey>> = {
  desktop: "canvas.desktop",
  tablet: "canvas.tablet",
  mobile: "canvas.mobile"
};

export function CanvasViewport() {
  const session = useStudioSession();
  const { format, t } = useI18n();
  const { openContextMenu, openContextMenuAt } = useContextMenu();
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef<ViewportState>({ scale: 0.68, offsetX: 56, offsetY: 46 });
  const pendingRef = useRef<ViewportState | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const panningRef = useRef<
    { pointerId: number; startX: number; startY: number; originX: number; originY: number } | undefined
  >(undefined);
  const spacePressedRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const pendingDropsRef = useRef(
    new Map<string, { payload: { type: "component" | "saved"; id: string }; commit: boolean }>()
  );
  const pendingContextMenusRef = useRef(
    new Map<string, { point: { x: number; y: number }; returnFocusTo: HTMLElement; timeout: number }>()
  );
  const moveRequestsRef = useRef(new Map<string, { sourceNodeId: string; commit: boolean }>());
  const lastMoveRequestRef = useRef(0);
  const lastInsertRequestRef = useRef(0);
  const initializedRef = useRef(false);
  const [viewport, setViewport] = useState(stateRef.current);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [panning, setPanning] = useState(false);
  const [revealingSelection, setRevealingSelection] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("connecting");
  const [frameAttempt, setFrameAttempt] = useState(0);
  const [selectionBounds, setSelectionBounds] = useState<SelectionBounds>();
  const [previewError, setPreviewError] = useState<MessageDescriptor>();
  const [previewContentHeights, setPreviewContentHeights] = useState<Record<string, number>>({});
  const ghostActiveRef = useRef(false);
  const insertGhostNodeRef = useRef<{ key: string; node: PageNode } | undefined>(undefined);
  const baseSize = SIZE_BY_BREAKPOINT[breakpoint];
  const contentHeightKey = `${session.activePageId ?? session.document?.id ?? "loading"}:${breakpoint}`;
  const previewContentHeight = previewContentHeights[contentHeightKey] ?? 0;
  const selectionRect =
    selectionBounds && selectionBounds.nodeId === session.selectedNodeId ? selectionBounds.rect : undefined;
  const contentSize = { width: baseSize.width, height: Math.max(baseSize.height, previewContentHeight) };
  const previewUrl = import.meta.env.VITE_PREVIEW_URL ?? "http://127.0.0.1:4174/";

  const nextRequestId = useCallback((prefix: string): string => `${prefix}_${++requestSequenceRef.current}`, []);
  const post = useCallback((message: StudioToPreviewMessage): void => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  const messageBase = useCallback(
    (requestId: string) => ({
      source: "agidn.studio" as const,
      protocolVersion: PREVIEW_PROTOCOL_VERSION,
      requestId,
      documentRevision: session.revision
    }),
    [session.revision]
  );

  const showDropGhost = useCallback(
    (target: MoveTarget, node: PageNode, moveSourceNodeId?: string): void => {
      ghostActiveRef.current = true;
      post({
        ...messageBase(nextRequestId("ghost")),
        type: "preview.showDropGhost",
        target,
        node,
        ...(moveSourceNodeId ? { moveSourceNodeId } : {})
      });
    },
    [messageBase, nextRequestId, post]
  );

  const hideDropGhost = useCallback((): void => {
    if (!ghostActiveRef.current) return;
    ghostActiveRef.current = false;
    insertGhostNodeRef.current = undefined;
    post({ ...messageBase(nextRequestId("ghost")), type: "preview.hideDropGhost" });
  }, [messageBase, nextRequestId, post]);

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

  const centerAtScale = useCallback(
    (scale: number) => {
      const element = viewportRef.current;
      if (!element) return;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
      queueViewport(() => ({
        scale: nextScale,
        offsetX: (element.clientWidth - contentSize.width * nextScale) / 2,
        offsetY: Math.max(28, (element.clientHeight - contentSize.height * nextScale) / 2)
      }));
    },
    [contentSize.height, contentSize.width, queueViewport]
  );

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

  const fitRect = useCallback((rect: PreviewRect) => {
    const element = viewportRef.current;
    if (!element || rect.width === 0 || rect.height === 0) return;
    const scale = Math.min(
      (element.clientWidth - 160) / rect.width,
      (element.clientHeight - 130) / rect.height,
      1.5
    );
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    queueViewport(() => ({
      scale: nextScale,
      offsetX: (element.clientWidth - rect.width * nextScale) / 2 - rect.x * nextScale,
      offsetY: (element.clientHeight - rect.height * nextScale) / 2 - rect.y * nextScale
    }));
  }, [queueViewport]);

  const fitSelection = useCallback(() => {
    if (selectionRect) fitRect(selectionRect);
  }, [fitRect, selectionRect]);

  const nodeContextTarget = useCallback(
    (nodeId: string, rect?: PreviewRect): ContextMenuTarget => {
      const node = session.document ? findNode(session.document, nodeId) : undefined;
      const label = node?.name ?? (node?.kind === "component" ? node.componentRef : node?.role ?? node?.layout) ?? nodeId;
      return {
        type: "node",
        id: nodeId,
        label,
        metadata: { nodeKind: node?.kind, surface: "canvas" },
        capabilities: {
          select: { execute: () => session.selectNode(nodeId) },
          fitPage: { execute: fitPage },
          fitSelection: {
            execute: () => {
              if (rect) fitRect(rect);
              else fitSelection();
            },
            isDisabled: !rect && !selectionRect
          },
          remove: {
            execute: () => session.removeNode(nodeId),
            isDisabled: session.status === "saving"
          }
        }
      };
    },
    [fitPage, fitRect, fitSelection, selectionRect, session]
  );

  const canvasContextTarget = useCallback(
    (): ContextMenuTarget => ({
      type: "canvas",
      label: t("navigation.canvas"),
      capabilities: {
        createPage: { execute: () => void session.createPage() },
        fitPage: { execute: fitPage },
        undo: { execute: session.undo, isDisabled: !session.canUndo },
        redo: { execute: session.redo, isDisabled: !session.canRedo }
      }
    }),
    [fitPage, session, t]
  );

  const revealSelection = useCallback(
    (rect: PreviewRect) => {
      const element = viewportRef.current;
      if (!element) return;
      queueViewport((current) => {
        const next = centerRectInViewportIfNeeded(rect, current, {
          width: element.clientWidth,
          height: element.clientHeight
        });
        if (next !== current) setRevealingSelection(true);
        return next;
      });
    },
    [queueViewport]
  );

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
        const pendingContextMenu = pendingContextMenusRef.current.get(message.requestId);
        if (pendingContextMenu) {
          window.clearTimeout(pendingContextMenu.timeout);
          pendingContextMenusRef.current.delete(message.requestId);
          session.selectNode(message.nodeId);
          setSelectionBounds({ nodeId: message.nodeId, rect: message.rect });
          openContextMenuAt(
            pendingContextMenu.point,
            nodeContextTarget(message.nodeId, message.rect),
            pendingContextMenu.returnFocusTo
          );
          return;
        }
        session.selectNode(message.nodeId);
        setSelectionBounds({ nodeId: message.nodeId, rect: message.rect });
      } else if (message.type === "preview.nodeBounds" && message.nodeId === session.selectedNodeId) {
        // Bounds shifts caused by a drop ghost must not move the selection
        // overlay or auto-reveal it, or the canvas pans itself mid-drag.
        if (session.activeInsertDrag || session.activeNodeDragId) return;
        setSelectionBounds({ nodeId: message.nodeId, rect: message.rect });
        revealSelection(message.rect);
      } else if (message.type === "preview.dropIntent") {
        const request = pendingDropsRef.current.get(message.requestId);
        pendingDropsRef.current.delete(message.requestId);
        if (!request || !session.document || !session.catalog) return;
        const saved =
          request.payload.type === "saved"
            ? session.savedComponents.find(({ id }) => id === request.payload.id)
            : undefined;
        const source =
          request.payload.type === "component"
            ? { kind: "component" as const, componentRef: request.payload.id }
            : saved?.node.kind === "component"
              ? { kind: "component" as const, componentRef: saved.node.componentRef }
              : { kind: "layout" as const };
        const resolution = resolveInsertTarget(
          session.document,
          session.catalog,
          source,
          message.nodeId,
          { x: message.pointerX, y: message.pointerY },
          message.rect
        );
        if (!resolution.valid) {
          hideDropGhost();
          if (request.commit) setPreviewError(structureDragErrorMessage(resolution.reason));
          return;
        }
        const ghostKey = `${request.payload.type}:${request.payload.id}`;
        if (insertGhostNodeRef.current?.key !== ghostKey) {
          const created =
            request.payload.type === "component"
              ? createComponentNode(session.catalog, request.payload.id, t("defaults.newContent"))
              : saved?.node
                ? structuredClone(saved.node)
                : undefined;
          insertGhostNodeRef.current = created ? { key: ghostKey, node: created } : undefined;
        }
        if (insertGhostNodeRef.current) showDropGhost(resolution.target, insertGhostNodeRef.current.node);
        if (request.commit) {
          const insertion =
            request.payload.type === "component"
              ? session.insertComponent(request.payload.id, resolution.target)
              : session.insertSavedComponent(request.payload.id, resolution.target);
          void insertion.then((ok) => {
            // A successful commit triggers preview.setDocument, which clears the
            // ghost preview-side; failed commits need an explicit hide.
            ghostActiveRef.current = false;
            insertGhostNodeRef.current = undefined;
            if (!ok) hideDropGhost();
          });
        }
      } else if (message.type === "preview.moveIntent") {
        const request = moveRequestsRef.current.get(message.requestId);
        moveRequestsRef.current.delete(message.requestId);
        if (!request || !session.document || !session.catalog) return;
        const resolution = resolveMoveTarget(
          session.document,
          session.catalog,
          request.sourceNodeId,
          message.nodeId,
          { x: message.pointerX, y: message.pointerY },
          message.rect
        );
        if (!resolution.valid) {
          hideDropGhost();
          if (request.commit && resolution.reason !== "alreadyAtPosition")
            setPreviewError(structureDragErrorMessage(resolution.reason));
          return;
        }
        const sourceNode = findNode(session.document, request.sourceNodeId);
        if (sourceNode) showDropGhost(resolution.target, sourceNode, request.sourceNodeId);
        if (request.commit) {
          void session.moveNode(request.sourceNodeId, resolution.target).then((ok) => {
            ghostActiveRef.current = false;
            if (!ok) hideDropGhost();
          });
        }
      } else if (message.type === "preview.renderError") {
        setPreviewError(localizedMessage("errors.previewRuntime", { message: message.message }));
      } else if (message.type === "preview.contentOverflow") {
        const nextHeight = Math.ceil(message.contentHeight);
        setPreviewContentHeights((current) =>
          current[contentHeightKey] === nextHeight
            ? current
            : { ...current, [contentHeightKey]: nextHeight }
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [contentHeightKey, hideDropGhost, nodeContextTarget, openContextMenuAt, revealSelection, session, showDropGhost, t]);

  useEffect(() => {
    if (previewStatus !== "connecting") return;
    const timeout = window.setTimeout(() => {
      setPreviewStatus("error");
      setPreviewError(localizedMessage("errors.previewConnect"));
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
  }, [
    breakpoint,
    messageBase,
    nextRequestId,
    post,
    previewReady,
    session.document,
    session.revision,
    session.selectedNodeId
  ]);

  useLayoutEffect(() => {
    for (const request of pendingContextMenusRef.current.values()) window.clearTimeout(request.timeout);
    pendingContextMenusRef.current.clear();
    pendingDropsRef.current.clear();
    moveRequestsRef.current.clear();
    setSelectionBounds(undefined);
    hideDropGhost();
  }, [hideDropGhost, session.activePageId]);

  useEffect(() => {
    if (!session.activeInsertDrag && !session.activeNodeDragId) hideDropGhost();
  }, [hideDropGhost, session.activeInsertDrag, session.activeNodeDragId]);

  useEffect(() => {
    if (!previewReady || !initializedRef.current) return;
    post({ ...messageBase(nextRequestId("breakpoint")), type: "preview.setBreakpoint", breakpoint });
  }, [breakpoint, messageBase, nextRequestId, post, previewReady]);

  useEffect(() => {
    if (!previewReady) return;
    post({
      ...messageBase(nextRequestId("selection")),
      type: "preview.setSelection",
      ...(session.selectedNodeId ? { nodeId: session.selectedNodeId } : {})
    });
    if (!session.selectedNodeId) setSelectionBounds(undefined);
  }, [messageBase, nextRequestId, post, previewReady, session.selectedNodeId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.code === "Space" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
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
      setRevealingSelection(false);
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

  useEffect(
    () => () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  const startPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    setRevealingSelection(false);
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
    const point = screenToCanvas({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, stateRef.current);
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
  const screenRectStyle = (rect: PreviewRect): CSSProperties => {
    const screenRect = previewRectToScreen(rect, viewport);
    return {
      left: screenRect.x,
      top: screenRect.y,
      width: screenRect.width,
      height: screenRect.height
    };
  };
  return (
    <div className="canvas-panel">
      <div className="canvas-toolbar">
        <div className="canvas-toolbar__group" aria-label={t("canvas.responsiveBreakpoint")}>
          {(["desktop", "tablet", "mobile"] as const).map((value) => (
            <ToggleButton
              isSelected={breakpoint === value}
              key={value}
              onChange={(isSelected) => {
                if (!isSelected) return;
                setBreakpoint(value);
              }}
            >
              {t(BREAKPOINT_KEYS[value])}
            </ToggleButton>
          ))}
        </div>
        <div className="canvas-toolbar__group">
          <ActionButton onPress={() => centerAtScale(1)}>100%</ActionButton>
          <ActionButton onPress={fitPage}>{t("canvas.fitPage")}</ActionButton>
          <ActionButton isDisabled={!selectionRect} onPress={fitSelection}>
            {t("canvas.fitSelection")}
          </ActionButton>
          <span className="canvas-zoom">{Math.round(viewport.scale * 100)}%</span>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`canvas-viewport${panning ? " is-panning" : ""}`}
        role="application"
        aria-label={t("canvas.ariaLabel")}
        tabIndex={0}
        onContextMenu={(event) => {
          const onSelection =
            event.target instanceof Element && Boolean(event.target.closest(".canvas-selection"));
          if (onSelection && session.selectedNodeId) {
            openContextMenu(event, nodeContextTarget(session.selectedNodeId, selectionRect));
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          const point = screenToCanvas(
            { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
            stateRef.current
          );
          const menuPoint = { x: event.clientX, y: event.clientY };
          if (
            previewStatus !== "ready" ||
            point.x < 0 ||
            point.y < 0 ||
            point.x > contentSize.width ||
            point.y > contentSize.height
          ) {
            openContextMenuAt(menuPoint, canvasContextTarget(), event.currentTarget);
            return;
          }
          const requestId = nextRequestId("context_hit");
          const timeout = window.setTimeout(() => {
            const pending = pendingContextMenusRef.current.get(requestId);
            if (!pending) return;
            pendingContextMenusRef.current.delete(requestId);
            openContextMenuAt(pending.point, canvasContextTarget(), pending.returnFocusTo);
          }, 80);
          pendingContextMenusRef.current.set(requestId, {
            point: menuPoint,
            returnFocusTo: event.currentTarget,
            timeout
          });
          post({ ...messageBase(requestId), type: "preview.hitTest", x: point.x, y: point.y });
        }}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDragOver={(event) => {
          const isComponent = event.dataTransfer.types.includes(COMPONENT_DRAG_MIME);
          const isSaved = event.dataTransfer.types.includes(SAVED_COMPONENT_DRAG_MIME);
          const isNode = event.dataTransfer.types.includes(NODE_DRAG_MIME);
          if (!isComponent && !isSaved && !isNode) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = isNode ? "move" : "copy";
          const bounds = event.currentTarget.getBoundingClientRect();
          const point = screenToCanvas(
            { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
            stateRef.current
          );
          if (isNode) {
            if (previewStatus !== "ready" || performance.now() - lastMoveRequestRef.current < 70) return;
            const sourceNodeId = session.activeNodeDragId ?? event.dataTransfer.getData(NODE_DRAG_MIME);
            if (!sourceNodeId) return;
            lastMoveRequestRef.current = performance.now();
            const requestId = nextRequestId("move_preview");
            moveRequestsRef.current.set(requestId, { sourceNodeId, commit: false });
            post({ ...messageBase(requestId), type: "preview.resolveMove", sourceNodeId, x: point.x, y: point.y });
            return;
          }
          const payload =
            session.activeInsertDrag ??
            (isComponent
              ? { type: "component" as const, id: event.dataTransfer.getData(COMPONENT_DRAG_MIME) }
              : { type: "saved" as const, id: event.dataTransfer.getData(SAVED_COMPONENT_DRAG_MIME) });
          if (!payload.id || previewStatus !== "ready" || performance.now() - lastInsertRequestRef.current < 70) return;
          lastInsertRequestRef.current = performance.now();
          const requestId = nextRequestId("insert_preview");
          pendingDropsRef.current.set(requestId, { payload, commit: false });
          post({
            ...messageBase(requestId),
            type: "preview.resolveDrop",
            componentRef: payload.type === "component" ? payload.id : "SavedComponent",
            x: point.x,
            y: point.y
          });
        }}
        onDrop={(event) => {
          const payload =
            session.activeInsertDrag ??
            (event.dataTransfer.types.includes(COMPONENT_DRAG_MIME)
              ? { type: "component" as const, id: event.dataTransfer.getData(COMPONENT_DRAG_MIME) }
              : event.dataTransfer.types.includes(SAVED_COMPONENT_DRAG_MIME)
                ? { type: "saved" as const, id: event.dataTransfer.getData(SAVED_COMPONENT_DRAG_MIME) }
                : undefined);
          const sourceNodeId = session.activeNodeDragId ?? event.dataTransfer.getData(NODE_DRAG_MIME);
          if (!payload?.id && !sourceNodeId) return;
          event.preventDefault();
          if (previewStatus !== "ready") {
            setPreviewError(localizedMessage("errors.previewNotConnected"));
            return;
          }
          const bounds = event.currentTarget.getBoundingClientRect();
          const point = screenToCanvas(
            { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
            stateRef.current
          );
          if (sourceNodeId) {
            const requestId = nextRequestId("move_commit");
            moveRequestsRef.current.set(requestId, { sourceNodeId, commit: true });
            post({ ...messageBase(requestId), type: "preview.resolveMove", sourceNodeId, x: point.x, y: point.y });
            return;
          }
          const requestId = nextRequestId("drop");
          pendingDropsRef.current.set(requestId, { payload: payload!, commit: true });
          post({
            ...messageBase(requestId),
            type: "preview.resolveDrop",
            componentRef: payload!.type === "component" ? payload!.id : "SavedComponent",
            x: point.x,
            y: point.y
          });
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideDropGhost();
        }}
      >
        <div
          className={`canvas-surface${revealingSelection ? " is-revealing-selection" : ""}`}
          style={transformStyle}
          onTransitionEnd={(event) => {
            if (event.currentTarget === event.target && event.propertyName === "transform") {
              setRevealingSelection(false);
            }
          }}
        >
          <div className="canvas-artboard-label">
            {contentSize.width} × {contentSize.height}
          </div>
          <iframe
            ref={iframeRef}
            className="canvas-preview"
            title={t("canvas.previewTitle")}
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
        </div>
        {selectionRect ? (
          <div
            className={`canvas-selection${revealingSelection ? " is-revealing-selection" : ""}${
              session.activeNodeDragId === session.selectedNodeId ? " is-drag-source" : ""
            }`}
            style={screenRectStyle(selectionRect)}
            draggable={Boolean(session.selectedNodeId)}
            onDragStart={(event) => {
              if (!session.selectedNodeId || spacePressedRef.current) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(NODE_DRAG_MIME, session.selectedNodeId);
              event.dataTransfer.setData("text/plain", session.selectedNodeId);
              session.beginNodeDrag(session.selectedNodeId);
            }}
            onDragEnd={() => {
              session.endNodeDrag();
              hideDropGhost();
            }}
          >
            <span>
              {session.selectedNodeId} · {t("canvas.dragToMove")}
            </span>
          </div>
        ) : null}
        {previewStatus === "connecting" ? (
          <div className="canvas-connection" role="status">
            {t("canvas.connecting")}
          </div>
        ) : null}
        {previewError ? (
          <div className="canvas-error" role="alert">
            <span>{format(previewError)}</span>
            {previewStatus === "error" ? (
              <ActionButton
                onPress={() => {
                  setPreviewError(undefined);
                  setPreviewStatus("connecting");
                  setFrameAttempt((value) => value + 1);
                }}
              >
                {t("common.retry")}
              </ActionButton>
            ) : null}
          </div>
        ) : null}
        <div className="canvas-help">{t("canvas.help")}</div>
      </div>
    </div>
  );
}
