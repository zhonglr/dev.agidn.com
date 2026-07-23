export const THEME_COLOR_KEYS = [
  "canvas.default",
  "canvas.inset",
  "canvas.overlay",
  "canvas.subtle",
  "border.default",
  "border.muted",
  "foreground.default",
  "foreground.muted",
  "foreground.subtle",
  "foreground.onEmphasis",
  "accent.foreground",
  "accent.emphasis",
  "accent.muted",
  "accent.subtle",
  "activity.activeBorder",
  "neutral.subtle",
  "neutral.muted",
  "success.foreground",
  "success.emphasis",
  "success.hover",
  "success.subtle",
  "attention.foreground",
  "attention.subtle",
  "danger.foreground",
  "danger.emphasis",
  "danger.subtle",
  "done.foreground",
  "done.subtle",
  "button.primary.background",
  "button.primary.hoverBackground",
  "button.primary.border",
  "backdrop",
  "shadow",
  "workspace.background",
  "workspace.grid"
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];
export type ThemeColors = Readonly<Record<ThemeColorKey, string>>;
export type ThemeKind = "light" | "dark";

export interface ThemeContribution {
  id: string;
  label: string;
  description?: string;
  uiTheme: ThemeKind;
  colors: ThemeColors;
}

export interface StudioThemePluginManifest {
  id: string;
  name: string;
  publisher: string;
  version: string;
  engines: { studio: string };
  contributes: { themes: readonly ThemeContribution[] };
}

export interface RegisteredTheme extends ThemeContribution {
  pluginId: string;
  pluginName: string;
  pluginPublisher: string;
  pluginVersion: string;
}

export interface ThemeRegistrySnapshot {
  plugins: readonly StudioThemePluginManifest[];
  themes: readonly RegisteredTheme[];
}

export interface StudioThemePluginApi {
  registerThemePlugin(plugin: StudioThemePluginManifest): () => void;
}

export const THEME_CSS_VARIABLES: Readonly<Record<ThemeColorKey, `--${string}`>> = {
  "canvas.default": "--canvas-default",
  "canvas.inset": "--canvas-inset",
  "canvas.overlay": "--canvas-overlay",
  "canvas.subtle": "--canvas-subtle",
  "border.default": "--border-default",
  "border.muted": "--border-muted",
  "foreground.default": "--fg-default",
  "foreground.muted": "--fg-muted",
  "foreground.subtle": "--fg-subtle",
  "foreground.onEmphasis": "--fg-on-emphasis",
  "accent.foreground": "--accent-fg",
  "accent.emphasis": "--accent-emphasis",
  "accent.muted": "--accent-muted",
  "accent.subtle": "--accent-subtle",
  "activity.activeBorder": "--active-indicator",
  "neutral.subtle": "--neutral-subtle",
  "neutral.muted": "--neutral-muted",
  "success.foreground": "--success-fg",
  "success.emphasis": "--success-emphasis",
  "success.hover": "--success-hover",
  "success.subtle": "--success-subtle",
  "attention.foreground": "--attention-fg",
  "attention.subtle": "--attention-subtle",
  "danger.foreground": "--danger-fg",
  "danger.emphasis": "--danger-emphasis",
  "danger.subtle": "--danger-subtle",
  "done.foreground": "--done-fg",
  "done.subtle": "--done-subtle",
  "button.primary.background": "--button-primary",
  "button.primary.hoverBackground": "--button-primary-hover",
  "button.primary.border": "--button-primary-border",
  backdrop: "--backdrop",
  shadow: "--shadow",
  "workspace.background": "--workspace",
  "workspace.grid": "--workspace-grid"
};
