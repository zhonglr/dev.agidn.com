/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STUDIO_LOCALE?: string;
  readonly VITE_STUDIO_THEME?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
interface Window {
  __AGIDN_STUDIO_CONFIG__?: {
    locale?: "en-US" | "zh-CN";
    theme?: string;
    preferredLightTheme?: string;
    preferredDarkTheme?: string;
  };
  __AGIDN_STUDIO_THEME_PLUGINS__?: readonly import("./themes/types.js").StudioThemePluginManifest[];
  __AGIDN_STUDIO_THEME_API__?: import("./themes/types.js").StudioThemePluginApi;
}
