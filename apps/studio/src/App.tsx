import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CommandRegistry,
  openPanel,
  PanelRegistry,
  Workbench,
  type PanelContribution,
  type PanelLocation,
  type WorkbenchLayoutState
} from "@agidn/studio-workbench";
import { CanvasViewport } from "./canvas/CanvasViewport.js";
import { CommandPalette } from "./CommandPalette.js";
import { ComponentsPanel, HistoryPanel, InspectorPanel, PageOutlinePanel, ProblemsPanel } from "./panels.js";
import { DEFAULT_WORKBENCH_LAYOUT, PANEL_TARGETS } from "./workbench-layout.js";
import { useWorkbenchLayout } from "./use-workbench-layout.js";
import { StudioSessionProvider, useStudioSession } from "./studio-session.js";

const panelContributions: PanelContribution[] = [
  { id: "page-outline", title: "Page Outline", icon: "⊞", defaultLocation: "primary", minSize: 180, canClose: true, canMove: true, canDock: true, render: () => <PageOutlinePanel /> },
  { id: "components", title: "Components", icon: "◈", defaultLocation: "primary", minSize: 180, canClose: true, canMove: true, canDock: true, render: () => <ComponentsPanel /> },
  { id: "canvas", title: "Canvas", icon: "▣", defaultLocation: "center", minSize: 420, canClose: false, canMove: true, canDock: false, render: () => <CanvasViewport /> },
  { id: "inspector", title: "Inspector", icon: "☷", defaultLocation: "secondary", minSize: 220, canClose: true, canMove: true, canDock: true, render: () => <InspectorPanel /> },
  { id: "problems", title: "Problems", icon: "△", defaultLocation: "bottom", minSize: 110, canClose: true, canMove: true, canDock: true, render: () => <ProblemsPanel /> },
  { id: "history", title: "History", icon: "◷", defaultLocation: "bottom", minSize: 110, canClose: true, canMove: true, canDock: true, render: () => <HistoryPanel /> }
];

function targetFor(location: PanelLocation): string {
  return PANEL_TARGETS[location];
}

function StudioApp() {
  const session = useStudioSession();
  const panels = useMemo(() => new PanelRegistry(panelContributions), []);
  const { layout, setLayout, resetLayout } = useWorkbenchLayout(DEFAULT_WORKBENCH_LAYOUT, panels);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openRegisteredPanel = useCallback((panelId: string) => {
    const panel = panels.get(panelId);
    if (!panel) return;
    setLayout((current) => openPanel(current, panelId, targetFor(panel.defaultLocation)));
  }, [panels, setLayout]);
  const commands = useMemo(() => new CommandRegistry([
    { id: "workbench.commandPalette", title: "Show Command Palette", category: "Workbench", keybinding: "⌘⇧P", execute: () => setPaletteOpen(true) },
    { id: "workbench.resetLayout", title: "Reset Workbench Layout", category: "Workbench", execute: resetLayout },
    ...panelContributions.map((panel) => ({
      id: `workbench.open.${panel.id}`,
      title: `Open ${panel.title}`,
      category: "View",
      execute: () => openRegisteredPanel(panel.id)
    }))
  ]), [openRegisteredPanel, resetLayout]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateLayout = useCallback((next: WorkbenchLayoutState) => setLayout(next), [setLayout]);

  return (
    <main className="studio-shell">
      <header className="titlebar">
        <div className="app-mark">A</div>
        <div className="titlebar__project"><strong>AGIDN Studio</strong><span>/</span><span>Acme Pricing</span></div>
        <div className="titlebar__center"><button type="button" onClick={() => setPaletteOpen(true)}><span>Search commands and files</span><kbd>⌘⇧P</kbd></button></div>
        <div className="titlebar__actions">
          <button type="button" aria-label="Undo" disabled={!session.canUndo || session.status === "saving"} onClick={() => void session.undo()}>↶</button>
          <button type="button" aria-label="Redo" disabled={!session.canRedo || session.status === "saving"} onClick={() => void session.redo()}>↷</button>
          <span className={`save-state save-state--${session.status}`} title={session.error}><i />{session.status === "saving" ? "Saving…" : session.status === "loading" ? "Loading…" : session.status === "error" ? "Attention" : "Saved"}</span>
          <button type="button" className="export-button">Export</button>
        </div>
      </header>
      <div className="studio-body">
        <nav className="activity-bar" aria-label="Workbench panels">
          <div className="activity-bar__top">
            {panels.list().filter(({ id }) => id !== "canvas").map((panel) => (
              <button type="button" key={panel.id} title={panel.title} aria-label={`Open ${panel.title}`} onClick={() => openRegisteredPanel(panel.id)}>
                <span>{panel.icon}</span>
              </button>
            ))}
          </div>
          <div className="activity-bar__bottom">
            <button type="button" title="Commands" aria-label="Open command palette" onClick={() => setPaletteOpen(true)}><span>⌘</span></button>
            <button type="button" title="Settings" aria-label="Open settings"><span>⚙</span></button>
          </div>
        </nav>
        <section className="studio-workbench" aria-label="Studio workbench">
          <Workbench layout={layout} panels={panels} onLayoutChange={updateLayout} />
        </section>
      </div>
      <footer className="statusbar">
        <div><span className={session.status === "error" ? "status-error" : "status-ok"}>{session.status === "error" ? "!" : "✓"}</span><span>PageDocument 1.0.0</span><span>Revision {session.revision}</span></div>
        <div><span>{session.selectedNodeId ?? "No selection"}</span><span>UTF-8</span><span>TypeScript</span></div>
      </footer>
      <CommandPalette commands={commands} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </main>
  );
}

export function App() {
  return <StudioSessionProvider><StudioApp /></StudioSessionProvider>;
}
