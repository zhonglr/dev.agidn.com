import { WORKBENCH_LAYOUT_VERSION, type WorkbenchLayoutState } from "@agidn/studio-workbench";

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutState = {
  version: WORKBENCH_LAYOUT_VERSION,
  hiddenPanelIds: ["problems", "history"],
  root: {
    type: "split",
    id: "split.root",
    direction: "horizontal",
    sizes: [0.16, 0.16, 0.48, 0.2],
    children: [
      {
        type: "tabs",
        id: "tabs.primary",
        activePanelId: "page-outline",
        panelIds: ["page-outline"]
      },
      {
        type: "tabs",
        id: "tabs.components",
        activePanelId: "components",
        panelIds: ["components"]
      },
      { type: "panel", id: "panel.canvas", panelId: "canvas" },
      {
        type: "tabs",
        id: "tabs.secondary",
        activePanelId: "inspector",
        panelIds: ["inspector"]
      }
    ]
  }
};

export const PANEL_TARGETS = {
  primary: "tabs.primary",
  components: "tabs.components",
  secondary: "tabs.secondary",
  bottom: "tabs.bottom",
  center: "tabs.primary"
} as const;
