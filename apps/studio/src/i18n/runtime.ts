import { enUS } from "./en-US.js";
import type { MessageCatalog, MessageKey, MessageVariables } from "./types.js";
import { zhCN } from "./zh-CN.js";

export const STUDIO_LOCALES = ["en-US", "zh-CN"] as const;
export type StudioLocale = (typeof STUDIO_LOCALES)[number];

export const catalogs: Readonly<Record<StudioLocale, MessageCatalog>> = {
  "en-US": enUS,
  "zh-CN": zhCN
};

export function isStudioLocale(value: unknown): value is StudioLocale {
  return typeof value === "string" && STUDIO_LOCALES.includes(value as StudioLocale);
}

export function resolveStudioLocale(...candidates: readonly unknown[]): StudioLocale {
  return candidates.find(isStudioLocale) as StudioLocale | undefined ?? "en-US";
}

function lookup(catalog: MessageCatalog, key: MessageKey): string | undefined {
  let value: unknown = catalog;
  for (const segment of key.split(".")) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Readonly<Record<string, unknown>>)[segment];
  }
  return typeof value === "string" ? value : undefined;
}

export function translate(locale: StudioLocale, key: MessageKey, variables?: MessageVariables): string {
  const template = lookup(catalogs[locale], key) ?? lookup(catalogs["en-US"], key) ?? key;
  return variables
    ? template.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) => name in variables ? String(variables[name]) : placeholder)
    : template;
}

export function catalogLeafKeys(catalog: MessageCatalog): string[] {
  const result: string[] = [];
  const visit = (value: unknown, prefix: string): void => {
    if (typeof value === "string") { result.push(prefix); return; }
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, child]) => visit(child, prefix ? `${prefix}.${key}` : key));
  };
  visit(catalog, "");
  return result.sort();
}
