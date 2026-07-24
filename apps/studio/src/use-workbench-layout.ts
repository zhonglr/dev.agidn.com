import { useEffect, useState } from "react";
import {
  restoreWorkbenchLayout,
  type PanelRegistry,
  type WorkbenchLayoutState
} from "@agidn/studio-workbench";
import { studioStorage } from "./browser-storage.js";

const STORAGE_KEY = "agidn.studio.v2.workbench-layout";

export function useWorkbenchLayout(defaultLayout: WorkbenchLayoutState, panels: PanelRegistry) {
  const [layout, setLayout] = useState<WorkbenchLayoutState>(() => {
    const source = studioStorage.getItem(STORAGE_KEY);
    if (!source) return defaultLayout;
    try {
      return restoreWorkbenchLayout(
        JSON.parse(source) as unknown,
        panels.list().map(({ id }) => id),
        defaultLayout
      );
    } catch {
      return defaultLayout;
    }
  });

  useEffect(() => {
    studioStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  return { layout, setLayout, resetLayout: () => setLayout(structuredClone(defaultLayout)) };
}
