import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { studioThemeRegistry } from "./index.js";
import {
  applyTheme,
  initialThemeSelection,
  resolveTheme,
  SYSTEM_THEME_SELECTION,
  systemThemeDefaults,
  THEME_STORAGE_KEY
} from "./runtime.js";
import type { RegisteredTheme, StudioThemePluginManifest } from "./types.js";

export interface StudioThemeState {
  selection: string;
  setSelection: (selection: string) => void;
  activeTheme: RegisteredTheme;
  plugins: readonly StudioThemePluginManifest[];
  themes: readonly RegisteredTheme[];
}
export function useStudioTheme(): StudioThemeState {
  const snapshot = useSyncExternalStore(studioThemeRegistry.subscribe, studioThemeRegistry.getSnapshot);
  const [selection, setSelection] = useState(initialThemeSelection);
  const [prefersLight, setPrefersLight] = useState(() => window.matchMedia("(prefers-color-scheme: light)").matches);
  const defaults = useMemo(() => systemThemeDefaults(studioThemeRegistry), [snapshot]);
  const activeTheme = useMemo(
    () => resolveTheme(studioThemeRegistry, selection, prefersLight, defaults),
    [defaults, prefersLight, selection, snapshot]
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = (): void => setPrefersLight(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    applyTheme(activeTheme);
    document.documentElement.dataset.themeChoice = selection;
    localStorage.setItem(THEME_STORAGE_KEY, selection);
  }, [activeTheme, selection]);

  return {
    selection: snapshot.themes.some(({ id }) => id === selection) || selection === SYSTEM_THEME_SELECTION ? selection : SYSTEM_THEME_SELECTION,
    setSelection,
    activeTheme,
    plugins: snapshot.plugins,
    themes: snapshot.themes
  };
}
