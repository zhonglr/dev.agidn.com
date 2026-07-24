import { useMemo } from "react";
import { useI18n, type StudioLocale } from "../../i18n.js";
import { useStudioSession } from "../../studio-session.js";
import {
  SYSTEM_THEME_SELECTION,
  type RegisteredTheme,
  type StudioThemePluginManifest
} from "../../themes/index.js";
import { Dialog, Select, StudioUiProvider, type SelectOption } from "../ui/index.js";

export interface SettingsDialogProps {
  locale: StudioLocale;
  themeSelection: string;
  activeTheme: RegisteredTheme;
  themePlugins: readonly StudioThemePluginManifest[];
  themes: readonly RegisteredTheme[];
  onThemeChange: (theme: string) => void;
  onClose: () => void;
}

const LANGUAGE_OPTIONS: readonly SelectOption[] = [
  { id: "en-US", label: "English" },
  { id: "zh-CN", label: "简体中文" }
];

export default function SettingsDialog({
  locale,
  themeSelection,
  activeTheme,
  themePlugins,
  themes,
  onThemeChange,
  onClose
}: SettingsDialogProps) {
  const session = useStudioSession();
  const { setLocale, t } = useI18n();
  const components = Object.values(session.catalog?.components.components ?? {});
  const tokens = Object.entries(session.catalog?.tokens.tokens ?? {});
  const themeOptions = useMemo<readonly SelectOption[]>(() => [
    { id: SYSTEM_THEME_SELECTION, label: `${t("settings.followSystem")} — ${activeTheme.label}` },
    ...themes.map((theme) => ({ id: theme.id, label: theme.label }))
  ], [activeTheme.label, t, themes]);

  return (
    <StudioUiProvider locale={locale} colorScheme={activeTheme.uiTheme} boundary="overlay">
      <Dialog isOpen title={t("common.settings")} onDismiss={onClose} size="large">
        <div className="settings-content">
          <section>
            <h3>{t("settings.languageAndAppearance")}</h3>
            <div className="settings-select">
              <Select
                label={t("settings.language")}
                options={LANGUAGE_OPTIONS}
                selectedKey={locale}
                onSelectionChange={(key) => setLocale(key as StudioLocale)}
              />
            </div>
            <div className="settings-select">
              <Select
                label={t("settings.appearance")}
                options={themeOptions}
                selectedKey={themeSelection}
                onSelectionChange={onThemeChange}
              />
            </div>
            <p className="settings-theme-description">{t("settings.themeSummary", {
              theme: activeTheme.label,
              publisher: activeTheme.pluginPublisher,
              version: activeTheme.pluginVersion,
              themes: themes.length,
              plugins: themePlugins.length
            })}</p>
            <p>{t("settings.distributionHint")}</p>
          </section>
          <section>
            <h3>{t("settings.workspace")}</h3>
            <div className="settings-status">
              <i className={session.status === "error" ? "is-error" : "is-online"} />
              <div>
                <strong>{session.status === "error" ? t("settings.connectionAttention") : t("settings.connected")}</strong>
                <span>{t("settings.workspaceRevision", { revision: session.revision })}</span>
              </div>
            </div>
          </section>
          <section>
            <h3>{t("settings.tokenBrowser")} <small>{t("common.readOnly")}</small></h3>
            <div className="settings-browser">{tokens.map(([name, token]) => (
              <div key={name}><code>{name}</code><span>{token.type} · {token.value}</span></div>
            ))}</div>
          </section>
          <section>
            <h3>{t("settings.componentRegistry")} <small>{t("common.readOnly")}</small></h3>
            <div className="settings-browser">{components.map((component) => (
              <div key={component.name}>
                <strong>{component.name}</strong>
                <span>{component.source} · {t("settings.variantCount", { count: Object.keys(component.variants).length })}</span>
              </div>
            ))}</div>
          </section>
        </div>
      </Dialog>
    </StudioUiProvider>
  );
}
