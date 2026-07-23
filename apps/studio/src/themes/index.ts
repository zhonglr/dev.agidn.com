import { ThemeRegistry } from "./registry.js";
import { builtinThemePlugin } from "./plugins/builtin-themes.js";
import { applyTheme, initialThemeSelection, resolveTheme, systemThemeDefaults } from "./runtime.js";
import type { StudioThemePluginManifest } from "./types.js";

export * from "./types.js";
export * from "./runtime.js";
export { ThemeRegistry } from "./registry.js";

export const studioThemeRegistry = new ThemeRegistry();
studioThemeRegistry.registerPlugin(builtinThemePlugin);

function registerExternalPlugin(plugin: StudioThemePluginManifest): void {
  try { studioThemeRegistry.registerPlugin(plugin); }
  catch (error) { console.error("Unable to register Studio theme plugin.", error); }
}

window.__AGIDN_STUDIO_THEME_PLUGINS__?.forEach(registerExternalPlugin);
window.__AGIDN_STUDIO_THEME_API__ = { registerThemePlugin: (plugin) => studioThemeRegistry.registerPlugin(plugin) };

export function initializeStudioTheme(): void {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  applyTheme(resolveTheme(studioThemeRegistry, initialThemeSelection(), media.matches, systemThemeDefaults(studioThemeRegistry)));
}
