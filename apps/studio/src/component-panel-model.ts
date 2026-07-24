import type { GetCatalogResponse } from "@agidn/api-protocol";
import { displayLabel } from "./display-label.js";
import type { StudioLocale } from "./i18n.js";

type ComponentDefinition =
  GetCatalogResponse["components"]["components"][string];
type ComponentPreset = ComponentDefinition["editor"]["presets"][string];

export interface ComponentPanelEntry {
  component: ComponentDefinition;
  preset?: ComponentPreset;
  presetId?: string;
}

export function componentPanelEntries(
  catalog: GetCatalogResponse | undefined
): ComponentPanelEntry[] {
  if (!catalog) return [];
  return Object.values(catalog.components.components).flatMap((component) => {
    const presets = Object.entries(component.editor.presets);
    if (presets.length === 0) return [{ component }];
    return presets.map(([presetId, preset]) => ({
      component,
      preset,
      presetId
    }));
  });
}

export function filterComponentPanelEntries(
  entries: readonly ComponentPanelEntry[],
  query: string,
  locale: StudioLocale
): ComponentPanelEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  if (!normalizedQuery) return [...entries];
  return entries.filter(({ component, preset, presetId }) =>
    [
      component.name,
      displayLabel(component.displayName, component.name, locale),
      displayLabel(component.description, "", locale),
      component.source,
      component.category,
      component.editor.icon,
      ...component.editor.keywords,
      ...component.roles,
      presetId,
      preset ? displayLabel(preset.displayName, presetId ?? "", locale) : undefined
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLocaleLowerCase(locale)
      .includes(normalizedQuery)
  );
}
