import type { StudioLocale } from "./i18n.js";

export type LocalizedLabel = string | Readonly<Record<string, string>> | undefined;

export function humanizeIdentifier(value: string): string {
  return value
    .replaceAll(/[._:-]+/g, " ")
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function displayLabel(label: LocalizedLabel, fallbackIdentifier: string, locale: StudioLocale): string {
  if (typeof label === "string") return label;
  if (label) return label[locale] ?? label[locale.split("-")[0]!] ?? label["en-US"] ?? Object.values(label)[0] ?? humanizeIdentifier(fallbackIdentifier);
  return humanizeIdentifier(fallbackIdentifier);
}
