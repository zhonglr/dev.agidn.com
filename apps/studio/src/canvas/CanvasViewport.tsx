import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
import { findNode, type PageNode } from "@agidn/document-schema";
import { PageRenderer } from "@agidn/react-renderer";
import { useStudioSession } from "../studio-session.js";
import type { ContextMenuTarget } from "../context-menu/registry.js";
import {
  createNodesForPayload,
  insertPayloadKey,
  insertSourcesForPayload,
  type InsertDragPayload
} from "../insert-source.js";
import { LAYOUT_KINDS } from "../layout-node-factory.js";
import {
  COMPONENT_DRAG_MIME,
  LAYOUT_DRAG_MIME,
  NODE_DRAG_MIME,
  PATTERN_DRAG_MIME,
  resolveInsertSourcesTarget,
  resolveMoveTarget,
  type MoveTarget
} from "../structure-drag.js";
import {
  useI18n,
  type MessageDescriptor,
  type MessageKey
} from "../i18n.js";
import { structureDragErrorMessage } from "../i18n/structure-drag.js";
import { message as localizedMessage } from "../i18n/types.js";
import {
  ActionButton,
  ToggleButton,
  useContextMenu
} from "../components/ui/index.js";
import {
  centerRectInViewportIfNeeded,
  previewRectToScreen,
  zoomAtScreenPoint
} from "./coordinates.js";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary.js";
import {
  applyDropGhost,
  DROP_GHOST_ID_PREFIX,
  sameDropGhost,
  type DropGhostState
} from "./drop-ghost.js";
import { canvasComponentRegistry } from "./runtime-components.js";
import "./canvas-content.css";

type Breakpoint = "mobile" | "tablet" | "desktop";

interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionBounds {
  nodeId: string;
  rect: CanvasRect;
}

interface HitResult {
  nodeId: string;
  rect: CanvasRect;
}

const SIZE_BY_BREAKPOINT: Record<
  Breakpoint,
  { width: number; height: number }
> = {
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

function insertPayloadFromDataTransfer(
  dataTransfer: DataTransfer,
  active: InsertDragPayload | undefined
): InsertDragPayload | undefined {
  if (active) return active;
  if (dataTransfer.types.includes(COMPONENT_DRAG_MIME)) {
    const id = dataTransfer.getData(COMPONENT_DRAG_MIME);
    return id ? { type: "component", id } : undefined;
  }
  if (dataTransfer.types.includes(LAYOUT_DRAG_MIME)) {
    const id = dataTransfer.getData(LAYOUT_DRAG_MIME);
    return LAYOUT_KINDS.includes(
      id as (typeof LAYOUT_KINDS)[number]
    )
      ? {
          type: "layout",
          id: id as (typeof LAYOUT_KINDS)[number]
        }
      : undefined;
  }
  if (dataTransfer.types.includes(PATTERN_DRAG_MIME)) {
    const id = dataTransfer.getData(PATTERN_DRAG_MIME);
    return id ? { type: "pattern", id } : undefined;
  }
  return undefined;
}

function elementForNode(
  root: HTMLElement,
  nodeId: string
): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>("[data-node-id]")].find(
    (element) => element.dataset.nodeId === nodeId
  );
}

export function CanvasViewport() {
  const session = useStudioSession();
  const { format, t } = useI18n();
  const { openContextMenu, openContextMenuAt } = useContextMenu();
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const moveSourceStyleRef = useRef<HTMLStyleElement>(null);
  const stateRef = useRef<ViewportState>({
    scale: 0.68,
    offsetX: 56,
    offsetY: 46
  });
  const pendingRef = useRef<ViewportState | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const panningRef = useRef<
    | {
        pointerId: number;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
      }
    | undefined
  >(undefined);
  const spacePressedRef = useRef(false);
  const lastMoveResolveRef = useRef(0);
  const lastInsertResolveRef = useRef(0);
  const previousSelectionRef = useRef<string | undefined>(undefined);
  const insertGhostNodeRef = useRef<
    | {
        key: string;
        nodes: PageNode[];
      }
    | undefined
  >(undefined);
  const [viewport, setViewport] = useState(stateRef.current);
  const [breakpoint, setBreakpoint] =
    useState<Breakpoint>("desktop");
  const [panning, setPanning] = useState(false);
  const [revealingSelection, setRevealingSelection] =
    useState(false);
  const [selectionBounds, setSelectionBounds] =
    useState<SelectionBounds | undefined>(undefined);
  const [canvasError, setCanvasError] =
    useState<MessageDescriptor | undefined>(undefined);
  const [contentHeights, setContentHeights] = useState<
    Record<string, number>
  >({});
  const [dropGhost, setDropGhost] = useState<
    DropGhostState | undefined
  >(undefined);
  const dropGhostRef = useRef(dropGhost);
  dropGhostRef.current = dropGhost;

  const baseSize = SIZE_BY_BREAKPOINT[breakpoint];
  const contentHeightKey = `${
    session.activePageId ?? session.document?.id ?? "loading"
  }:${breakpoint}`;
  const measuredHeight = contentHeights[contentHeightKey] ?? 0;
  const contentSize = {
    width: baseSize.width,
    height: Math.max(baseSize.height, measuredHeight)
  };
  const selectionRect =
    selectionBounds &&
    selectionBounds.nodeId === session.selectedNodeId
      ? selectionBounds.rect
      : undefined;

  const renderedDocument = useMemo(() => {
    if (!session.document) return undefined;
    return dropGhost
      ? applyDropGhost(session.document, dropGhost)
      : session.document;
  }, [dropGhost, session.document]);

  const showDropGhost = useCallback(
    (
      target: MoveTarget,
      nodes: readonly PageNode[],
      moveSourceNodeId?: string
    ): void => {
      const next: DropGhostState = {
        target,
        nodes: [...nodes],
        ...(moveSourceNodeId ? { moveSourceNodeId } : {})
      };
      setDropGhost((current) =>
        sameDropGhost(current, next) ? current : next
      );
    },
    []
  );

  const hideDropGhost = useCallback((): void => {
    insertGhostNodeRef.current = undefined;
    setDropGhost(undefined);
  }, []);

  const queueViewport = useCallback(
    (update: (current: ViewportState) => ViewportState) => {
      pendingRef.current = update(
        pendingRef.current ?? stateRef.current
      );
      if (frameRef.current !== undefined) return;
      frameRef.current = requestAnimationFrame(() => {
        const next = pendingRef.current;
        pendingRef.current = undefined;
        frameRef.current = undefined;
        if (!next) return;
        stateRef.current = next;
        setViewport(next);
      });
    },
    []
  );

  const centerAtScale = useCallback(
    (scale: number) => {
      const element = viewportRef.current;
      if (!element) return;
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, scale)
      );
      queueViewport(() => ({
        scale: nextScale,
        offsetX:
          (element.clientWidth - contentSize.width * nextScale) / 2,
        offsetY: Math.max(
          28,
          (element.clientHeight -
            contentSize.height * nextScale) /
            2
        )
      }));
    },
    [contentSize.height, contentSize.width, queueViewport]
  );

  const fitPage = useCallback(() => {
    const element = viewportRef.current;
    if (!element) return;
    centerAtScale(
      Math.min(
        (element.clientWidth - 88) / contentSize.width,
        (element.clientHeight - 72) / contentSize.height,
        1
      )
    );
  }, [centerAtScale, contentSize.height, contentSize.width]);

  const fitRect = useCallback(
    (rect: CanvasRect) => {
      const element = viewportRef.current;
      if (!element || rect.width === 0 || rect.height === 0) return;
      const scale = Math.min(
        MAX_SCALE,
        Math.max(
          MIN_SCALE,
          Math.min(
            (element.clientWidth - 160) / rect.width,
            (element.clientHeight - 130) / rect.height,
            1.5
          )
        )
      );
      queueViewport(() => ({
        scale,
        offsetX:
          (element.clientWidth - rect.width * scale) / 2 -
          rect.x * scale,
        offsetY:
          (element.clientHeight - rect.height * scale) / 2 -
          rect.y * scale
      }));
    },
    [queueViewport]
  );

  const fitSelection = useCallback(() => {
    if (selectionRect) fitRect(selectionRect);
  }, [fitRect, selectionRect]);

  const revealSelection = useCallback(
    (rect: CanvasRect) => {
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

  const rectForElement = useCallback(
    (element: Element): CanvasRect | undefined => {
      const preview = previewRef.current;
      if (!preview) return undefined;
      const rootRect = preview.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const scale = stateRef.current.scale;
      return {
        x: (rect.left - rootRect.left) / scale,
        y: (rect.top - rootRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale
      };
    },
    []
  );

  const hitTest = useCallback(
    (clientX: number, clientY: number): HitResult | undefined => {
      const preview = previewRef.current;
      if (!preview) return undefined;
      const previewBounds = preview.getBoundingClientRect();
      if (
        clientX < previewBounds.left ||
        clientY < previewBounds.top ||
        clientX > previewBounds.right ||
        clientY > previewBounds.bottom
      ) {
        return undefined;
      }

      const ghostElements = [
        ...preview.querySelectorAll<HTMLElement>(
          `[data-node-id^="${DROP_GHOST_ID_PREFIX}"]`
        )
      ];
      const ghostDisplays = ghostElements.map((element) => ({
        element,
        value: element.style.getPropertyValue("display"),
        priority: element.style.getPropertyPriority("display")
      }));
      const sourceSheet = moveSourceStyleRef.current?.sheet;
      const sourceSheetDisabled = sourceSheet?.disabled;
      ghostElements.forEach((element) =>
        element.style.setProperty("display", "none", "important")
      );
      if (sourceSheet) sourceSheet.disabled = true;

      try {
        const hit = document
          .elementFromPoint(clientX, clientY)
          ?.closest<HTMLElement>("[data-node-id]");
        if (!hit || !preview.contains(hit) || !hit.dataset.nodeId) {
          return {
            nodeId: session.document?.id ?? "",
            rect: {
              x: 0,
              y: 0,
              width: contentSize.width,
              height: contentSize.height
            }
          };
        }
        const rect = rectForElement(hit);
        return rect ? { nodeId: hit.dataset.nodeId, rect } : undefined;
      } finally {
        if (
          sourceSheet &&
          sourceSheetDisabled !== undefined
        ) {
          sourceSheet.disabled = sourceSheetDisabled;
        }
        ghostDisplays.forEach(
          ({ element, value, priority }) => {
            if (value) {
              element.style.setProperty(
                "display",
                value,
                priority
              );
            } else {
              element.style.removeProperty("display");
            }
          }
        );
      }
    },
    [
      contentSize.height,
      contentSize.width,
      rectForElement,
      session.document?.id
    ]
  );

  const pointerInCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const preview = previewRef.current;
      if (!preview) return { x: 0, y: 0 };
      const bounds = preview.getBoundingClientRect();
      const scale = stateRef.current.scale;
      return {
        x: (clientX - bounds.left) / scale,
        y: (clientY - bounds.top) / scale
      };
    },
    []
  );

  const resolveInsert = useCallback(
    (
      payload: InsertDragPayload,
      clientX: number,
      clientY: number,
      commit: boolean
    ): void => {
      if (!session.document || !session.catalog) return;
      const hit = hitTest(clientX, clientY);
      if (!hit?.nodeId) return;
      const resolution = resolveInsertSourcesTarget(
        session.document,
        session.catalog,
        insertSourcesForPayload(session.catalog, payload),
        hit.nodeId,
        pointerInCanvas(clientX, clientY),
        hit.rect
      );
      if (!resolution.valid) {
        hideDropGhost();
        if (commit) {
          setCanvasError(
            structureDragErrorMessage(resolution.reason)
          );
        }
        return;
      }
      const ghostKey = insertPayloadKey(payload);
      if (insertGhostNodeRef.current?.key !== ghostKey) {
        const nodes = createNodesForPayload(
          session.catalog,
          payload,
          t("defaults.newContent")
        );
        insertGhostNodeRef.current = nodes.length
          ? { key: ghostKey, nodes }
          : undefined;
      }
      if (insertGhostNodeRef.current) {
        showDropGhost(
          resolution.target,
          insertGhostNodeRef.current.nodes
        );
      }
      if (!commit) return;
      void session
        .insertNode(payload, resolution.target)
        .then((accepted) => {
          hideDropGhost();
          if (accepted) setCanvasError(undefined);
        });
    },
    [
      hideDropGhost,
      hitTest,
      pointerInCanvas,
      session,
      showDropGhost,
      t
    ]
  );

  const resolveMove = useCallback(
    (
      sourceNodeId: string,
      clientX: number,
      clientY: number,
      commit: boolean
    ): void => {
      if (!session.document || !session.catalog) return;
      const hit = hitTest(clientX, clientY);
      if (!hit?.nodeId) return;
      const resolution = resolveMoveTarget(
        session.document,
        session.catalog,
        sourceNodeId,
        hit.nodeId,
        pointerInCanvas(clientX, clientY),
        hit.rect
      );
      if (!resolution.valid) {
        hideDropGhost();
        if (
          commit &&
          resolution.reason !== "alreadyAtPosition"
        ) {
          setCanvasError(
            structureDragErrorMessage(resolution.reason)
          );
        }
        return;
      }
      const sourceNode = findNode(session.document, sourceNodeId);
      if (sourceNode) {
        showDropGhost(
          resolution.target,
          [sourceNode],
          sourceNodeId
        );
      }
      if (!commit) return;
      void session
        .moveNode(sourceNodeId, resolution.target)
        .then((accepted) => {
          hideDropGhost();
          if (accepted) setCanvasError(undefined);
        });
    },
    [
      hideDropGhost,
      hitTest,
      pointerInCanvas,
      session,
      showDropGhost
    ]
  );

  const nodeContextTarget = useCallback(
    (nodeId: string, rect?: CanvasRect): ContextMenuTarget => {
      const node = session.document
        ? findNode(session.document, nodeId)
        : undefined;
      const label =
        node?.name ??
        (node?.kind === "component"
          ? node.componentRef
          : node?.role ?? node?.layout) ??
        nodeId;
      return {
        type: "node",
        id: nodeId,
        label,
        metadata: { nodeKind: node?.kind, surface: "canvas" },
        capabilities: {
          select: { execute: () => session.selectNode(nodeId) },
          fitPage: { execute: fitPage },
          fitSelection: {
            execute: () =>
              rect ? fitRect(rect) : fitSelection(),
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
        undo: {
          execute: session.undo,
          isDisabled: !session.canUndo
        },
        redo: {
          execute: session.redo,
          isDisabled: !session.canRedo
        }
      }
    }),
    [fitPage, session, t]
  );

  useLayoutEffect(() => {
    const preview = previewRef.current;
    const page = preview?.querySelector<HTMLElement>(".agidn-page");
    if (!preview || !page) return;
    const update = (reveal = false): void => {
      const nextHeight = Math.ceil(
        Math.max(baseSize.height, page.scrollHeight)
      );
      setContentHeights((current) =>
        current[contentHeightKey] === nextHeight
          ? current
          : { ...current, [contentHeightKey]: nextHeight }
      );
      if (
        dropGhostRef.current ||
        session.activeInsertDrag ||
        session.activeNodeDragId
      ) {
        return;
      }
      const nodeId = session.selectedNodeId;
      if (!nodeId) {
        setSelectionBounds(undefined);
        return;
      }
      const element = elementForNode(preview, nodeId);
      const rect = element ? rectForElement(element) : undefined;
      if (!rect) {
        setSelectionBounds(undefined);
        return;
      }
      setSelectionBounds({ nodeId, rect });
      if (reveal) revealSelection(rect);
    };
    const reveal =
      Boolean(session.selectedNodeId) &&
      previousSelectionRef.current !== session.selectedNodeId;
    previousSelectionRef.current = session.selectedNodeId;
    const frame = requestAnimationFrame(() => update(reveal));
    const observer = new ResizeObserver(() => update(false));
    observer.observe(page);
    const selected = session.selectedNodeId
      ? elementForNode(preview, session.selectedNodeId)
      : undefined;
    if (selected) observer.observe(selected);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [
    baseSize.height,
    breakpoint,
    contentHeightKey,
    rectForElement,
    renderedDocument,
    revealSelection,
    session.activeInsertDrag,
    session.activeNodeDragId,
    session.selectedNodeId
  ]);

  useLayoutEffect(() => {
    hideDropGhost();
    setSelectionBounds(undefined);
    previousSelectionRef.current = undefined;
  }, [hideDropGhost, session.activePageId]);

  useEffect(() => {
    if (
      !session.activeInsertDrag &&
      !session.activeNodeDragId
    ) {
      hideDropGhost();
    }
  }, [
    hideDropGhost,
    session.activeInsertDrag,
    session.activeNodeDragId
  ]);

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
        const point = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top
        };
        queueViewport((current) =>
          zoomAtScreenPoint(
            current,
            point,
            Math.min(
              MAX_SCALE,
              Math.max(
                MIN_SCALE,
                current.scale * Math.exp(-event.deltaY * 0.002)
              )
            )
          )
        );
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
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    []
  );

  const startPan = (
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    setRevealingSelection(false);
    if (
      event.button === 1 ||
      (event.button === 0 && spacePressedRef.current)
    ) {
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
    if (
      event.button !== 0 ||
      !session.document ||
      (event.target instanceof Element &&
        Boolean(event.target.closest(".canvas-selection")))
    ) {
      return;
    }
    const hit = hitTest(event.clientX, event.clientY);
    if (
      hit?.nodeId &&
      hit.nodeId !== session.document.id
    ) {
      session.selectNode(hit.nodeId);
      setSelectionBounds({
        nodeId: hit.nodeId,
        rect: hit.rect
      });
    } else {
      session.selectNode();
    }
  };

  const movePan = (
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    const pan = panningRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    queueViewport((current) => ({
      ...current,
      offsetX: pan.originX + event.clientX - pan.startX,
      offsetY: pan.originY + event.clientY - pan.startY
    }));
  };

  const endPan = (
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
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

  const screenRectStyle = (rect: CanvasRect): CSSProperties => {
    const screenRect = previewRectToScreen(rect, viewport);
    return {
      left: screenRect.x,
      top: screenRect.y,
      width: screenRect.width,
      height: screenRect.height
    };
  };

  const moveSourceRule = dropGhost?.moveSourceNodeId
    ? `.canvas-preview [data-node-id=${JSON.stringify(
        dropGhost.moveSourceNodeId
      )}]{display:none!important}`
    : "";

  return (
    <div className="canvas-panel">
      <div className="canvas-toolbar">
        <div
          className="canvas-toolbar__group"
          aria-label={t("canvas.responsiveBreakpoint")}
        >
          {(["desktop", "tablet", "mobile"] as const).map(
            (value) => (
              <ToggleButton
                isSelected={breakpoint === value}
                key={value}
                onChange={(isSelected) => {
                  if (isSelected) setBreakpoint(value);
                }}
              >
                {t(BREAKPOINT_KEYS[value])}
              </ToggleButton>
            )
          )}
        </div>
        <div className="canvas-toolbar__group">
          <ActionButton onPress={() => centerAtScale(1)}>
            100%
          </ActionButton>
          <ActionButton onPress={fitPage}>
            {t("canvas.fitPage")}
          </ActionButton>
          <ActionButton
            isDisabled={!selectionRect}
            onPress={fitSelection}
          >
            {t("canvas.fitSelection")}
          </ActionButton>
          <span className="canvas-zoom">
            {Math.round(viewport.scale * 100)}%
          </span>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`canvas-viewport${
          panning ? " is-panning" : ""
        }`}
        role="application"
        aria-label={t("canvas.ariaLabel")}
        tabIndex={0}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (
            event.target instanceof Element &&
            event.target.closest(".canvas-selection") &&
            session.selectedNodeId
          ) {
            openContextMenu(
              event,
              nodeContextTarget(
                session.selectedNodeId,
                selectionRect
              )
            );
            return;
          }
          const hit = hitTest(event.clientX, event.clientY);
          if (
            hit?.nodeId &&
            hit.nodeId !== session.document?.id
          ) {
            session.selectNode(hit.nodeId);
            openContextMenuAt(
              { x: event.clientX, y: event.clientY },
              nodeContextTarget(hit.nodeId, hit.rect),
              event.currentTarget
            );
          } else {
            openContextMenuAt(
              { x: event.clientX, y: event.clientY },
              canvasContextTarget(),
              event.currentTarget
            );
          }
        }}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDragOver={(event) => {
          const isComponent =
            event.dataTransfer.types.includes(COMPONENT_DRAG_MIME);
          const isLayout =
            event.dataTransfer.types.includes(LAYOUT_DRAG_MIME);
          const isPattern =
            event.dataTransfer.types.includes(PATTERN_DRAG_MIME);
          const isNode =
            event.dataTransfer.types.includes(NODE_DRAG_MIME);
          if (
            !isComponent &&
            !isLayout &&
            !isPattern &&
            !isNode
          ) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = isNode ? "move" : "copy";
          if (isNode) {
            if (
              performance.now() - lastMoveResolveRef.current <
              45
            ) {
              return;
            }
            const sourceNodeId =
              session.activeNodeDragId ??
              event.dataTransfer.getData(NODE_DRAG_MIME);
            if (!sourceNodeId) return;
            lastMoveResolveRef.current = performance.now();
            resolveMove(
              sourceNodeId,
              event.clientX,
              event.clientY,
              false
            );
            return;
          }
          if (
            performance.now() - lastInsertResolveRef.current <
            45
          ) {
            return;
          }
          const payload = insertPayloadFromDataTransfer(
            event.dataTransfer,
            session.activeInsertDrag
          );
          if (!payload) return;
          lastInsertResolveRef.current = performance.now();
          resolveInsert(
            payload,
            event.clientX,
            event.clientY,
            false
          );
        }}
        onDrop={(event) => {
          const payload = insertPayloadFromDataTransfer(
            event.dataTransfer,
            session.activeInsertDrag
          );
          const sourceNodeId =
            session.activeNodeDragId ??
            event.dataTransfer.getData(NODE_DRAG_MIME);
          if (!payload && !sourceNodeId) return;
          event.preventDefault();
          if (sourceNodeId) {
            resolveMove(
              sourceNodeId,
              event.clientX,
              event.clientY,
              true
            );
          } else if (payload) {
            resolveInsert(
              payload,
              event.clientX,
              event.clientY,
              true
            );
          }
        }}
        onDragLeave={(event) => {
          if (
            !event.currentTarget.contains(
              event.relatedTarget as Node | null
            )
          ) {
            hideDropGhost();
          }
        }}
      >
        <div
          className={`canvas-surface${
            revealingSelection
              ? " is-revealing-selection"
              : ""
          }`}
          style={transformStyle}
          onTransitionEnd={(event) => {
            if (
              event.currentTarget === event.target &&
              event.propertyName === "transform"
            ) {
              setRevealingSelection(false);
            }
          }}
        >
          <div className="canvas-artboard-label">
            {contentSize.width} × {contentSize.height}
          </div>
          <div
            ref={previewRef}
            className="canvas-preview"
            data-breakpoint={breakpoint}
            style={{
              width: contentSize.width,
              minHeight: contentSize.height
            }}
            onClickCapture={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onSubmitCapture={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <style ref={moveSourceStyleRef}>
              {moveSourceRule}
            </style>
            {renderedDocument && session.catalog ? (
              <CanvasErrorBoundary
                resetKey={`${renderedDocument.id}:${session.revision}`}
                onError={(error) =>
                  setCanvasError(
                    localizedMessage("errors.previewRuntime", {
                      message: error.message
                    })
                  )
                }
              >
                <PageRenderer
                  document={renderedDocument}
                  tokens={session.catalog.tokens}
                  components={canvasComponentRegistry}
                  composites={session.catalog.assets.composites}
                />
              </CanvasErrorBoundary>
            ) : null}
          </div>
        </div>
        {selectionRect ? (
          <div
            className={`canvas-selection${
              revealingSelection
                ? " is-revealing-selection"
                : ""
            }${
              session.activeNodeDragId === session.selectedNodeId
                ? " is-drag-source"
                : ""
            }`}
            style={screenRectStyle(selectionRect)}
            draggable={Boolean(session.selectedNodeId)}
            onDragStart={(event) => {
              if (
                !session.selectedNodeId ||
                spacePressedRef.current
              ) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(
                NODE_DRAG_MIME,
                session.selectedNodeId
              );
              event.dataTransfer.setData(
                "text/plain",
                session.selectedNodeId
              );
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
        {canvasError ? (
          <div className="canvas-error" role="alert">
            <span>{format(canvasError)}</span>
            <ActionButton
              onPress={() => setCanvasError(undefined)}
            >
              {t("common.close")}
            </ActionButton>
          </div>
        ) : null}
        <div className="canvas-help">{t("canvas.help")}</div>
      </div>
    </div>
  );
}
