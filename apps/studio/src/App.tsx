import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closePanel,
  CommandRegistry,
  openPanel,
  PanelRegistry,
  Tooltip,
  TooltipProvider,
  Workbench,
  type DockPosition,
  type PanelContribution,
  type WorkbenchLayoutState,
  type WorkbenchMessages,
  type WorkbenchToggleButtonProps
} from "@agidn/studio-workbench";
import { CanvasViewport } from "./canvas/CanvasViewport.js";
import { ComponentsPanel, HistoryPanel, InspectorPanel, PageOutlinePanel, ProblemsPanel } from "./panels.js";
import { DEFAULT_WORKBENCH_LAYOUT, PANEL_TARGETS } from "./workbench-layout.js";
import { useWorkbenchLayout } from "./use-workbench-layout.js";
import { StudioSessionProvider, useStudioSession } from "./studio-session.js";
import { I18nProvider, useI18n, type MessageKey } from "./i18n.js";
import { SYSTEM_THEME_SELECTION } from "./themes/index.js";
import { useStudioTheme } from "./themes/use-studio-theme.js";
import {
  ActionButton,
  Button,
  ContextMenuProvider,
  IconButton,
  MenuButton,
  ProductIcon,
  StudioUiProvider,
  ToggleButton,
  useContextMenu
} from "./components/ui/index.js";
import { ComponentWorkbench } from "./ComponentWorkbench.js";
import { ComponentWorkbenchNavigationProvider } from "./component-workbench-navigation.js";
import { createStudioContextMenuRegistry } from "./context-menu/studio-context-menu.js";

type PanelDefinition = Omit<PanelContribution, "title"> & { titleKey: MessageKey };

function CanvasEditorHeader() {
  const session = useStudioSession();
  const { t } = useI18n();
  const { openContextMenu } = useContextMenu();
  const openPages = session.openPageIds
    .map((pageId) => session.pages.find(({ id }) => id === pageId))
    .filter((page): page is NonNullable<typeof page> => Boolean(page));
  return (
    <div className="canvas-page-tabs" role="tablist" aria-label={t("outline.openPages")}>
      {openPages.map((page) => (
        <div
          className={`canvas-page-tab${page.id === session.activePageId ? " is-active" : ""}`}
          key={page.id}
          onContextMenu={(event) =>
            openContextMenu(event, {
              type: "page",
              id: page.id,
              label: page.name,
              metadata: { active: page.id === session.activePageId, surface: "editor-tab" },
              capabilities: {
                activate: { execute: () => session.activatePage(page.id) },
                createPage: { execute: () => void session.createPage() },
                close: {
                  execute: () => session.closePage(page.id),
                  isDisabled: openPages.length <= 1
                }
              }
            })
          }
        >
          <ActionButton
            role="tab"
            aria-selected={page.id === session.activePageId}
            onPress={() => session.activatePage(page.id)}
          >
            <ProductIcon name="canvas" />
            <span>{page.name}</span>
          </ActionButton>
          {openPages.length > 1 ? (
            <IconButton
              className="canvas-page-tab__close"
              icon={<ProductIcon name="close" />}
              label={t("outline.closePage", { page: page.name })}
              onPress={() => session.closePage(page.id)}
            />
          ) : null}
        </div>
      ))}
      <IconButton
        className="canvas-page-tabs__add"
        icon={<ProductIcon name="add" />}
        label={t("outline.newPage")}
        onPress={() => session.createPage()}
      />
    </div>
  );
}

const panelDefinitions: PanelDefinition[] = [
  {
    id: "page-outline",
    titleKey: "navigation.pageOutline",
    icon: <ProductIcon name="outline" />,
    defaultLocation: "primary",
    defaultSize: 230,
    minSize: 180,
    canClose: true,
    canMove: true,
    canDock: true,
    render: () => <PageOutlinePanel />
  },
  {
    id: "components",
    titleKey: "navigation.components",
    icon: <ProductIcon name="components" />,
    defaultLocation: "primary",
    defaultSize: 230,
    minSize: 180,
    canClose: true,
    canMove: true,
    canDock: true,
    render: () => <ComponentsPanel />
  },
  {
    id: "canvas",
    titleKey: "navigation.canvas",
    icon: <ProductIcon name="canvas" />,
    presentation: "editor",
    defaultLocation: "center",
    minSize: 420,
    canClose: false,
    canMove: false,
    canDock: false,
    renderHeader: () => <CanvasEditorHeader />,
    render: () => <CanvasViewport />
  },
  {
    id: "inspector",
    titleKey: "navigation.inspector",
    icon: <ProductIcon name="inspector" />,
    defaultLocation: "secondary",
    defaultSize: 260,
    minSize: 220,
    canClose: true,
    canMove: true,
    canDock: true,
    render: () => <InspectorPanel />
  },
  {
    id: "problems",
    titleKey: "navigation.problems",
    icon: <ProductIcon name="problems" />,
    defaultLocation: "bottom",
    defaultSize: 170,
    minSize: 110,
    canClose: true,
    canMove: true,
    canDock: true,
    render: () => <ProblemsPanel />
  },
  {
    id: "history",
    titleKey: "navigation.history",
    icon: <ProductIcon name="history" />,
    defaultLocation: "bottom",
    defaultSize: 170,
    minSize: 110,
    canClose: true,
    canMove: true,
    canDock: true,
    render: () => <HistoryPanel />
  }
];

const DOCK_POSITION_KEYS: Readonly<Record<DockPosition, MessageKey>> = {
  top: "workbench.positionTop",
  right: "workbench.positionRight",
  bottom: "workbench.positionBottom",
  left: "workbench.positionLeft",
  center: "workbench.positionCenter"
};

function targetFor(panel: Pick<PanelContribution, "id" | "defaultLocation">): string {
  return panel.id === "components" ? PANEL_TARGETS.components : PANEL_TARGETS[panel.defaultLocation];
}
function panelControlId(panelId: string): string {
  return `workbench-panel-${panelId}`;
}

function renderWorkbenchToggleButton({
  children,
  isSelected,
  onChange,
  "aria-controls": ariaControls,
  "aria-label": ariaLabel
}: WorkbenchToggleButtonProps) {
  return (
    <ToggleButton isSelected={isSelected} aria-controls={ariaControls} aria-label={ariaLabel} onChange={onChange}>
      {children}
    </ToggleButton>
  );
}

const loadCommandPalette = () => import("./CommandPalette.js");
const loadExportDialog = () => import("./components/studio/export-dialog.js");
const loadSettingsDialog = () => import("./components/studio/settings-dialog.js");
const CommandPalette = lazy(loadCommandPalette);
const ExportDialog = lazy(loadExportDialog);
const SettingsDialog = lazy(loadSettingsDialog);

function StudioApp() {
  const session = useStudioSession();
  const { format, locale, t } = useI18n();
  const localizedContributions = useMemo(
    () => panelDefinitions.map(({ titleKey, ...panel }) => ({ ...panel, title: t(titleKey) })),
    [t]
  );
  const panels = useMemo(() => new PanelRegistry(localizedContributions), [localizedContributions]);
  const contextMenuRegistry = useMemo(() => createStudioContextMenuRegistry(t), [t]);
  const { layout, setLayout, resetLayout } = useWorkbenchLayout(DEFAULT_WORKBENCH_LAYOUT, panels);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [componentEditor, setComponentEditor] = useState<{ id?: string } | null>(null);
  const commandPaletteFallbackRef = useRef<HTMLButtonElement>(null);
  const commandPaletteReturnFocusRef = useRef<HTMLElement | null>(null);
  const {
    activeTheme,
    plugins: themePlugins,
    selection: themeSelection,
    setSelection: setThemeSelection,
    themes
  } = useStudioTheme();

  const openCommandPalette = useCallback((returnFocusTo?: HTMLElement) => {
    const activeElement =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
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
  const openComponentWorkbench = useCallback((componentId?: string) => {
    setComponentEditor(componentId ? { id: componentId } : {});
  }, []);

  const openRegisteredPanel = useCallback(
    (panelId: string) => {
      const panel = panels.get(panelId);
      if (!panel) return;
      setLayout((current) => openPanel(current, panelId, targetFor(panel)));
    },
    [panels, setLayout]
  );
  const setRegisteredPanelOpen = useCallback(
    (panelId: string, isOpen: boolean) => {
      const panel = panels.get(panelId);
      if (!panel) return;
      setLayout((current) => {
        const currentlyOpen = !current.hiddenPanelIds.includes(panelId);
        if (currentlyOpen === isOpen) return current;
        return isOpen ? openPanel(current, panelId, targetFor(panel)) : closePanel(current, panelId);
      });
    },
    [panels, setLayout]
  );
  const commands = useMemo(
    () =>
      new CommandRegistry([
        {
          id: "workbench.commandPalette",
          title: t("commandPalette.show"),
          category: t("commandPalette.categoryWorkbench"),
          keybinding: "⌘⇧P",
          execute: () => openCommandPalette()
        },
        {
          id: "workbench.resetLayout",
          title: t("commandPalette.resetLayout"),
          category: t("commandPalette.categoryWorkbench"),
          execute: resetLayout
        },
        {
          id: "studio.settings",
          title: t("commandPalette.openSettings"),
          category: t("commandPalette.categoryStudio"),
          execute: () => setSettingsOpen(true)
        },
        {
          id: "studio.export",
          title: t("commandPalette.exportRevision"),
          category: t("commandPalette.categoryDocument"),
          execute: () => setExportOpen(true)
        },
        {
          id: "studio.createComponent",
          title: t("componentWorkbench.create"),
          category: t("commandPalette.categoryStudio"),
          execute: () => openComponentWorkbench()
        },
        {
          id: "studio.theme.system",
          title: t("commandPalette.colorTheme", { theme: t("commandPalette.followSystemTheme") }),
          category: t("commandPalette.categoryPreferences"),
          execute: () => setThemeSelection(SYSTEM_THEME_SELECTION)
        },
        ...themes.map((colorTheme) => ({
          id: `studio.theme.${colorTheme.id}`,
          title: t("commandPalette.colorTheme", { theme: colorTheme.label }),
          category: t("commandPalette.categoryPreferences"),
          execute: () => setThemeSelection(colorTheme.id)
        })),
        ...localizedContributions.map((panel) => ({
          id: `workbench.open.${panel.id}`,
          title: t("commandPalette.openPanel", { panel: panel.title }),
          category: t("commandPalette.categoryView"),
          execute: () => openRegisteredPanel(panel.id)
        }))
      ]),
    [localizedContributions, openCommandPalette, openComponentWorkbench, openRegisteredPanel, resetLayout, setThemeSelection, t, themes]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        openCommandPalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCommandPalette]);
  const updateLayout = useCallback((next: WorkbenchLayoutState) => setLayout(next), [setLayout]);
  const panelButton = (panel: PanelContribution, side: "left" | "right" | "top") => {
    const selected = !layout.hiddenPanelIds.includes(panel.id);
    return (
      <span className={`tool-window-button${selected ? " is-active" : ""}`} key={panel.id}>
        <Tooltip content={panel.title} side={side}>
          <ToggleButton
            isSelected={selected}
            aria-controls={panelControlId(panel.id)}
            aria-label={t("navigation.togglePanel", { panel: panel.title })}
            onChange={(isSelected) => setRegisteredPanelOpen(panel.id, isSelected)}
          >
            {panel.icon}
          </ToggleButton>
        </Tooltip>
      </span>
    );
  };
  const primaryPanels = localizedContributions.filter(({ defaultLocation }) => defaultLocation === "primary");
  const secondaryPanels = localizedContributions.filter(({ defaultLocation }) => defaultLocation === "secondary");
  const bottomPanels = localizedContributions.filter(({ defaultLocation }) => defaultLocation === "bottom");
  const workbenchMessages = useMemo<WorkbenchMessages>(
    () => ({
      panelUnavailable: (panel) => t("workbench.panelUnavailable", { panel }),
      dockPanel: t("workbench.dockPanel"),
      dockPosition: (panel, position) =>
        t("workbench.dockPosition", { panel, position: t(DOCK_POSITION_KEYS[position]) }),
      maximizePanel: t("workbench.maximizePanel"),
      maximizePanelLabel: (panel) => t("workbench.maximizePanelLabel", { panel }),
      panelTabs: t("workbench.panelTabs"),
      closePanel: (panel) => t("workbench.closePanel", { panel }),
      resizePanels: t("workbench.resizePanels"),
      restoreLayout: t("workbench.restoreLayout"),
      restoreLayoutLabel: t("workbench.restoreLayoutLabel"),
      dockingHint: t("workbench.dockingHint")
    }),
    [t]
  );

  return (
    <StudioUiProvider locale={locale} colorScheme={activeTheme.uiTheme}>
      <ContextMenuProvider registry={contextMenuRegistry}>
        <ComponentWorkbenchNavigationProvider openComponentWorkbench={openComponentWorkbench}>
          <>
        <main
          className="studio-shell"
          inert={paletteOpen || componentEditor ? true : undefined}
          aria-hidden={componentEditor ? true : undefined}
        >
          <header className="main-toolbar">
            <div className="main-toolbar__start">
              <nav className="main-menu" aria-label={t("navigation.applicationMenu")}>
                <MenuButton
                  label={t("navigation.applicationMenu")}
                  trigger={<ProductIcon name="menu" />}
                  sections={[
                    {
                      id: "file",
                      label: t("navigation.file"),
                      actions: [
                        {
                          id: "export",
                          label: t("actions.exportRevision"),
                          onAction: () => setExportOpen(true)
                        }
                      ]
                    },
                    {
                      id: "edit",
                      label: t("navigation.edit"),
                      actions: [
                        {
                          id: "undo",
                          label: t("actions.undo"),
                          isDisabled: !session.canUndo,
                          onAction: () => void session.undo()
                        },
                        {
                          id: "redo",
                          label: t("actions.redo"),
                          isDisabled: !session.canRedo,
                          onAction: () => void session.redo()
                        }
                      ]
                    },
                    {
                      id: "view",
                      label: t("navigation.view"),
                      actions: [
                        ...localizedContributions
                          .filter(({ id }) => id !== "canvas")
                          .map((panel) => ({
                            id: `panel.${panel.id}`,
                            label: panel.title,
                            isSelected: !layout.hiddenPanelIds.includes(panel.id),
                            onAction: () => setRegisteredPanelOpen(panel.id, layout.hiddenPanelIds.includes(panel.id))
                          })),
                        {
                          id: "reset-layout",
                          label: t("actions.resetLayout"),
                          onAction: resetLayout
                        }
                      ]
                    }
                  ]}
                />
              </nav>
              <div className="app-mark">A</div>
              <div className="project-widget">
                <strong>{session.document?.name ?? "—"}</strong>
                <span>AGIDN Studio</span>
              </div>
            </div>
            <div className="main-toolbar__center">
              <div className="editor-context">
                <ProductIcon name="canvas" />
                <span>{t("navigation.canvas")}</span>
                <small>{session.document?.name ?? "—"}</small>
              </div>
            </div>
            <div className="main-toolbar__actions">
              <Button
                onHoverStart={() => void loadExportDialog()}
                onFocus={() => void loadExportDialog()}
                onPress={() => setExportOpen(true)}
              >
                <ProductIcon name="export" />
                {t("common.export")}
              </Button>
              <Tooltip content={t("commandPalette.searchTrigger")} side="bottom">
                <IconButton
                  ref={commandPaletteFallbackRef}
                  icon={<ProductIcon name="search" />}
                  label={t("navigation.openCommandPalette")}
                  onHoverStart={() => void loadCommandPalette()}
                  onFocus={() => void loadCommandPalette()}
                  onPress={() => openCommandPalette()}
                />
              </Tooltip>
              <Tooltip content={t("common.settings")} side="bottom">
                <IconButton
                  icon={<ProductIcon name="settings" />}
                  label={t("navigation.openSettings")}
                  onHoverStart={() => void loadSettingsDialog()}
                  onFocus={() => void loadSettingsDialog()}
                  onPress={() => setSettingsOpen(true)}
                />
              </Tooltip>
            </div>
          </header>
          <div className="studio-body">
            <nav className="activity-bar activity-bar--left" aria-label={t("navigation.projectToolWindows")}>
              <div className="activity-bar__top">{primaryPanels.map((panel) => panelButton(panel, "right"))}</div>
              <div className="activity-bar__bottom">{bottomPanels.map((panel) => panelButton(panel, "right"))}</div>
            </nav>
            <section className="studio-workbench" aria-label={t("navigation.studioWorkbench")}>
              <Workbench
                layout={layout}
                panels={panels}
                messages={workbenchMessages}
                renderToggleButton={renderWorkbenchToggleButton}
                onLayoutChange={updateLayout}
              />
            </section>
            <nav className="activity-bar activity-bar--right" aria-label={t("navigation.contentToolWindows")}>
              <div className="activity-bar__top">{secondaryPanels.map((panel) => panelButton(panel, "left"))}</div>
            </nav>
          </div>
          <footer className="statusbar">
            <div className="statusbar__context">
              <strong>{session.document?.name ?? "—"}</strong>
              <span>›</span>
              <span>{session.selectedNodeId ?? t("common.noSelection")}</span>
            </div>
            <div className="statusbar__widgets">
              <span
                className={`save-state save-state--${session.status}`}
                title={session.error ? format(session.error) : undefined}
              >
                <i />
                {session.status === "saving"
                  ? t("common.saving")
                  : session.status === "loading"
                    ? t("common.loading")
                    : session.status === "error"
                      ? t("common.attention")
                      : t("common.saved")}
              </span>
              <span>{t("common.revision", { revision: session.revision })}</span>
              <span>PageDocument 1.0.0</span>
            </div>
          </footer>
        </main>
        {componentEditor ? (
          <div className="component-workbench-layer">
            <ComponentWorkbench
              {...(componentEditor.id ? { componentId: componentEditor.id } : {})}
              onClose={() => setComponentEditor(null)}
              onSaved={(id) => setComponentEditor({ id })}
            />
          </div>
        ) : null}
        <Suspense fallback={null}>
          {paletteOpen ? (
            <CommandPalette
              commands={commands}
              locale={locale}
              colorScheme={activeTheme.uiTheme}
              open
              onClose={closeCommandPalette}
            />
          ) : null}
          {exportOpen ? (
            <ExportDialog locale={locale} colorScheme={activeTheme.uiTheme} onClose={() => setExportOpen(false)} />
          ) : null}
          {settingsOpen ? (
            <SettingsDialog
              locale={locale}
              themeSelection={themeSelection}
              activeTheme={activeTheme}
              themePlugins={themePlugins}
              themes={themes}
              onThemeChange={setThemeSelection}
              onClose={() => setSettingsOpen(false)}
            />
          ) : null}
        </Suspense>
          </>
        </ComponentWorkbenchNavigationProvider>
      </ContextMenuProvider>
    </StudioUiProvider>
  );
}

export function App() {
  return (
    <I18nProvider>
      <StudioSessionProvider>
        <TooltipProvider>
          <StudioApp />
        </TooltipProvider>
      </StudioSessionProvider>
    </I18nProvider>
  );
}
