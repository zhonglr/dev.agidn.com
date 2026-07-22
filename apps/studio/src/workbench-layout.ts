import { WORKBENCH_LAYOUT_VERSION, type WorkbenchLayoutState } from "@agidn/studio-workbench";

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutState = {
  version: WORKBENCH_LAYOUT_VERSION,
  hiddenPanelIds: [],
  root: {
    type: "split",
    id: "split.root",
    direction: "horizontal",
    sizes: [0.19, 0.6, 0.21],
    children: [
      {
        type: "tabs",
        id: "tabs.primary",
        activePanelId: "page-outline",
        panelIds: ["page-outline", "components"]
      },
      {
        type: "split",
        id: "split.center",
        direction: "vertical",
        sizes: [0.76, 0.24],
        children: [
          { type: "panel", id: "panel.canvas", panelId: "canvas" },
          {
            type: "tabs",
            id: "tabs.bottom",
            activePanelId: "problems",
            panelIds: ["problems", "history"]
          }
        ]
      },
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
  secondary: "tabs.secondary",
  bottom: "tabs.bottom",
  center: "tabs.primary"
} as const;
