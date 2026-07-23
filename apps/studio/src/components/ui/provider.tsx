import { Provider as SpectrumProvider } from "@react-spectrum/s2/Provider";
import type { ReactNode } from "react";
import type { StudioLocale } from "../../i18n.js";
import type { ThemeKind } from "../../themes/index.js";

export interface StudioUiProviderProps {
  children: ReactNode;
  locale: StudioLocale;
  colorScheme: ThemeKind;
  boundary?: "application" | "overlay";
}

export function StudioUiProvider({
  children,
  locale,
  colorScheme,
  boundary = "application"
}: StudioUiProviderProps) {
  return (
    <SpectrumProvider
      locale={locale}
      colorScheme={colorScheme}
      UNSAFE_className={boundary === "application" ? "studio-ui-root" : "studio-ui-overlay-root"}
    >
      {children}
    </SpectrumProvider>
  );
}
