import type { ElementType, ReactNode } from "react";
import type { RuntimeComponentProps, RuntimeComponentRegistry } from "@agidn/react-renderer";

function text(node: RuntimeComponentProps["node"], name: string, fallback = ""): string {
  const value = node.props?.[name];
  return typeof value === "string" ? value : fallback;
}

function content(slots: RuntimeComponentProps["slots"], name = "content"): ReactNode {
  return slots[name] ?? null;
}

const Button = ({ node, style, onEvent }: RuntimeComponentProps) => (
  <button className={`ui-button ui-button--${node.variant ?? "primary"}`} style={style} disabled={node.props?.disabled === true} onClick={() => onEvent("press")}>
    {text(node, "label", "Button")}
  </button>
);

const Link = ({ node, style, onEvent }: RuntimeComponentProps) => (
  <a className={`ui-link ui-link--${node.variant ?? "default"}`} style={style} href={text(node, "href", "#")} onClick={() => onEvent("press")}>
    {text(node, "label", "Link")}
  </a>
);

const Heading = ({ node, style }: RuntimeComponentProps) => {
  const level = typeof node.props?.level === "number" && node.props.level >= 1 && node.props.level <= 6 ? node.props.level : 2;
  const Tag = `h${level}` as ElementType;
  return <Tag className={`ui-heading ui-heading--${node.variant ?? "title"}`} style={style}>{text(node, "text")}</Tag>;
};

const Text = ({ node, style }: RuntimeComponentProps) => (
  <p className={`ui-text ui-text--${node.variant ?? "body"}`} style={style}>{text(node, "text")}</p>
);

const Image = ({ node, style }: RuntimeComponentProps) => (
  <div className="ui-image-frame" style={style}>
    <img className="ui-image" src={text(node, "src")} alt={text(node, "alt")} />
  </div>
);

const Icon = ({ node, style }: RuntimeComponentProps) => (
  <span className={`ui-icon ui-icon--${node.variant ?? "default"}`} style={style} aria-hidden={node.props?.decorative === true}>
    {text(node, "name") === "shield-check" ? "✓" : "•"}
  </span>
);

const Badge = ({ node, style }: RuntimeComponentProps) => (
  <span className={`ui-badge ui-badge--${node.variant ?? "default"}`} style={style}>{text(node, "label")}</span>
);

const Card = ({ node, slots, style }: RuntimeComponentProps) => (
  <article className={`ui-card ui-card--${node.variant ?? "default"}`} style={style}>{content(slots)}</article>
);

const Navigation = ({ node, slots, style }: RuntimeComponentProps) => (
  <nav className="ui-navigation" style={style} aria-label={text(node, "label", "Navigation")}>
    <a className="ui-brand" href="/">Acme<span>.</span></a>
    <div className="ui-navigation__items">{content(slots, "items")}</div>
    <a className="ui-navigation__login" href="/login">Log in</a>
  </nav>
);

const Container = ({ node, slots, style }: RuntimeComponentProps) => (
  <div className={`ui-container ui-container--${String(node.props?.width ?? "lg")}`} style={style}>{content(slots)}</div>
);

const Stack = ({ slots, style }: RuntimeComponentProps) => <div className="ui-stack" style={style}>{content(slots)}</div>;
const Row = ({ slots, style }: RuntimeComponentProps) => <div className="ui-row" style={style}>{content(slots)}</div>;
const Grid = ({ slots, style }: RuntimeComponentProps) => <div className="ui-grid" style={style}>{content(slots)}</div>;

const PricingCard = ({ node, slots, style }: RuntimeComponentProps) => (
  <article className={`ui-pricing-card ui-pricing-card--${node.variant ?? "default"}`} style={style}>
    <div className="ui-pricing-card__badge">{content(slots, "badge")}</div>
    <p className="ui-pricing-card__eyebrow">{text(node, "planName")}</p>
    <p className="ui-pricing-card__price">{text(node, "price")}<span>{text(node, "price").startsWith("$") && text(node, "price") !== "$0" ? "/month" : ""}</span></p>
    <div className="ui-pricing-card__description">{content(slots, "description")}</div>
    <div className="ui-pricing-card__action">{content(slots, "action")}</div>
    <div className="ui-pricing-card__features"><span className="ui-check">✓</span>{content(slots, "features")}</div>
  </article>
);

const FAQItem = ({ node, style }: RuntimeComponentProps) => (
  <details className="ui-faq" style={style}>
    <summary>{text(node, "question")}</summary>
    <p>{text(node, "answer")}</p>
  </details>
);

export const previewComponentRegistry: RuntimeComponentRegistry = {
  Button,
  Link,
  Heading,
  Text,
  Image,
  Icon,
  Badge,
  Card,
  Navigation,
  Container,
  Stack,
  Row,
  Grid,
  PricingCard,
  FAQItem
};
