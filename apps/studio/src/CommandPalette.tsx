import { useEffect, useMemo, useState } from "react";
import type { CommandRegistry } from "@agidn/studio-workbench";
import { SearchField, StudioUiProvider } from "./components/ui/index.js";
import { useI18n, type StudioLocale } from "./i18n.js";
import type { ThemeKind } from "./themes/index.js";

export interface CommandPaletteProps {
  commands: CommandRegistry;
  locale: StudioLocale;
  colorScheme: ThemeKind;
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ commands, locale, colorScheme, open, onClose }: CommandPaletteProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return commands.list().filter((command) => !normalized || `${command.title} ${command.category ?? ""}`.toLowerCase().includes(normalized));
  }, [commands, query]);
  if (!open) return null;
  return (
    <StudioUiProvider locale={locale} colorScheme={colorScheme} boundary="overlay">
      <div className="command-backdrop" role="presentation" onMouseDown={onClose}>
        <section className="command-palette" role="dialog" aria-modal="true" aria-label={t("commandPalette.label")} onMouseDown={(event) => event.stopPropagation()}>
          <div className="command-search">
            <SearchField
              label={t("commandPalette.label")}
              isLabelHidden
              autoFocus
              value={query}
              onChange={setQuery}
              onEscape={onClose}
              placeholder={t("commandPalette.placeholder")}
            />
          </div>
          <div className="command-list">
            {matches.map((command, index) => (
              <button type="button" className={index === 0 ? "is-selected" : ""} key={command.id} onClick={() => { void commands.execute(command.id); onClose(); }}>
                <span><small>{command.category ?? t("commandPalette.defaultCategory")}</small>{command.title}</span>
                {command.keybinding ? <kbd>{command.keybinding}</kbd> : null}
              </button>
            ))}
          </div>
        </section>
      </div>
    </StudioUiProvider>
  );
}
