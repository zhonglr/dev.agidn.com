import { useEffect, useState } from "react";
import {
  restoreWorkbenchLayout,
  type PanelRegistry,
  type WorkbenchLayoutState
} from "@agidn/studio-workbench";

const STORAGE_KEY = "agidn.studio.workbench.layout.v3";
const PREVIOUS_STORAGE_KEY = "agidn.studio.workbench.layout.v2";

function migratePrimaryPanels(layout: WorkbenchLayoutState): WorkbenchLayoutState {
  const root = layout.root;
  if (root.type !== "split" || root.direction !== "horizontal") return layout;
  const index = root.children.findIndex(
    (node) =>
      node.type === "tabs" &&
      node.id === "tabs.primary" &&
      node.panelIds.includes("page-outline") &&
      node.panelIds.includes("components")
  );
  if (index < 0) return layout;
  const primary = root.children[index];
  if (!primary || primary.type !== "tabs") return layout;
  const size = root.sizes[index] ?? 0.32;
  return {
    ...layout,
    root: {
      ...root,
      children: [
        ...root.children.slice(0, index),
        {
          ...primary,
          activePanelId: "page-outline",
          panelIds: primary.panelIds.filter((panelId) => panelId !== "components")
        },
        {
          type: "tabs",
          id: "tabs.components",
          activePanelId: "components",
          panelIds: ["components"]
        },
        ...root.children.slice(index + 1)
      ],
      sizes: [
        ...root.sizes.slice(0, index),
        size / 2,
        size / 2,
        ...root.sizes.slice(index + 1)
      ]
    }
  };
}

export function useWorkbenchLayout(defaultLayout: WorkbenchLayoutState, panels: PanelRegistry) {
  const [layout, setLayout] = useState<WorkbenchLayoutState>(() => {
    const currentSource = globalThis.localStorage?.getItem(STORAGE_KEY);
    const source = currentSource ?? globalThis.localStorage?.getItem(PREVIOUS_STORAGE_KEY);
    if (!source) return defaultLayout;
    try {
      const restored = restoreWorkbenchLayout(
        JSON.parse(source) as unknown,
        panels.list().map(({ id }) => id),
        defaultLayout
      );
      return currentSource ? restored : migratePrimaryPanels(restored);
    } catch {
      return defaultLayout;
    }
  });

  useEffect(() => {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  return { layout, setLayout, resetLayout: () => setLayout(structuredClone(defaultLayout)) };
}
