import { useEffect, useState } from "react";
import { restoreWorkbenchLayout, type PanelRegistry, type WorkbenchLayoutState } from "@agidn/studio-workbench";

const STORAGE_KEY = "agidn.studio.workbench.layout.v1";

export function useWorkbenchLayout(defaultLayout: WorkbenchLayoutState, panels: PanelRegistry) {
  const [layout, setLayout] = useState<WorkbenchLayoutState>(() => {
    const source = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!source) return defaultLayout;
    try {
      return restoreWorkbenchLayout(JSON.parse(source) as unknown, panels.list().map(({ id }) => id), defaultLayout);
    } catch {
      return defaultLayout;
    }
  });

  useEffect(() => {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  return { layout, setLayout, resetLayout: () => setLayout(structuredClone(defaultLayout)) };
}
