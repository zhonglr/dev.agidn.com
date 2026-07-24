import Add from "@react-spectrum/s2/icons/Add";
import AlertTriangle from "@react-spectrum/s2/icons/AlertTriangle";
import Apps from "@react-spectrum/s2/icons/Apps";
import Artboard from "@react-spectrum/s2/icons/Artboard";
import Circle from "@react-spectrum/s2/icons/Circle";
import Close from "@react-spectrum/s2/icons/Close";
import Code from "@react-spectrum/s2/icons/Code";
import Collection from "@react-spectrum/s2/icons/Collection";
import DistributeSpaceHorizontally from "@react-spectrum/s2/icons/DistributeSpaceHorizontally";
import Export from "@react-spectrum/s2/icons/Export";
import History from "@react-spectrum/s2/icons/History";
import Image from "@react-spectrum/s2/icons/Image";
import Link from "@react-spectrum/s2/icons/Link";
import MenuHamburger from "@react-spectrum/s2/icons/MenuHamburger";
import Properties from "@react-spectrum/s2/icons/Properties";
import RadioButton from "@react-spectrum/s2/icons/RadioButton";
import RectangleHoriz from "@react-spectrum/s2/icons/RectangleHoriz";
import Redo from "@react-spectrum/s2/icons/Redo";
import Search from "@react-spectrum/s2/icons/Search";
import Settings from "@react-spectrum/s2/icons/Settings";
import SelectRectangle from "@react-spectrum/s2/icons/SelectRectangle";
import Tag from "@react-spectrum/s2/icons/Tag";
import TextParagraph from "@react-spectrum/s2/icons/TextParagraph";
import TextSize from "@react-spectrum/s2/icons/TextSize";
import Undo from "@react-spectrum/s2/icons/Undo";
import ViewGrid from "@react-spectrum/s2/icons/ViewGrid";
import ViewList from "@react-spectrum/s2/icons/ViewList";
import ViewTransparency from "@react-spectrum/s2/icons/ViewTransparency";
import type { ReactNode } from "react";

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
  | "close"
  | "button"
  | "link"
  | "heading"
  | "text"
  | "image"
  | "icon"
  | "badge"
  | "card"
  | "divider"
  | "pattern"
  | "layout-section"
  | "layout-container"
  | "layout-stack"
  | "layout-row"
  | "layout-grid"
  | "layout-overlay";

type SpectrumIcon = (props: Record<string, never>) => ReactNode;

const ICONS = {
  outline: ViewList,
  components: Apps,
  canvas: Artboard,
  inspector: Properties,
  problems: AlertTriangle,
  history: History,
  commands: Code,
  menu: MenuHamburger,
  search: Search,
  settings: Settings,
  undo: Undo,
  redo: Redo,
  export: Export,
  add: Add,
  close: Close,
  button: RadioButton,
  link: Link,
  heading: TextSize,
  text: TextParagraph,
  image: Image,
  icon: Circle,
  badge: Tag,
  card: RectangleHoriz,
  divider: DistributeSpaceHorizontally,
  pattern: ViewGrid,
  "layout-section": Collection,
  "layout-container": SelectRectangle,
  "layout-stack": ViewList,
  "layout-row": DistributeSpaceHorizontally,
  "layout-grid": ViewGrid,
  "layout-overlay": ViewTransparency
} as unknown as Record<ProductIconName, SpectrumIcon>;

export function ProductIcon({ name }: { name: ProductIconName }) {
  const Icon = ICONS[name];
  return <Icon />;
}

const CATALOG_ICON_ALIASES: Readonly<Record<string, ProductIconName>> = {
  button: "button",
  link: "link",
  heading: "heading",
  text: "text",
  image: "image",
  icon: "icon",
  badge: "badge",
  card: "card",
  divider: "divider",
  pattern: "pattern",
  "layout-section": "layout-section",
  "layout-container": "layout-container",
  "layout-stack": "layout-stack",
  "layout-row": "layout-row",
  "layout-grid": "layout-grid",
  "layout-overlay": "layout-overlay"
};

export function CatalogIcon({ name }: { name: string }) {
  return <ProductIcon name={CATALOG_ICON_ALIASES[name] ?? "components"} />;
}
