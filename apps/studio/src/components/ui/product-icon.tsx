import { createIcon } from "@react-spectrum/s2/Icon";
import type { ComponentType, ReactNode, SVGProps } from "react";

export type ProductIconName =
  | "outline"
  | "components"
  | "canvas"
  | "inspector"
  | "problems"
  | "history"
  | "commands"
  | "menu"
  | "search"
  | "settings"
  | "undo"
  | "redo"
  | "export"
  | "add"
  | "close";

const paths: Record<ProductIconName, ReactNode> = {
  outline: (
    <>
      <path d="M4 3.5h8v3H4zM4 9.5h8v3H4z" />
      <path d="M2 5h.01M2 11h.01" />
    </>
  ),
  components: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx=".7" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx=".7" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx=".7" />
      <rect x="9" y="9" width="4.5" height="4.5" rx=".7" />
    </>
  ),
  canvas: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1" />
      <path d="M5 1.8v2.4M11 1.8v2.4M5 11.8v2.4M11 11.8v2.4" />
    </>
  ),
  inspector: (
    <>
      <path d="M3 4h10M3 8h10M3 12h10" />
      <circle cx="6" cy="4" r="1" fill="var(--iconPrimary, currentColor)" />
      <circle cx="10" cy="8" r="1" fill="var(--iconPrimary, currentColor)" />
      <circle cx="7" cy="12" r="1" fill="var(--iconPrimary, currentColor)" />
    </>
  ),
  problems: (
    <>
      <path d="m8 2 6 11H2z" />
      <path d="M8 6v3M8 11h.01" />
    </>
  ),
  history: (
    <>
      <path d="M3 5H1V3" />
      <path d="M2 5a6 6 0 1 1 0 6M8 4.5V8l2.5 1.5" />
    </>
  ),
  commands: <path d="M5.5 5.5H4a2 2 0 1 1 2-2V12a2 2 0 1 1-2-2h8a2 2 0 1 1-2 2V4a2 2 0 1 1 2 2H5.5" />,
  menu: <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.2" />
      <path d="m10.2 10.2 3.3 3.3" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M12.4 3.6l-1 1M4.6 11.4l-1 1" />
    </>
  ),
  undo: (
    <>
      <path d="M6 4 2.5 7.5 6 11" />
      <path d="M3 7.5h6a4 4 0 0 1 4 4" />
    </>
  ),
  redo: (
    <>
      <path d="m10 4 3.5 3.5L10 11" />
      <path d="M13 7.5H7a4 4 0 0 0-4 4" />
    </>
  ),
  export: (
    <>
      <path d="M8 2v8M5 7l3 3 3-3" />
      <path d="M3 11v2h10v-2" />
    </>
  ),
  add: <path d="M8 2.5v11M2.5 8h11" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />
};

function spectrumIcon(name: ProductIconName) {
  const Glyph = (props: SVGProps<SVGSVGElement>) => (
    <svg
      {...props}
      viewBox="0 0 16 16"
      fill="none"
      stroke="var(--iconPrimary, currentColor)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
  return createIcon(Glyph);
}

const ICONS: Record<ProductIconName, ComponentType> = {
  outline: spectrumIcon("outline"),
  components: spectrumIcon("components"),
  canvas: spectrumIcon("canvas"),
  inspector: spectrumIcon("inspector"),
  problems: spectrumIcon("problems"),
  history: spectrumIcon("history"),
  commands: spectrumIcon("commands"),
  menu: spectrumIcon("menu"),
  search: spectrumIcon("search"),
  settings: spectrumIcon("settings"),
  undo: spectrumIcon("undo"),
  redo: spectrumIcon("redo"),
  export: spectrumIcon("export"),
  add: spectrumIcon("add"),
  close: spectrumIcon("close")
};

export function ProductIcon({ name }: { name: ProductIconName }) {
  const Icon = ICONS[name];
  return <Icon />;
}
