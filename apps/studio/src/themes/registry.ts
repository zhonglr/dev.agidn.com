import { THEME_COLOR_KEYS, type RegisteredTheme, type StudioThemePluginManifest, type ThemeRegistrySnapshot } from "./types.js";

const identifierPattern = /^[a-z0-9][a-z0-9._-]*$/;

function assertIdentifier(value: string, field: string): void {
  if (!identifierPattern.test(value)) throw new Error(`Theme plugin ${field} '${value}' is not a valid identifier.`);
}
function validatePlugin(plugin: StudioThemePluginManifest): void {
  assertIdentifier(plugin.id, "id");
  if (!plugin.name.trim()) throw new Error(`Theme plugin '${plugin.id}' must have a name.`);
  if (!plugin.publisher.trim()) throw new Error(`Theme plugin '${plugin.id}' must have a publisher.`);
  if (!plugin.version.trim()) throw new Error(`Theme plugin '${plugin.id}' must have a version.`);
  if (!plugin.engines.studio.trim()) throw new Error(`Theme plugin '${plugin.id}' must declare engines.studio.`);
  if (plugin.contributes.themes.length === 0) throw new Error(`Theme plugin '${plugin.id}' must contribute at least one theme.`);
  const localThemeIds = new Set<string>();
  plugin.contributes.themes.forEach((theme) => {
    assertIdentifier(theme.id, "theme id");
    if (localThemeIds.has(theme.id)) throw new Error(`Theme '${theme.id}' is contributed more than once by '${plugin.id}'.`);
    localThemeIds.add(theme.id);
    if (!theme.label.trim()) throw new Error(`Theme '${theme.id}' must have a label.`);
    if (theme.uiTheme !== "light" && theme.uiTheme !== "dark") throw new Error(`Theme '${theme.id}' has an unsupported uiTheme.`);
    THEME_COLOR_KEYS.forEach((key) => {
      const value = (theme.colors as Readonly<Record<string, unknown>>)[key];
      if (typeof value !== "string" || !value.trim()) throw new Error(`Theme '${theme.id}' is missing color '${key}'.`);
    });
  });
}

export class ThemeRegistry {
  readonly #plugins = new Map<string, StudioThemePluginManifest>();
  readonly #themes = new Map<string, RegisteredTheme>();
  readonly #listeners = new Set<() => void>();
  #snapshot: ThemeRegistrySnapshot = { plugins: [], themes: [] };

  registerPlugin(plugin: StudioThemePluginManifest): () => void {
    validatePlugin(plugin);
    if (this.#plugins.has(plugin.id)) throw new Error(`Theme plugin '${plugin.id}' is already registered.`);
    plugin.contributes.themes.forEach((theme) => {
      if (this.#themes.has(theme.id)) throw new Error(`Theme '${theme.id}' is already registered.`);
    });

    const registeredThemes = plugin.contributes.themes.map<RegisteredTheme>((theme) => ({
      ...theme,
      pluginId: plugin.id,
      pluginName: plugin.name,
      pluginPublisher: plugin.publisher,
      pluginVersion: plugin.version
    }));
    this.#plugins.set(plugin.id, plugin);
    registeredThemes.forEach((theme) => this.#themes.set(theme.id, theme));
    this.#publish();

    return () => {
      if (!this.#plugins.delete(plugin.id)) return;
      registeredThemes.forEach((theme) => this.#themes.delete(theme.id));
      this.#publish();
    };
  }

  getTheme(id: string): RegisteredTheme | undefined { return this.#themes.get(id); }
  getSnapshot = (): ThemeRegistrySnapshot => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };

  #publish(): void {
    this.#snapshot = { plugins: [...this.#plugins.values()], themes: [...this.#themes.values()] };
    this.#listeners.forEach((listener) => listener());
  }
}
