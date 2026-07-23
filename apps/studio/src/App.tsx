import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closePanel, CommandRegistry, openPanel, PanelRegistry, Tooltip, TooltipProvider, Workbench,
  type DockPosition, type PanelContribution, type PanelLocation, type WorkbenchLayoutState, type WorkbenchMessages
} from "@agidn/studio-workbench";
import { CanvasViewport } from "./canvas/CanvasViewport.js";
import { Icon } from "./icons.js";
import { ComponentsPanel, HistoryPanel, InspectorPanel, PageOutlinePanel, ProblemsPanel } from "./panels.js";
import { DEFAULT_WORKBENCH_LAYOUT, PANEL_TARGETS } from "./workbench-layout.js";
import { useWorkbenchLayout } from "./use-workbench-layout.js";
import { StudioSessionProvider, useStudioSession } from "./studio-session.js";
import { I18nProvider, useI18n, type MessageKey } from "./i18n.js";
import { SYSTEM_THEME_SELECTION } from "./themes/index.js";
import { useStudioTheme } from "./themes/use-studio-theme.js";

type PanelDefinition = Omit<PanelContribution, "title"> & { titleKey: MessageKey };

const panelDefinitions: PanelDefinition[] = [
  { id: "page-outline", titleKey: "navigation.pageOutline", icon: <Icon name="outline" />, defaultLocation: "primary", defaultSize: 230, minSize: 180, canClose: true, canMove: true, canDock: true, render: () => <PageOutlinePanel /> },
  { id: "components", titleKey: "navigation.components", icon: <Icon name="components" />, defaultLocation: "primary", defaultSize: 230, minSize: 180, canClose: true, canMove: true, canDock: true, render: () => <ComponentsPanel /> },
  { id: "canvas", titleKey: "navigation.canvas", icon: <Icon name="canvas" />, defaultLocation: "center", minSize: 420, canClose: false, canMove: true, canDock: false, render: () => <CanvasViewport /> },
  { id: "inspector", titleKey: "navigation.inspector", icon: <Icon name="inspector" />, defaultLocation: "secondary", defaultSize: 260, minSize: 220, canClose: true, canMove: true, canDock: true, render: () => <InspectorPanel /> },
  { id: "problems", titleKey: "navigation.problems", icon: <Icon name="problems" />, defaultLocation: "bottom", defaultSize: 170, minSize: 110, canClose: true, canMove: true, canDock: true, render: () => <ProblemsPanel /> },
  { id: "history", titleKey: "navigation.history", icon: <Icon name="history" />, defaultLocation: "bottom", defaultSize: 170, minSize: 110, canClose: true, canMove: true, canDock: true, render: () => <HistoryPanel /> }
];

const DOCK_POSITION_KEYS: Readonly<Record<DockPosition, MessageKey>> = {
  top: "workbench.positionTop",
  right: "workbench.positionRight",
  bottom: "workbench.positionBottom",
  left: "workbench.positionLeft",
  center: "workbench.positionCenter"
};

function targetFor(location: PanelLocation): string { return PANEL_TARGETS[location]; }

const loadCommandPalette = () => import("./CommandPalette.js");
const loadExportDialog = () => import("./components/studio/export-dialog.js");
const loadSettingsDialog = () => import("./components/studio/settings-dialog.js");
const CommandPalette = lazy(loadCommandPalette);
const ExportDialog = lazy(loadExportDialog);
const SettingsDialog = lazy(loadSettingsDialog);

function StudioApp() {
  const session = useStudioSession();
  const { format, locale, t } = useI18n();
  const localizedContributions = useMemo(() => panelDefinitions.map(({ titleKey, ...panel }) => ({ ...panel, title: t(titleKey) })), [t]);
  const panels = useMemo(() => new PanelRegistry(localizedContributions), [localizedContributions]);
  const { layout, setLayout, resetLayout } = useWorkbenchLayout(DEFAULT_WORKBENCH_LAYOUT, panels);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const commandPaletteFallbackRef = useRef<HTMLButtonElement>(null);
  const commandPaletteReturnFocusRef = useRef<HTMLElement | null>(null);
  const theme = useStudioTheme();

  const openCommandPalette = useCallback((returnFocusTo?: HTMLElement) => {
    const activeElement = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
    commandPaletteReturnFocusRef.current = returnFocusTo ?? activeElement ?? commandPaletteFallbackRef.current;
    setPaletteOpen(true);
  }, []);
  const closeCommandPalette = useCallback(() => {
    setPaletteOpen(false);
    const returnFocusTo = commandPaletteReturnFocusRef.current;
    requestAnimationFrame(() => {
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
      else commandPaletteFallbackRef.current?.focus();
    });
  }, []);

  const openRegisteredPanel = useCallback((panelId: string) => {
    const panel = panels.get(panelId); if (!panel) return;
    setLayout((current) => openPanel(current, panelId, targetFor(panel.defaultLocation)));
  }, [panels, setLayout]);
  const toggleRegisteredPanel = useCallback((panelId: string) => {
    const panel = panels.get(panelId); if (!panel) return;
    setLayout((current) => current.hiddenPanelIds.includes(panelId) ? openPanel(current, panelId, targetFor(panel.defaultLocation)) : closePanel(current, panelId));
  }, [panels, setLayout]);
  const commands = useMemo(() => new CommandRegistry([
    { id: "workbench.commandPalette", title: t("commandPalette.show"), category: t("commandPalette.categoryWorkbench"), keybinding: "⌘⇧P", execute: () => openCommandPalette() },
    { id: "workbench.resetLayout", title: t("commandPalette.resetLayout"), category: t("commandPalette.categoryWorkbench"), execute: resetLayout },
    { id: "studio.settings", title: t("commandPalette.openSettings"), category: t("commandPalette.categoryStudio"), execute: () => setSettingsOpen(true) },
    { id: "studio.export", title: t("commandPalette.exportRevision"), category: t("commandPalette.categoryDocument"), execute: () => setExportOpen(true) },
    { id: "studio.theme.system", title: t("commandPalette.colorTheme", { theme: t("commandPalette.followSystemTheme") }), category: t("commandPalette.categoryPreferences"), execute: () => theme.setSelection(SYSTEM_THEME_SELECTION) },
    ...theme.themes.map((colorTheme) => ({ id: `studio.theme.${colorTheme.id}`, title: t("commandPalette.colorTheme", { theme: colorTheme.label }), category: t("commandPalette.categoryPreferences"), execute: () => theme.setSelection(colorTheme.id) })),
    ...localizedContributions.map((panel) => ({ id: `workbench.open.${panel.id}`, title: t("commandPalette.openPanel", { panel: panel.title }), category: t("commandPalette.categoryView"), execute: () => openRegisteredPanel(panel.id) }))
  ]), [localizedContributions, openCommandPalette, openRegisteredPanel, resetLayout, t, theme.setSelection, theme.themes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => { if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") { event.preventDefault(); openCommandPalette(); } };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCommandPalette]);
  const updateLayout = useCallback((next: WorkbenchLayoutState) => setLayout(next), [setLayout]);
  const panelButton = (panel: PanelContribution, side: "left" | "right" | "top") => <Tooltip content={panel.title} side={side} key={panel.id}><button type="button" className={!layout.hiddenPanelIds.includes(panel.id) ? "is-open" : ""} aria-pressed={!layout.hiddenPanelIds.includes(panel.id)} aria-label={t("navigation.togglePanel", { panel: panel.title })} onClick={() => toggleRegisteredPanel(panel.id)}>{panel.icon}</button></Tooltip>;
  const primaryPanels = localizedContributions.filter(({ defaultLocation }) => defaultLocation === "primary");
  const secondaryPanels = localizedContributions.filter(({ defaultLocation }) => defaultLocation === "secondary");
  const bottomPanels = localizedContributions.filter(({ defaultLocation }) => defaultLocation === "bottom");
  const workbenchMessages = useMemo<WorkbenchMessages>(() => ({
    panelUnavailable: (panel) => t("workbench.panelUnavailable", { panel }),
    dockPanel: t("workbench.dockPanel"),
    dockPosition: (panel, position) => t("workbench.dockPosition", { panel, position: t(DOCK_POSITION_KEYS[position]) }),
    maximizePanel: t("workbench.maximizePanel"),
    maximizePanelLabel: (panel) => t("workbench.maximizePanelLabel", { panel }),
    panelTabs: t("workbench.panelTabs"),
    closePanel: (panel) => t("workbench.closePanel", { panel }),
    resizePanels: t("workbench.resizePanels"),
    restoreLayout: t("workbench.restoreLayout"),
    restoreLayoutLabel: t("workbench.restoreLayoutLabel"),
    dockingHint: t("workbench.dockingHint")
  }), [t]);

  return <>
    <main className="studio-shell">
    <header className="titlebar">
      <div className="titlebar__identity"><div className="app-mark">A</div><nav className="main-menu" aria-label={t("navigation.applicationMenu")}><details><summary>{t("navigation.file")}</summary><div><button type="button" onPointerEnter={() => void loadExportDialog()} onFocus={() => void loadExportDialog()} onClick={() => setExportOpen(true)}>{t("actions.exportRevision")}</button></div></details><details><summary>{t("navigation.edit")}</summary><div><button type="button" disabled={!session.canUndo} onClick={() => void session.undo()}>{t("actions.undo")}</button><button type="button" disabled={!session.canRedo} onClick={() => void session.redo()}>{t("actions.redo")}</button></div></details><details><summary>{t("navigation.view")}</summary><div>{localizedContributions.filter(({ id }) => id !== "canvas").map((panel) => <button type="button" key={panel.id} onClick={() => toggleRegisteredPanel(panel.id)}>{panel.title}</button>)}<button type="button" onClick={resetLayout}>{t("actions.resetLayout")}</button></div></details></nav><div className="titlebar__project"><strong>AGIDN Studio</strong><span>/</span><span>{session.document?.name ?? "—"}</span></div></div>
      <div className="titlebar__center"><button type="button" onPointerEnter={() => void loadCommandPalette()} onFocus={() => void loadCommandPalette()} onClick={(event) => openCommandPalette(event.currentTarget)}><span>{t("commandPalette.searchTrigger")}</span><kbd>⌘⇧P</kbd></button></div>
      <div className="titlebar__actions">
        <Tooltip content={!session.canUndo ? t("actions.nothingToUndo") : t("actions.undo")}><button type="button" aria-label={t("actions.undo")} disabled={!session.canUndo || session.status === "saving"} onClick={() => void session.undo()}><Icon name="undo" /></button></Tooltip>
        <Tooltip content={!session.canRedo ? t("actions.nothingToRedo") : t("actions.redo")}><button type="button" aria-label={t("actions.redo")} disabled={!session.canRedo || session.status === "saving"} onClick={() => void session.redo()}><Icon name="redo" /></button></Tooltip>
        <span className={`save-state save-state--${session.status}`} title={session.error ? format(session.error) : undefined}><i />{session.status === "saving" ? t("common.saving") : session.status === "loading" ? t("common.loading") : session.status === "error" ? t("common.attention") : t("common.saved")}</span>
        <button type="button" className="export-button" onPointerEnter={() => void loadExportDialog()} onFocus={() => void loadExportDialog()} onClick={() => setExportOpen(true)}><Icon name="export" />{t("common.export")}</button>
      </div>
    </header>
    <div className="studio-body"><nav className="activity-bar activity-bar--left" aria-label={t("navigation.projectToolWindows")}><div className="activity-bar__top">{primaryPanels.map((panel) => panelButton(panel, "right"))}</div><div className="activity-bar__bottom"><Tooltip content={t("common.commands")} side="right"><button ref={commandPaletteFallbackRef} type="button" aria-label={t("navigation.openCommandPalette")} onPointerEnter={() => void loadCommandPalette()} onFocus={() => void loadCommandPalette()} onClick={(event) => openCommandPalette(event.currentTarget)}><Icon name="commands" /></button></Tooltip><Tooltip content={t("common.settings")} side="right"><button type="button" aria-label={t("navigation.openSettings")} onPointerEnter={() => void loadSettingsDialog()} onFocus={() => void loadSettingsDialog()} onClick={() => setSettingsOpen(true)}><Icon name="settings" /></button></Tooltip></div></nav><section className="studio-workbench" aria-label={t("navigation.studioWorkbench")}><Workbench layout={layout} panels={panels} messages={workbenchMessages} onLayoutChange={updateLayout} /></section><nav className="activity-bar activity-bar--right" aria-label={t("navigation.contentToolWindows")}><div className="activity-bar__top">{secondaryPanels.map((panel) => panelButton(panel, "left"))}</div></nav><nav className="tool-window-bar tool-window-bar--bottom" aria-label={t("navigation.statusToolWindows")}>{bottomPanels.map((panel) => panelButton(panel, "top"))}</nav></div>
    <footer className="statusbar"><div><span className={session.status === "error" ? "status-error" : "status-ok"}>{session.status === "error" ? "!" : "✓"}</span><span>PageDocument 1.0.0</span><span>{t("common.revision", { revision: session.revision })}</span></div><div><span>{session.selectedNodeId ?? t("common.noSelection")}</span><span>UTF-8</span><span>TypeScript</span></div></footer>
    </main>
    <Suspense fallback={null}>
      {paletteOpen ? <CommandPalette commands={commands} locale={locale} colorScheme={theme.activeTheme.uiTheme} open onClose={closeCommandPalette} /> : null}
      {exportOpen ? <ExportDialog locale={locale} colorScheme={theme.activeTheme.uiTheme} onClose={() => setExportOpen(false)} /> : null}
      {settingsOpen ? <SettingsDialog locale={locale} themeSelection={theme.selection} activeTheme={theme.activeTheme} themePlugins={theme.plugins} themes={theme.themes} onThemeChange={theme.setSelection} onClose={() => setSettingsOpen(false)} /> : null}
    </Suspense>
  </>;
}

export function App() { return <I18nProvider><StudioSessionProvider><TooltipProvider><StudioApp /></TooltipProvider></StudioSessionProvider></I18nProvider>; }
