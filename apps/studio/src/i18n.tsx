import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveStudioLocale, translate, type StudioLocale } from "./i18n/runtime.js";
import type { MessageDescriptor, Translate } from "./i18n/types.js";

export type { MessageDescriptor, MessageKey, MessageVariables, Translate } from "./i18n/types.js";
export type { StudioLocale } from "./i18n/runtime.js";

interface I18nValue { locale: StudioLocale; setLocale: (locale: StudioLocale) => void; t: Translate; format: (descriptor: MessageDescriptor) => string }
const I18nContext = createContext<I18nValue | undefined>(undefined);

function initialLocale(): StudioLocale {
  return resolveStudioLocale(
    window.__AGIDN_STUDIO_CONFIG__?.locale,
    import.meta.env.VITE_STUDIO_LOCALE,
    localStorage.getItem("agidn.studio.locale")
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<StudioLocale>(initialLocale);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale: (next) => { updateLocale(next); localStorage.setItem("agidn.studio.locale", next); document.documentElement.lang = next; },
    t: (key, variables) => translate(locale, key, variables),
    format: (descriptor) => translate(locale, descriptor.key, descriptor.variables)
  }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}
