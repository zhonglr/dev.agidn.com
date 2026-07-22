import {
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import type { PanelRegistry } from "./registry.js";
import {
  closePanel,
  dockPanel,
  resizeSplit,
  setActivePanel,
  toggleMaximizedPanel,
  type DockPosition,
  type PanelLayoutNode,
  type SplitLayoutNode,
  type TabLayoutNode,
  type WorkbenchLayoutNode,
  type WorkbenchLayoutState
} from "./layout.js";

export interface WorkbenchProps {
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
}

interface DockingProps {
  draggingPanelId: string | undefined;
  onPanelDragStart: (panelId: string, event: ReactDragEvent<HTMLElement>) => void;
  onPanelDragEnd: () => void;
  onPanelDock: (targetNodeId: string, position: DockPosition) => void;
}

function panelBody(panelId: string, panels: PanelRegistry): ReactNode {
  const contribution = panels.get(panelId);
  return contribution ? contribution.render() : <div className="wb-missing-panel">Panel unavailable: {panelId}</div>;
}

const DOCK_POSITIONS: readonly DockPosition[] = ["top", "right", "bottom", "left", "center"];

function DockOverlay({ targetNodeId, draggingPanelId, onPanelDock }: Pick<DockingProps, "draggingPanelId" | "onPanelDock"> & { targetNodeId: string }) {
  if (!draggingPanelId) return null;
  return (
    <div className="wb-dock-overlay" aria-label="Dock panel">
      {DOCK_POSITIONS.map((position) => (
        <button
          type="button"
          className={`wb-dock-target wb-dock-target--${position}`}
          aria-label={`Dock ${draggingPanelId} ${position}`}
          tabIndex={-1}
          key={position}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPanelDock(targetNodeId, position);
          }}
        >
          <span>{position === "center" ? "Tab" : position}</span>
        </button>
      ))}
    </div>
  );
}

function SinglePanel({ node, layout, panels, onLayoutChange, draggingPanelId, onPanelDragStart, onPanelDragEnd, onPanelDock }: {
  node: PanelLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
} & DockingProps) {
  const panel = panels.get(node.panelId);
  const draggable = Boolean(panel?.canMove && panel.canDock);
  return (
    <section className="wb-panel" data-panel-id={node.panelId}>
      <header className="wb-panel__header">
        <span
          className={draggable ? "wb-panel__drag-handle" : undefined}
          draggable={draggable}
          onDragStart={(event) => onPanelDragStart(node.panelId, event)}
          onDragEnd={onPanelDragEnd}
        >{panel?.title ?? node.panelId}</span>
        <button type="button" className="wb-panel__action" aria-label={`Maximize ${panel?.title ?? node.panelId}`} onClick={() => onLayoutChange(toggleMaximizedPanel(layout, node.panelId))}>□</button>
      </header>
      <div className="wb-panel__body">{panelBody(node.panelId, panels)}</div>
      <DockOverlay targetNodeId={node.id} draggingPanelId={draggingPanelId} onPanelDock={onPanelDock} />
    </section>
  );
}

function TabGroup({ node, layout, panels, onLayoutChange, draggingPanelId, onPanelDragStart, onPanelDragEnd, onPanelDock }: {
  node: TabLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
} & DockingProps) {
  const active = panels.get(node.activePanelId);
  return (
    <section className="wb-panel wb-tabs" data-tab-group-id={node.id}>
      <div className="wb-tabs__bar" role="tablist" aria-label="Panel tabs">
        {node.panelIds.map((panelId) => {
          const panel = panels.get(panelId);
          const selected = panelId === node.activePanelId;
          const draggable = Boolean(panel?.canMove && panel.canDock);
          return (
            <div
              className={`wb-tab${selected ? " is-active" : ""}${draggable ? " is-draggable" : ""}`}
              draggable={draggable}
              key={panelId}
              onDragStart={(event) => onPanelDragStart(panelId, event)}
              onDragEnd={onPanelDragEnd}
            >
              <button
                type="button"
                className="wb-tab__select"
                role="tab"
                aria-selected={selected}
                onClick={() => onLayoutChange(setActivePanel(layout, node.id, panelId))}
              >
                {panel?.title ?? panelId}
              </button>
              {panel?.canClose ? (
                <button type="button" className="wb-tab__close" aria-label={`Close ${panel.title}`} onClick={() => onLayoutChange(closePanel(layout, panelId))}>×</button>
              ) : null}
            </div>
          );
        })}
        <span className="wb-tabs__spacer" />
        <button type="button" className="wb-panel__action" aria-label={`Maximize ${active?.title ?? node.activePanelId}`} onClick={() => onLayoutChange(toggleMaximizedPanel(layout, node.activePanelId))}>□</button>
      </div>
      <div className="wb-panel__body" role="tabpanel">{panelBody(node.activePanelId, panels)}</div>
      <DockOverlay targetNodeId={node.id} draggingPanelId={draggingPanelId} onPanelDock={onPanelDock} />
    </section>
  );
}

function SplitView({ node, layout, panels, onLayoutChange, ...docking }: {
  node: SplitLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
} & DockingProps) {
  const horizontal = node.direction === "horizontal";

  const resizeByKeyboard = (index: number, event: KeyboardEvent<HTMLDivElement>): void => {
    const forward = horizontal ? event.key === "ArrowRight" : event.key === "ArrowDown";
    const backward = horizontal ? event.key === "ArrowLeft" : event.key === "ArrowUp";
    if (!forward && !backward) return;
    event.preventDefault();
    onLayoutChange(resizeSplit(layout, node.id, index, forward ? 0.02 : -0.02));
  };

  const startPointerResize = (index: number, event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const separator = event.currentTarget;
    const container = separator.parentElement;
    if (!container) return;
    separator.setPointerCapture(event.pointerId);
    const start = horizontal ? event.clientX : event.clientY;
    const length = horizontal ? container.getBoundingClientRect().width : container.getBoundingClientRect().height;
    const initialLayout = layout;
    const onMove = (moveEvent: PointerEvent): void => {
      const current = horizontal ? moveEvent.clientX : moveEvent.clientY;
      onLayoutChange(resizeSplit(initialLayout, node.id, index, (current - start) / Math.max(length, 1)));
    };
    const onEnd = (): void => {
      separator.removeEventListener("pointermove", onMove);
      separator.removeEventListener("pointerup", onEnd);
      separator.removeEventListener("pointercancel", onEnd);
    };
    separator.addEventListener("pointermove", onMove);
    separator.addEventListener("pointerup", onEnd);
    separator.addEventListener("pointercancel", onEnd);
  };

  return (
    <div className={`wb-split wb-split--${node.direction}`} data-split-id={node.id}>
      {node.children.flatMap((child, index) => {
        const size = node.sizes[index] ?? 1 / node.children.length;
        const childStyle = { "--wb-split-size": size } as CSSProperties;
        const childElement = (
          <div className="wb-split__child" style={childStyle} key={child.id}>
            <LayoutNode node={child} layout={layout} panels={panels} onLayoutChange={onLayoutChange} {...docking} />
          </div>
        );
        if (index === node.children.length - 1) return [childElement];
        const separator = (
          <div
            className="wb-separator"
            role="separator"
            aria-orientation={horizontal ? "vertical" : "horizontal"}
            aria-label="Resize panels"
            tabIndex={0}
            key={`${node.id}:separator:${index}`}
            onKeyDown={(event) => resizeByKeyboard(index, event)}
            onPointerDown={(event) => startPointerResize(index, event)}
          />
        );
        return [childElement, separator];
      })}
    </div>
  );
}

function LayoutNode({ node, layout, panels, onLayoutChange, ...docking }: {
  node: WorkbenchLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
} & DockingProps) {
  if (node.type === "split") return <SplitView node={node} layout={layout} panels={panels} onLayoutChange={onLayoutChange} {...docking} />;
  if (node.type === "tabs") return <TabGroup node={node} layout={layout} panels={panels} onLayoutChange={onLayoutChange} {...docking} />;
  return <SinglePanel node={node} layout={layout} panels={panels} onLayoutChange={onLayoutChange} {...docking} />;
}

export function Workbench({ layout, panels, onLayoutChange }: WorkbenchProps) {
  const [draggingPanelId, setDraggingPanelId] = useState<string>();
  const onPanelDragStart = (panelId: string, event: ReactDragEvent<HTMLElement>): void => {
    setDraggingPanelId(panelId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-agidn-panel", panelId);
    event.dataTransfer.setData("text/plain", panelId);
  };
  const onPanelDragEnd = (): void => setDraggingPanelId(undefined);
  const onPanelDock = (targetNodeId: string, position: DockPosition): void => {
    if (!draggingPanelId) return;
    onLayoutChange(dockPanel(layout, draggingPanelId, targetNodeId, position));
    setDraggingPanelId(undefined);
  };

  if (layout.maximizedPanelId) {
    return (
      <div className="wb-root wb-root--maximized">
        <section className="wb-panel" data-panel-id={layout.maximizedPanelId}>
          <header className="wb-panel__header">
            <span>{panels.get(layout.maximizedPanelId)?.title ?? layout.maximizedPanelId}</span>
            <button type="button" className="wb-panel__action" aria-label="Restore workbench layout" onClick={() => onLayoutChange(toggleMaximizedPanel(layout, layout.maximizedPanelId!))}>⧉</button>
          </header>
          <div className="wb-panel__body">{panelBody(layout.maximizedPanelId, panels)}</div>
        </section>
      </div>
    );
  }
  return (
    <div className={`wb-root${draggingPanelId ? " is-docking" : ""}`}>
      <LayoutNode
        node={layout.root}
        layout={layout}
        panels={panels}
        onLayoutChange={onLayoutChange}
        draggingPanelId={draggingPanelId}
        onPanelDragStart={onPanelDragStart}
        onPanelDragEnd={onPanelDragEnd}
        onPanelDock={onPanelDock}
      />
    </div>
  );
}
