import {
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import type { PanelRegistry } from "./registry.js";
import { Tooltip } from "./tooltip.js";
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
  messages?: Partial<WorkbenchMessages>;
  renderToggleButton?: WorkbenchToggleButtonRenderer;
}

export interface WorkbenchToggleButtonProps {
  children: ReactNode;
  isSelected: boolean;
  "aria-controls": string;
  "aria-label": string;
  onChange: (isSelected: boolean) => void;
}

export type WorkbenchToggleButtonRenderer = (props: WorkbenchToggleButtonProps) => ReactNode;

export interface WorkbenchMessages {
  panelUnavailable: (panelId: string) => string;
  dockPanel: string;
  dockPosition: (panelTitle: string, position: DockPosition) => string;
  maximizePanel: string;
  maximizePanelLabel: (panelTitle: string) => string;
  panelTabs: string;
  closePanel: (panelTitle: string) => string;
  resizePanels: string;
  restoreLayout: string;
  restoreLayoutLabel: string;
  dockingHint: string;
}

const DEFAULT_MESSAGES: WorkbenchMessages = {
  panelUnavailable: (panelId) => `Panel unavailable: ${panelId}`,
  dockPanel: "Dock panel",
  dockPosition: (panelTitle, position) => `Dock ${panelTitle} ${position}`,
  maximizePanel: "Maximize panel",
  maximizePanelLabel: (panelTitle) => `Maximize ${panelTitle}`,
  panelTabs: "Panel tabs",
  closePanel: (panelTitle) => `Close ${panelTitle}`,
  resizePanels: "Resize panels",
  restoreLayout: "Restore layout",
  restoreLayoutLabel: "Restore workbench layout",
  dockingHint: "Move over a panel, then choose its docking position"
};

interface DockingProps {
  messages: WorkbenchMessages;
  draggingPanelId: string | undefined;
  activeDockTargetId: string | undefined;
  renderToggleButton: WorkbenchToggleButtonRenderer | undefined;
  onPanelDragStart: (panelId: string, event: ReactDragEvent<HTMLElement>) => void;
  onPanelDragEnd: () => void;
  onDockTargetChange: (targetNodeId?: string) => void;
  onPanelDock: (targetNodeId: string, position: DockPosition) => void;
}

function panelBody(panelId: string, panels: PanelRegistry, messages: WorkbenchMessages): ReactNode {
  const contribution = panels.get(panelId);
  return contribution ? (
    contribution.render()
  ) : (
    <div className="wb-missing-panel">{messages.panelUnavailable(panelId)}</div>
  );
}

const DOCK_POSITIONS: readonly DockPosition[] = ["top", "right", "bottom", "left", "center"];

function ActionIcon({ restore = false, close = false }: { restore?: boolean; close?: boolean }) {
  return (
    <svg
      className="wb-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      aria-hidden="true"
    >
      {close ? (
        <path d="m4 4 8 8M12 4l-8 8" />
      ) : restore ? (
        <>
          <rect x="3" y="5" width="8" height="8" rx="1" />
          <path d="M5 5V3h8v8h-2" />
        </>
      ) : (
        <rect x="3" y="3" width="10" height="10" rx="1" />
      )}
    </svg>
  );
}

function PanelModeToggle({
  renderToggleButton,
  ...props
}: WorkbenchToggleButtonProps & {
  renderToggleButton: WorkbenchToggleButtonRenderer | undefined;
}) {
  if (renderToggleButton) return renderToggleButton(props);
  return (
    <button
      type="button"
      className="wb-panel__action"
      aria-controls={props["aria-controls"]}
      aria-label={props["aria-label"]}
      aria-pressed={props.isSelected}
      onClick={() => props.onChange(!props.isSelected)}
    >
      {props.children}
    </button>
  );
}

function minimumFor(node: WorkbenchLayoutNode, axis: "horizontal" | "vertical", panels: PanelRegistry): number {
  if (node.type === "panel") return panels.get(node.panelId)?.minSize ?? 80;
  if (node.type === "tabs") return Math.max(80, ...node.panelIds.map((id) => panels.get(id)?.minSize ?? 80));
  const values = node.children.map((child) => minimumFor(child, axis, panels));
  return node.direction === axis ? values.reduce((sum, value) => sum + value, 0) : Math.max(...values);
}

function DockGlyph({ position }: { position: DockPosition }) {
  if (position === "center")
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="3" width="10" height="10" rx="1" />
        <path d="M3 6h10" />
      </svg>
    );
  const rotation = position === "right" ? 180 : position === "top" ? 90 : position === "bottom" ? -90 : 0;
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}>
      <rect x="2.5" y="3" width="11" height="10" rx="1" />
      <path d="M6 3v10" />
    </svg>
  );
}

function DockOverlay({
  targetNodeId,
  draggingPanelId,
  activeDockTargetId,
  onDockTargetChange,
  onPanelDock,
  messages,
  panels
}: Pick<DockingProps, "draggingPanelId" | "activeDockTargetId" | "onDockTargetChange" | "onPanelDock" | "messages"> & {
  targetNodeId: string;
  panels: PanelRegistry;
}) {
  const [hoveredPosition, setHoveredPosition] = useState<DockPosition>();
  if (!draggingPanelId) return null;
  const active = activeDockTargetId === targetNodeId;
  return (
    <div
      className={`wb-dock-overlay${active ? " is-active" : ""}`}
      aria-label={messages.dockPanel}
      onDragEnter={(event) => {
        event.preventDefault();
        onDockTargetChange(targetNodeId);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!active) onDockTargetChange(targetNodeId);
      }}
      onDragLeave={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX <= rect.left ||
          event.clientX >= rect.right ||
          event.clientY <= rect.top ||
          event.clientY >= rect.bottom
        ) {
          setHoveredPosition(undefined);
          onDockTargetChange();
        }
      }}
    >
      {active && hoveredPosition ? <div className={`wb-dock-preview wb-dock-preview--${hoveredPosition}`} /> : null}
      {active ? (
        <div className="wb-dock-compass">
          {DOCK_POSITIONS.map((position) => (
            <button
              type="button"
              className={`wb-dock-target wb-dock-target--${position}`}
              aria-label={messages.dockPosition(panels.get(draggingPanelId)?.title ?? draggingPanelId, position)}
              tabIndex={-1}
              key={position}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setHoveredPosition(position);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setHoveredPosition(undefined);
                onPanelDock(targetNodeId, position);
              }}
            >
              <DockGlyph position={position} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SinglePanel({
  node,
  layout,
  panels,
  onLayoutChange,
  messages,
  draggingPanelId,
  activeDockTargetId,
  renderToggleButton,
  onPanelDragStart,
  onPanelDragEnd,
  onDockTargetChange,
  onPanelDock
}: {
  node: PanelLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
} & DockingProps) {
  const panel = panels.get(node.panelId);
  const draggable = Boolean(panel?.canMove && panel.canDock);
  const presentation = panel?.presentation ?? "tool-window";
  const editor = presentation === "editor";
  return (
    <section
      className={`wb-panel wb-panel--${presentation}`}
      data-panel-id={node.panelId}
      data-panel-presentation={presentation}
    >
      <header className={editor ? "wb-editor__header" : "wb-panel__header"}>
        {editor ? (
          <div className="wb-editor__tab" aria-current="page">
            {panel?.renderHeader?.() ?? panel?.title ?? node.panelId}
          </div>
        ) : (
          <span
            className={draggable ? "wb-panel__drag-handle" : undefined}
            draggable={draggable}
            onDragStart={(event) => onPanelDragStart(node.panelId, event)}
            onDragEnd={onPanelDragEnd}
          >
            {panel?.icon}
            <span>{panel?.title ?? node.panelId}</span>
          </span>
        )}
        <span className="wb-panel__header-spacer" />
        <Tooltip content={messages.maximizePanel} side="left">
          <PanelModeToggle
            renderToggleButton={renderToggleButton}
            isSelected={false}
            aria-controls={`workbench-panel-${node.panelId}`}
            aria-label={messages.maximizePanelLabel(panel?.title ?? node.panelId)}
            onChange={(isSelected) => {
              if (isSelected) onLayoutChange(toggleMaximizedPanel(layout, node.panelId));
            }}
          >
            <ActionIcon />
          </PanelModeToggle>
        </Tooltip>
      </header>
      <div id={`workbench-panel-${node.panelId}`} className="wb-panel__body">
        {panelBody(node.panelId, panels, messages)}
      </div>
      {draggingPanelId !== node.panelId ? (
        <DockOverlay
          targetNodeId={node.id}
          draggingPanelId={draggingPanelId}
          activeDockTargetId={activeDockTargetId}
          onDockTargetChange={onDockTargetChange}
          onPanelDock={onPanelDock}
          messages={messages}
          panels={panels}
        />
      ) : null}
    </section>
  );
}

function TabGroup({
  node,
  layout,
  panels,
  onLayoutChange,
  messages,
  draggingPanelId,
  activeDockTargetId,
  renderToggleButton,
  onPanelDragStart,
  onPanelDragEnd,
  onDockTargetChange,
  onPanelDock
}: {
  node: TabLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
} & DockingProps) {
  const active = panels.get(node.activePanelId);
  return (
    <section className="wb-panel wb-tabs" data-tab-group-id={node.id}>
      <div className="wb-tabs__bar" role="tablist" aria-label={messages.panelTabs}>
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
                <Tooltip content={messages.closePanel(panel.title)}>
                  <button
                    type="button"
                    className="wb-tab__close"
                    aria-label={messages.closePanel(panel.title)}
                    onClick={() => onLayoutChange(closePanel(layout, panelId))}
                  >
                    <ActionIcon close />
                  </button>
                </Tooltip>
              ) : null}
            </div>
          );
        })}
        <span className="wb-tabs__spacer" />
        <Tooltip content={messages.maximizePanel} side="left">
          <PanelModeToggle
            renderToggleButton={renderToggleButton}
            isSelected={false}
            aria-controls={`workbench-panel-${node.activePanelId}`}
            aria-label={messages.maximizePanelLabel(active?.title ?? node.activePanelId)}
            onChange={(isSelected) => {
              if (isSelected) onLayoutChange(toggleMaximizedPanel(layout, node.activePanelId));
            }}
          >
            <ActionIcon />
          </PanelModeToggle>
        </Tooltip>
      </div>
      <div id={`workbench-panel-${node.activePanelId}`} className="wb-panel__body" role="tabpanel">
        {panelBody(node.activePanelId, panels, messages)}
      </div>
      {!(node.panelIds.length === 1 && node.panelIds[0] === draggingPanelId) ? (
        <DockOverlay
          targetNodeId={node.id}
          draggingPanelId={draggingPanelId}
          activeDockTargetId={activeDockTargetId}
          onDockTargetChange={onDockTargetChange}
          onPanelDock={onPanelDock}
          messages={messages}
          panels={panels}
        />
      ) : null}
    </section>
  );
}

function SplitView({
  node,
  layout,
  panels,
  onLayoutChange,
  messages,
  ...docking
}: {
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
        const childStyle = {
          "--wb-split-size": size,
          "--wb-min-size": `${minimumFor(child, node.direction, panels)}px`
        } as CSSProperties;
        const childElement = (
          <div className="wb-split__child" style={childStyle} key={child.id}>
            <LayoutNode
              node={child}
              layout={layout}
              panels={panels}
              onLayoutChange={onLayoutChange}
              messages={messages}
              {...docking}
            />
          </div>
        );
        if (index === node.children.length - 1) return [childElement];
        const separator = (
          // The focusable ARIA separator implements keyboard resizing; jsx-a11y 6 does not classify this role as interactive.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <div
            className="wb-separator"
            role="separator"
            aria-orientation={horizontal ? "vertical" : "horizontal"}
            aria-label={messages.resizePanels}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(size * 100)}
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

function LayoutNode({
  node,
  layout,
  panels,
  onLayoutChange,
  ...docking
}: {
  node: WorkbenchLayoutNode;
  layout: WorkbenchLayoutState;
  panels: PanelRegistry;
  onLayoutChange: (layout: WorkbenchLayoutState) => void;
} & DockingProps) {
  if (node.type === "split")
    return <SplitView node={node} layout={layout} panels={panels} onLayoutChange={onLayoutChange} {...docking} />;
  if (node.type === "tabs")
    return <TabGroup node={node} layout={layout} panels={panels} onLayoutChange={onLayoutChange} {...docking} />;
  return <SinglePanel node={node} layout={layout} panels={panels} onLayoutChange={onLayoutChange} {...docking} />;
}

export function Workbench({
  layout,
  panels,
  onLayoutChange,
  messages: messageOverrides,
  renderToggleButton
}: WorkbenchProps) {
  const messages = { ...DEFAULT_MESSAGES, ...messageOverrides };
  const [draggingPanelId, setDraggingPanelId] = useState<string>();
  const [activeDockTargetId, setActiveDockTargetId] = useState<string>();
  const onPanelDragStart = (panelId: string, event: ReactDragEvent<HTMLElement>): void => {
    setDraggingPanelId(panelId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-agidn-panel", panelId);
    event.dataTransfer.setData("text/plain", panelId);
  };
  const onPanelDragEnd = (): void => {
    setDraggingPanelId(undefined);
    setActiveDockTargetId(undefined);
  };
  const onPanelDock = (targetNodeId: string, position: DockPosition): void => {
    if (!draggingPanelId) return;
    onLayoutChange(dockPanel(layout, draggingPanelId, targetNodeId, position));
    setDraggingPanelId(undefined);
    setActiveDockTargetId(undefined);
  };

  if (layout.maximizedPanelId) {
    const maximizedPanel = panels.get(layout.maximizedPanelId);
    const presentation = maximizedPanel?.presentation ?? "tool-window";
    const editor = presentation === "editor";
    return (
      <div className="wb-root wb-root--maximized" data-dock-hint={messages.dockingHint}>
        <section
          className={`wb-panel wb-panel--${presentation}`}
          data-panel-id={layout.maximizedPanelId}
          data-panel-presentation={presentation}
        >
          <header className={editor ? "wb-editor__header" : "wb-panel__header"}>
            {editor ? (
              <div className="wb-editor__tab" aria-current="page">
                {maximizedPanel?.renderHeader?.() ?? maximizedPanel?.title ?? layout.maximizedPanelId}
              </div>
            ) : (
              <span>
                {maximizedPanel?.icon}
                <span>{maximizedPanel?.title ?? layout.maximizedPanelId}</span>
              </span>
            )}
            <span className="wb-panel__header-spacer" />
            <Tooltip content={messages.restoreLayout} side="left">
              <PanelModeToggle
                renderToggleButton={renderToggleButton}
                isSelected
                aria-controls={`workbench-panel-${layout.maximizedPanelId}`}
                aria-label={messages.restoreLayoutLabel}
                onChange={(isSelected) => {
                  if (!isSelected) onLayoutChange(toggleMaximizedPanel(layout, layout.maximizedPanelId!));
                }}
              >
                <ActionIcon restore />
              </PanelModeToggle>
            </Tooltip>
          </header>
          <div id={`workbench-panel-${layout.maximizedPanelId}`} className="wb-panel__body">
            {panelBody(layout.maximizedPanelId, panels, messages)}
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className={`wb-root${draggingPanelId ? " is-docking" : ""}`} data-dock-hint={messages.dockingHint}>
      <LayoutNode
        node={layout.root}
        layout={layout}
        panels={panels}
        onLayoutChange={onLayoutChange}
        messages={messages}
        draggingPanelId={draggingPanelId}
        activeDockTargetId={activeDockTargetId}
        renderToggleButton={renderToggleButton}
        onPanelDragStart={onPanelDragStart}
        onPanelDragEnd={onPanelDragEnd}
        onDockTargetChange={setActiveDockTargetId}
        onPanelDock={onPanelDock}
      />
    </div>
  );
}
