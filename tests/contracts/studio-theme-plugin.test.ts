import { builtinThemePlugin } from "../../apps/studio/src/themes/plugins/builtin-themes.js";
import { ThemeRegistry } from "../../apps/studio/src/themes/registry.js";
import { DEFAULT_DARK_THEME_ID, normalizeThemeSelection, resolveTheme } from "../../apps/studio/src/themes/runtime.js";
import type { StudioThemePluginManifest } from "../../apps/studio/src/themes/types.js";

describe("Studio color theme plugins", () => {
  it("registers Light and Dark as declarative built-in contributions", () => {
    const registry = new ThemeRegistry();
    registry.registerPlugin(builtinThemePlugin);

    expect(registry.getSnapshot().plugins.map(({ id }) => id)).toEqual(["agidn.builtin-themes"]);
    expect(registry.getSnapshot().themes.map(({ id }) => id)).toEqual(["light", "dark"]);
    expect(registry.getTheme(DEFAULT_DARK_THEME_ID)?.colors["canvas.default"]).toBe("#22272e");
    expect(registry.getTheme(DEFAULT_DARK_THEME_ID)?.colors["foreground.default"]).toBe("#adbac7");
  });

  it("resolves system dark mode to Dark and migrates the old branded id", () => {
    const registry = new ThemeRegistry();
    registry.registerPlugin(builtinThemePlugin);

    expect(normalizeThemeSelection("github-dark-dimmed")).toBe("dark");
    expect(resolveTheme(registry, "system", false, { light: "light", dark: "dark" }).id).toBe("dark");
  });

  it("rejects duplicate contributions and incomplete external manifests", () => {
    const registry = new ThemeRegistry();
    registry.registerPlugin(builtinThemePlugin);
    expect(() => registry.registerPlugin(builtinThemePlugin)).toThrow("already registered");

    const incomplete = {
      id: "example.incomplete",
      name: "Incomplete",
      publisher: "Example",
      version: "1.0.0",
      engines: { studio: ">=0.1.0" },
      contributes: { themes: [{ id: "example-dark", label: "Example Dark", uiTheme: "dark", colors: {} }] }
    } as unknown as StudioThemePluginManifest;
    expect(() => new ThemeRegistry().registerPlugin(incomplete)).toThrow("missing color 'canvas.default'");
  });

  it("unregisters all themes contributed by a runtime plugin", () => {
    const registry = new ThemeRegistry();
    const unregister = registry.registerPlugin(builtinThemePlugin);
    unregister();
    expect(registry.getSnapshot()).toEqual({ plugins: [], themes: [] });
  });
});
