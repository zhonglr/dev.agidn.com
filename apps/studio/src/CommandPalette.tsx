import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ActionRegistry, RegisteredAction } from "@agidn/studio-workbench";
import { SearchField, StudioUiProvider } from "./components/ui/index.js";
import { useI18n, type StudioLocale } from "./i18n.js";
import { rankItems } from "./palette-ranking.js";
import type { ThemeKind } from "./themes/index.js";

const RECENT_STORAGE_KEY = "agidn.studio.palette.recent.v1";
const RECENT_LIMIT = 8;
const RESULT_LIMIT = 50;

export interface CommandPaletteProps {
  actions: ActionRegistry;
  isMac: boolean;
  locale: StudioLocale;
  colorScheme: ThemeKind;
  open: boolean;
  onClose: () => void;
}

interface PaletteSection {
  id: string;
  label: string;
  items: RegisteredAction[];
}

function loadRecentIds(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function storeRecentIds(ids: readonly string[]): void {
  globalThis.localStorage?.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids.slice(0, RECENT_LIMIT)));
}

function optionId(actionId: string): string {
  return `palette-option-${actionId}`;
}

export default function CommandPalette({ actions, isMac, locale, colorScheme, open, onClose }: CommandPaletteProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(loadRecentIds);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setRecentIds(loadRecentIds());
    }
  }, [open]);

  const sections = useMemo<PaletteSection[]>(() => {
    if (!open) return [];
    const enabled = actions.list().filter((action) => actions.isEnabled(action.id));
    if (query.trim()) {
      return [
        {
          id: "results",
          label: "",
          items: rankItems(enabled, query, recentIds).slice(0, RESULT_LIMIT)
        }
      ];
    }
    const recent = recentIds
      .map((id) => actions.get(id))
      .filter((action): action is RegisteredAction => Boolean(action) && actions.isEnabled(action!.id));
    const byCategory = new Map<string, RegisteredAction[]>();
    for (const action of enabled) {
      const category = action.category ?? t("commandPalette.defaultCategory");
      byCategory.set(category, [...(byCategory.get(category) ?? []), action]);
    }
    const grouped: PaletteSection[] = recent.length
      ? [{ id: "recent", label: t("commandPalette.recent"), items: recent }]
      : [];
    for (const [category, items] of byCategory) grouped.push({ id: category, label: category, items });
    return grouped;
  }, [actions, open, query, recentIds, t]);

  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const activeAction = flatItems[Math.min(activeIndex, flatItems.length - 1)];

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!activeAction || !listRef.current) return;
    listRef.current.querySelector(`#${CSS.escape(optionId(activeAction.id))}`)?.scrollIntoView({ block: "nearest" });
  }, [activeAction]);

  const runAction = useCallback(
    (action: RegisteredAction) => {
      if (!actions.isEnabled(action.id)) return;
      setRecentIds((current) => {
        const next = [action.id, ...current.filter((id) => id !== action.id)];
        storeRecentIds(next);
        return next;
      });
      onClose();
      void action.execute();
    },
    [actions, onClose]
  );

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        flatItems.length ? (current + delta + flatItems.length) % flatItems.length : 0
      );
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : Math.max(flatItems.length - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeAction) runAction(activeAction);
    }
  };

  if (!open) return null;

  let optionIndex = -1;
  return (
    <StudioUiProvider locale={locale} colorScheme={colorScheme} boundary="overlay">
      <div
        className="command-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {/* Focus stays inside the search input while arrows move the active option, so list navigation is handled at the dialog container. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <section
          className="command-palette"
          role="dialog"
          aria-modal="true"
          aria-label={t("commandPalette.label")}
          onKeyDown={onKeyDown}
        >
          <div className="command-search">
            <SearchField
              label={t("commandPalette.label")}
              size="M"
              isLabelHidden
              autoFocus
              value={query}
              onChange={setQuery}
              onEscape={onClose}
              placeholder={t("commandPalette.placeholder")}
              aria-controls="command-palette-list"
              {...(activeAction ? { "aria-activedescendant": optionId(activeAction.id) } : {})}
            />
          </div>
          <div className="command-list" id="command-palette-list" role="listbox" ref={listRef}>
            {flatItems.length === 0 ? (
              <p className="command-empty">{t("commandPalette.noMatches")}</p>
            ) : null}
            {sections.map((section) => (
              <div className="command-section" role="group" aria-label={section.label || undefined} key={section.id}>
                {section.label ? <p className="command-group">{section.label}</p> : null}
                {section.items.map((action) => {
                  optionIndex += 1;
                  const selected = optionIndex === activeIndex;
                  const keybinding = actions.formatKeybinding(action.id, isMac);
                  return (
                    <button
                      type="button"
                      id={optionId(action.id)}
                      role="option"
                      aria-selected={selected}
                      className={selected ? "is-selected" : ""}
                      key={action.id}
                      onMouseEnter={() => setActiveIndex(optionIndex)}
                      onClick={() => runAction(action)}
                    >
                      <span>
                        <small>{action.category ?? t("commandPalette.defaultCategory")}</small>
                        {action.title}
                      </span>
                      {keybinding ? <kbd>{keybinding}</kbd> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </div>
    </StudioUiProvider>
  );
}
