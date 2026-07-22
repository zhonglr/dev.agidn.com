import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { PanelRegistry } from "./registry.js";
import {
  closePanel,
  resizeSplit,
  setActivePanel,
  toggleMaximizedPanel,
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

function panelBody(panelId: string, panels: PanelRegistry): ReactNode {
  const contribution = panels.get(panelId);
  return contribution ? contribution.render() : <div className="wb-missing-panel">Panel unavailable: {panelId}</div>;
}

function SinglePanel({ node, layout, panels, onLayoutChange }: {
  node: PanelLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
}) {
  const panel = panels.get(node.panelId);
  return (
    <section className="wb-panel" data-panel-id={node.panelId}>
      <header className="wb-panel__header">
        <span>{panel?.title ?? node.panelId}</span>
        <button type="button" className="wb-panel__action" aria-label={`Maximize ${panel?.title ?? node.panelId}`} onClick={() => onLayoutChange(toggleMaximizedPanel(layout, node.panelId))}>□</button>
      </header>
      <div className="wb-panel__body">{panelBody(node.panelId, panels)}</div>
    </section>
  );
}

function TabGroup({ node, layout, panels, onLayoutChange }: {
  node: TabLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
}) {
  const active = panels.get(node.activePanelId);
  return (
    <section className="wb-panel wb-tabs" data-tab-group-id={node.id}>
      <div className="wb-tabs__bar" role="tablist" aria-label="Panel tabs">
        {node.panelIds.map((panelId) => {
          const panel = panels.get(panelId);
          const selected = panelId === node.activePanelId;
          return (
            <div className={`wb-tab${selected ? " is-active" : ""}`} key={panelId}>
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
    </section>
  );
}

function SplitView({ node, layout, panels, onLayoutChange }: {
  node: SplitLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
}) {
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
            <LayoutNode node={child} layout={layout} panels={panels} onLayoutChange={onLayoutChange} />
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

function LayoutNode({ node, layout, panels, onLayoutChange }: {
  node: WorkbenchLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
}) {
  if (node.type === "split") return <SplitView node={node} layout={layout} panels={panels} onLayoutChange={onLayoutChange} />;
  if (node.type === "tabs") return <TabGroup node={node} layout={layout} panels={panels} onLayoutChange={onLayoutChange} />;
  return <SinglePanel node={node} layout={layout} panels={panels} onLayoutChange={onLayoutChange} />;
}

export function Workbench({ layout, panels, onLayoutChange }: WorkbenchProps) {
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
  return <div className="wb-root"><LayoutNode node={layout.root} layout={layout} panels={panels} onLayoutChange={onLayoutChange} /></div>;
}
