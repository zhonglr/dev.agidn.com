import { builtinThemePlugin } from "../../apps/studio/src/themes/plugins/builtin-themes.js";
import { ThemeRegistry } from "../../apps/studio/src/themes/registry.js";
import { DEFAULT_DARK_THEME_ID, normalizeThemeSelection, resolveTheme } from "../../apps/studio/src/themes/runtime.js";
import type { StudioThemePluginManifest } from "../../apps/studio/src/themes/types.js";

function relativeLuminance(color: string): number {
  const channels = color
    .slice(1)
    .match(/.{2}/g)
    ?.map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  if (!channels || channels.length !== 3) throw new Error(`Expected a six-digit hex color, received '${color}'.`);
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

describe("Studio color theme plugins", () => {
  it("registers Light and Dark as declarative built-in contributions", () => {
    const registry = new ThemeRegistry();
    registry.registerPlugin(builtinThemePlugin);

    expect(registry.getSnapshot().plugins.map(({ id }) => id)).toEqual(["agidn.builtin-themes"]);
    expect(registry.getSnapshot().themes.map(({ id }) => id)).toEqual(["light", "dark"]);
    expect(registry.getTheme(DEFAULT_DARK_THEME_ID)?.colors["canvas.default"]).toBe("#111111");
    expect(registry.getTheme(DEFAULT_DARK_THEME_ID)?.colors["foreground.default"]).toBe("#dbdbdb");
    expect(registry.getTheme(DEFAULT_DARK_THEME_ID)?.description).toBe("AGIDN Studio dark color theme.");
    expect(registry.getTheme(DEFAULT_DARK_THEME_ID)?.description).not.toMatch(/Spectrum/i);
  });

  it("keeps semantic foreground roles readable on every built-in canvas", () => {
    for (const theme of builtinThemePlugin.contributes.themes) {
      for (const role of [
        "foreground.default",
        "foreground.muted",
        "foreground.subtle",
        "accent.foreground",
        "success.foreground",
        "attention.foreground",
        "danger.foreground"
      ] as const) {
        expect(
          contrastRatio(theme.colors[role], theme.colors["canvas.default"]),
          `${theme.id}: ${role}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
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
