# Studio color theme plugins

Studio color themes use a declarative contribution model similar to VS Code's `contributes.themes` extension point. Core UI CSS only consumes semantic custom properties; each plugin owns its theme metadata and complete color map.

The built-in `agidn.builtin-themes` plugin contributes:

- `light`
- `dark`

## Select and configure themes

Users can select an installed theme in **Studio settings → Editor appearance** or through the `Color Theme:` commands. The selection is persisted under `agidn.studio.v2.theme`.

Runtime configuration can supply defaults before Studio starts:

```js
window.__AGIDN_STUDIO_CONFIG__ = {
  theme: "system",
  preferredLightTheme: "light",
  preferredDarkTheme: "dark"
};
```

`VITE_STUDIO_THEME` can also set the initial selection. Explicit user selection remains available after startup.

## Contribute a plugin

A plugin implements `StudioThemePluginManifest` from `themes/types.ts`. Its manifest must have a unique plugin id, publisher/version metadata, an engine declaration, and one or more complete theme contributions.

Plugins bundled with Studio can be registered through `studioThemeRegistry.registerPlugin(plugin)`. Independently loaded bundles have two integration points:

```js
// Before the Studio bundle loads
window.__AGIDN_STUDIO_THEME_PLUGINS__ = [myThemePlugin];

// After Studio has started; returns an unregister function
const unregister = window.__AGIDN_STUDIO_THEME_API__
  .registerThemePlugin(myThemePlugin);
```

The registry rejects duplicate plugin/theme ids and themes missing required semantic colors. Runtime registration updates the Settings theme list immediately.

Theme colors are intentionally semantic (`canvas.default`, `foreground.muted`, `activity.activeBorder`, and so on), rather than tied to individual components. This keeps plugins compatible as the Studio layout evolves.
