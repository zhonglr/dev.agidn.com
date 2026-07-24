import type { StudioThemePluginManifest, ThemeColors } from "../types.js";

const lightColors: ThemeColors = {
  "canvas.default": "#ffffff",
  "canvas.inset": "#f8f8f8",
  "canvas.overlay": "#ffffff",
  "canvas.subtle": "#f3f3f3",
  "border.default": "#dadada",
  "border.muted": "#e1e1e1",
  "foreground.default": "#292929",
  "foreground.muted": "#505050",
  "foreground.subtle": "#717171",
  "foreground.onEmphasis": "#ffffff",
  "accent.foreground": "#274dea",
  "accent.emphasis": "#3b63fb",
  "accent.muted": "#c8d3fe",
  "accent.subtle": "#ebefff",
  "activity.activeBorder": "#3b63fb",
  "neutral.subtle": "#f3f3f3",
  "neutral.muted": "#e9e9e9",
  "success.foreground": "#05834e",
  "success.emphasis": "#079355",
  "success.hover": "#046c41",
  "success.subtle": "#d7f7e1",
  "attention.foreground": "#b84a00",
  "attention.subtle": "#ffecdf",
  "danger.foreground": "#d73220",
  "danger.emphasis": "#b72818",
  "danger.subtle": "#ffebe8",
  "done.foreground": "#05834e",
  "done.subtle": "#d7f7e1",
  "button.primary.background": "#3b63fb",
  "button.primary.hoverBackground": "#274dea",
  "button.primary.border": "#3b63fb",
  backdrop: "rgba(0, 0, 0, .44)",
  shadow: "rgba(0, 0, 0, .18)",
  "workspace.background": "#e9e9e9",
  "workspace.grid": "#dadada"
};

const darkColors: ThemeColors = {
  "canvas.default": "#111111",
  "canvas.inset": "#1b1b1b",
  "canvas.overlay": "#222222",
  "canvas.subtle": "#2c2c2c",
  "border.default": "#444444",
  "border.muted": "#323232",
  "foreground.default": "#dbdbdb",
  "foreground.muted": "#afafaf",
  "foreground.subtle": "#8a8a8a",
  "foreground.onEmphasis": "#ffffff",
  "accent.foreground": "#6995fe",
  "accent.emphasis": "#4069fd",
  "accent.muted": "#243054",
  "accent.subtle": "#181c29",
  "activity.activeBorder": "#5681ff",
  "neutral.subtle": "#2c2c2c",
  "neutral.muted": "#393939",
  "success.foreground": "#099d59",
  "success.emphasis": "#068850",
  "success.hover": "#0ba968",
  "success.subtle": "#003326",
  "attention.foreground": "#e06400",
  "attention.subtle": "#501b00",
  "danger.foreground": "#fc432e",
  "danger.emphasis": "#df3422",
  "danger.subtle": "#571107",
  "done.foreground": "#099d59",
  "done.subtle": "#003326",
  "button.primary.background": "#4069fd",
  "button.primary.hoverBackground": "#5681ff",
  "button.primary.border": "#4069fd",
  backdrop: "rgba(0, 0, 0, .6)",
  shadow: "rgba(0, 0, 0, .55)",
  "workspace.background": "#111111",
  "workspace.grid": "#323232"
};

export const builtinThemePlugin: StudioThemePluginManifest = {
  id: "agidn.builtin-themes",
  name: "Built-in Themes",
  publisher: "AGIDN",
  version: "2.0.0",
  engines: { studio: ">=0.1.0" },
  contributes: {
    themes: [
      {
        id: "light",
        label: "Light",
        description: "AGIDN Studio light color theme.",
        uiTheme: "light",
        colors: lightColors
      },
      { id: "dark", label: "Dark", description: "AGIDN Studio dark color theme.", uiTheme: "dark", colors: darkColors }
    ]
  }
};
