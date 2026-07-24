import { THEME_COLOR_KEYS, THEME_CSS_VARIABLES, type RegisteredTheme } from "./types.js";
import type { ThemeRegistry } from "./registry.js";
import { studioStorage } from "../browser-storage.js";

export const SYSTEM_THEME_SELECTION = "system";
export const DEFAULT_LIGHT_THEME_ID = "light";
export const DEFAULT_DARK_THEME_ID = "dark";
export const THEME_STORAGE_KEY = "agidn.studio.v2.theme";

export interface SystemThemeDefaults {
  light: string;
  dark: string;
}

export function systemThemeDefaults(registry: ThemeRegistry): SystemThemeDefaults {
  const configuredLight = window.__AGIDN_STUDIO_CONFIG__?.preferredLightTheme;
  const configuredDark = window.__AGIDN_STUDIO_CONFIG__?.preferredDarkTheme;
  return {
    light: configuredLight && registry.getTheme(configuredLight)?.uiTheme === "light" ? configuredLight : DEFAULT_LIGHT_THEME_ID,
    dark: configuredDark && registry.getTheme(configuredDark)?.uiTheme === "dark" ? configuredDark : DEFAULT_DARK_THEME_ID
  };
}

export function normalizeThemeSelection(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : SYSTEM_THEME_SELECTION;
}

export function initialThemeSelection(): string {
  const configured = window.__AGIDN_STUDIO_CONFIG__?.theme ?? import.meta.env.VITE_STUDIO_THEME;
  const persisted = studioStorage.getItem(THEME_STORAGE_KEY);
  return normalizeThemeSelection(configured ?? persisted);
}

export function resolveTheme(
  registry: ThemeRegistry,
  selection: string,
  prefersLight: boolean,
  defaults: SystemThemeDefaults = systemThemeDefaults(registry)
): RegisteredTheme {
  const requestedId = selection === SYSTEM_THEME_SELECTION ? (prefersLight ? defaults.light : defaults.dark) : selection;
  const requested = registry.getTheme(requestedId);
  const fallback = registry.getTheme(prefersLight ? DEFAULT_LIGHT_THEME_ID : DEFAULT_DARK_THEME_ID);
  const finalFallback = registry.getSnapshot().themes[0];
  if (requested) return requested;
  if (fallback) return fallback;
  if (finalFallback) return finalFallback;
  throw new Error("No Studio color themes are registered.");
}

export function applyTheme(theme: RegisteredTheme, root: HTMLElement = document.documentElement): void {
  THEME_COLOR_KEYS.forEach((key) => root.style.setProperty(THEME_CSS_VARIABLES[key], theme.colors[key]));
  root.style.setProperty("--theme-color-scheme", theme.uiTheme);
  root.dataset.theme = theme.uiTheme;
  root.dataset.themeId = theme.id;
  root.dataset.themePlugin = theme.pluginId;
}
