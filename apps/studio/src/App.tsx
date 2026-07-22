import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CommandRegistry, openPanel, PanelRegistry, Tooltip, TooltipProvider, Workbench,
  type PanelContribution, type PanelLocation, type WorkbenchLayoutState
} from "@agidn/studio-workbench";
import type { ExportContextResponse } from "@agidn/api-protocol";
import { CanvasViewport } from "./canvas/CanvasViewport.js";
import { CommandPalette } from "./CommandPalette.js";
import { Icon } from "./icons.js";
import { ComponentsPanel, HistoryPanel, InspectorPanel, PageOutlinePanel, ProblemsPanel } from "./panels.js";
import { DEFAULT_WORKBENCH_LAYOUT, PANEL_TARGETS } from "./workbench-layout.js";
import { useWorkbenchLayout } from "./use-workbench-layout.js";
import { StudioSessionProvider, useStudioSession } from "./studio-session.js";

type ThemeChoice = "system" | "dark" | "light";

const panelContributions: PanelContribution[] = [
  { id: "page-outline", title: "Page Outline", icon: <Icon name="outline" />, defaultLocation: "primary", defaultSize: 230, minSize: 180, canClose: true, canMove: true, canDock: true, render: () => <PageOutlinePanel /> },
  { id: "components", title: "Components", icon: <Icon name="components" />, defaultLocation: "primary", defaultSize: 230, minSize: 180, canClose: true, canMove: true, canDock: true, render: () => <ComponentsPanel /> },
  { id: "canvas", title: "Canvas", icon: <Icon name="canvas" />, defaultLocation: "center", minSize: 420, canClose: false, canMove: true, canDock: false, render: () => <CanvasViewport /> },
  { id: "inspector", title: "Inspector", icon: <Icon name="inspector" />, defaultLocation: "secondary", defaultSize: 260, minSize: 220, canClose: true, canMove: true, canDock: true, render: () => <InspectorPanel /> },
  { id: "problems", title: "Problems", icon: <Icon name="problems" />, defaultLocation: "bottom", defaultSize: 170, minSize: 110, canClose: true, canMove: true, canDock: true, render: () => <ProblemsPanel /> },
  { id: "history", title: "History", icon: <Icon name="history" />, defaultLocation: "bottom", defaultSize: 170, minSize: 110, canClose: true, canMove: true, canDock: true, render: () => <HistoryPanel /> }
];

function targetFor(location: PanelLocation): string { return PANEL_TARGETS[location]; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const close = (event: KeyboardEvent): void => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="studio-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><h2 id="modal-title">{title}</h2><Tooltip content="Close" side="left"><button type="button" aria-label={`Close ${title}`} onClick={onClose}><Icon name="close" /></button></Tooltip></header>{children}</section></div>;
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const session = useStudioSession();
  const [state, setState] = useState<"idle" | "exporting" | "success" | "error">("idle");
  const [result, setResult] = useState<ExportContextResponse>();
  const [error, setError] = useState<string>();
  const run = async (): Promise<void> => {
    setState("exporting"); setError(undefined);
    try {
      const response = await session.exportRevision(); setResult(response);
      if (!response.ok) throw new Error(`Revision ${response.requestedRevision} is no longer available (current: ${response.currentRevision}).`);
      setState("success");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Export failed."); setState("error"); }
  };
  return <Modal title="Export context" onClose={onClose}><div className="modal-content"><p>Export the validated context package for <strong>Revision {session.revision}</strong>.</p>{state === "success" && result?.ok ? <div className="export-result" role="status"><strong>Export complete</strong><code>{result.outputDirectory}</code><span>{Object.keys(result.manifest.files).length} files · SHA-256 · {result.manifest.contentHash.slice(0, 12)}…</span></div> : null}{state === "error" ? <div className="modal-error" role="alert">{error}</div> : null}<footer><button type="button" className="secondary-button" onClick={onClose}>Close</button><button type="button" className="primary-button" disabled={state === "exporting"} onClick={() => void run()}>{state === "exporting" ? "Exporting…" : state === "error" ? "Retry" : state === "success" ? "Export again" : "Export revision"}</button></footer></div></Modal>;
}

function SettingsDialog({ theme, onThemeChange, onClose }: { theme: ThemeChoice; onThemeChange: (theme: ThemeChoice) => void; onClose: () => void }) {
  const session = useStudioSession();
  const components = Object.values(session.catalog?.components.components ?? {});
  const tokens = Object.entries(session.catalog?.tokens.tokens ?? {});
  return <Modal title="Studio settings" onClose={onClose}><div className="settings-content">
    <section><h3>Theme</h3><label className="settings-select"><span>Editor appearance</span><select value={theme} onChange={(event) => onThemeChange(event.target.value as ThemeChoice)}><option value="system">Follow system</option><option value="dark">Dark</option><option value="light">Light</option></select></label><p>Changes Studio chrome only; page Preview remains unchanged.</p></section>
    <section><h3>Workspace</h3><div className="settings-status"><i className={session.status === "error" ? "is-error" : "is-online"} /><div><strong>{session.status === "error" ? "Connection needs attention" : "Connected"}</strong><span>Workspace API · Revision {session.revision}</span></div></div></section>
    <section><h3>Token Browser <small>Read-only</small></h3><div className="settings-browser">{tokens.map(([name, token]) => <div key={name}><code>{name}</code><span>{token.type} · {token.value}</span></div>)}</div></section>
    <section><h3>Component Registry <small>Read-only</small></h3><div className="settings-browser">{components.map((component) => <div key={component.name}><strong>{component.name}</strong><span>{component.source} · {component.variants.length} variants</span></div>)}</div></section>
  </div></Modal>;
}

function StudioApp() {
  const session = useStudioSession();
  const panels = useMemo(() => new PanelRegistry(panelContributions), []);
  const { layout, setLayout, resetLayout } = useWorkbenchLayout(DEFAULT_WORKBENCH_LAYOUT, panels);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(() => (localStorage.getItem("agidn.studio.theme") as ThemeChoice | null) ?? "system");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = (): void => { document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "light" : "dark") : theme; document.documentElement.dataset.themeChoice = theme; };
    apply(); localStorage.setItem("agidn.studio.theme", theme);
    media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [theme]);

  const openRegisteredPanel = useCallback((panelId: string) => {
    const panel = panels.get(panelId); if (!panel) return;
    setLayout((current) => openPanel(current, panelId, targetFor(panel.defaultLocation)));
  }, [panels, setLayout]);
  const commands = useMemo(() => new CommandRegistry([
    { id: "workbench.commandPalette", title: "Show Command Palette", category: "Workbench", keybinding: "⌘⇧P", execute: () => setPaletteOpen(true) },
    { id: "workbench.resetLayout", title: "Reset Workbench Layout", category: "Workbench", execute: resetLayout },
    { id: "studio.settings", title: "Open Studio Settings", category: "Studio", execute: () => setSettingsOpen(true) },
    { id: "studio.export", title: "Export Current Revision", category: "Document", execute: () => setExportOpen(true) },
    ...panelContributions.map((panel) => ({ id: `workbench.open.${panel.id}`, title: `Open ${panel.title}`, category: "View", execute: () => openRegisteredPanel(panel.id) }))
  ]), [openRegisteredPanel, resetLayout]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => { if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") { event.preventDefault(); setPaletteOpen(true); } };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const updateLayout = useCallback((next: WorkbenchLayoutState) => setLayout(next), [setLayout]);

  return <main className="studio-shell">
    <header className="titlebar">
      <div className="titlebar__identity"><div className="app-mark">A</div><div className="titlebar__project"><strong>AGIDN Studio</strong><span>/</span><span>Acme Pricing</span></div></div>
      <div className="titlebar__center"><button type="button" onClick={() => setPaletteOpen(true)}><span>Search commands and files</span><kbd>⌘⇧P</kbd></button></div>
      <div className="titlebar__actions">
        <Tooltip content={!session.canUndo ? "Nothing to undo" : "Undo"}><button type="button" aria-label="Undo" disabled={!session.canUndo || session.status === "saving"} onClick={() => void session.undo()}><Icon name="undo" /></button></Tooltip>
        <Tooltip content={!session.canRedo ? "Nothing to redo" : "Redo"}><button type="button" aria-label="Redo" disabled={!session.canRedo || session.status === "saving"} onClick={() => void session.redo()}><Icon name="redo" /></button></Tooltip>
        <span className={`save-state save-state--${session.status}`} title={session.error}><i />{session.status === "saving" ? "Saving…" : session.status === "loading" ? "Loading…" : session.status === "error" ? "Attention" : "Saved"}</span>
        <button type="button" className="export-button" onClick={() => setExportOpen(true)}><Icon name="export" />Export</button>
      </div>
    </header>
    <div className="studio-body"><nav className="activity-bar" aria-label="Workbench panels"><div className="activity-bar__top">{panels.list().filter(({ id }) => id !== "canvas").map((panel) => <Tooltip content={panel.title} side="right" key={panel.id}><button type="button" aria-label={`Open ${panel.title}`} onClick={() => openRegisteredPanel(panel.id)}>{panel.icon}</button></Tooltip>)}</div><div className="activity-bar__bottom"><Tooltip content="Commands" side="right"><button type="button" aria-label="Open command palette" onClick={() => setPaletteOpen(true)}><Icon name="commands" /></button></Tooltip><Tooltip content="Settings" side="right"><button type="button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><Icon name="settings" /></button></Tooltip></div></nav><section className="studio-workbench" aria-label="Studio workbench"><Workbench layout={layout} panels={panels} onLayoutChange={updateLayout} /></section></div>
    <footer className="statusbar"><div><span className={session.status === "error" ? "status-error" : "status-ok"}>{session.status === "error" ? "!" : "✓"}</span><span>PageDocument 1.0.0</span><span>Revision {session.revision}</span></div><div><span>{session.selectedNodeId ?? "No selection"}</span><span>UTF-8</span><span>TypeScript</span></div></footer>
    <CommandPalette commands={commands} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    {exportOpen ? <ExportDialog onClose={() => setExportOpen(false)} /> : null}
    {settingsOpen ? <SettingsDialog theme={theme} onThemeChange={setTheme} onClose={() => setSettingsOpen(false)} /> : null}
  </main>;
}

export function App() { return <StudioSessionProvider><TooltipProvider><StudioApp /></TooltipProvider></StudioSessionProvider>; }
