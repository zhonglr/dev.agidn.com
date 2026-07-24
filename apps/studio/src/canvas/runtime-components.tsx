import type { ElementType, ReactNode } from "react";
import type { RuntimeComponentProps, RuntimeComponentRegistry } from "@agidn/react-renderer";

function text(node: RuntimeComponentProps["node"], name: string, fallback = ""): string {
  const value = node.props?.[name];
  return typeof value === "string" ? value : fallback;
}

function content(slots: RuntimeComponentProps["slots"], name = "content"): ReactNode {
  return slots[name] ?? null;
}

const Button = ({ node, slots, style, hostProps, onEvent }: RuntimeComponentProps) => (
  <button {...hostProps} className={`ui-button ui-button--${node.variant ?? "primary"}`} style={style} disabled={node.props?.disabled === true} onClick={() => onEvent("press")}>
    {content(slots, "leadingIcon")}<span className="ui-button__content">{text(node, "label", "Button")}</span>{content(slots, "trailingIcon")}
  </button>
);

const Link = ({ node, style, hostProps, onEvent }: RuntimeComponentProps) => (
  <a {...hostProps} className={`ui-link ui-link--${node.variant ?? "default"}`} style={style} href={text(node, "href", "#")} onClick={() => onEvent("press")}>
    {text(node, "label", "Link")}
  </a>
);

const Heading = ({ node, style, hostProps }: RuntimeComponentProps) => {
  const level = typeof node.props?.level === "number" && node.props.level >= 1 && node.props.level <= 6 ? node.props.level : 2;
  const Tag = `h${level}` as ElementType;
  return <Tag {...hostProps} className={`ui-heading ui-heading--${node.variant ?? "title"}`} style={style}>{text(node, "text")}</Tag>;
};

const Text = ({ node, style, hostProps }: RuntimeComponentProps) => (
  <p {...hostProps} className={`ui-text ui-text--${node.variant ?? "body"}`} style={style}>{text(node, "text")}</p>
);

const Image = ({ node, style, hostProps }: RuntimeComponentProps) => (
  <div {...hostProps} className={`ui-image-frame ui-image-frame--${node.variant ?? "default"}`} style={style}>
    <img className="ui-image" src={text(node, "src")} alt={text(node, "alt")} />
  </div>
);

const Icon = ({ node, style, hostProps }: RuntimeComponentProps) => (
  <span {...hostProps} className={`ui-icon ui-icon--${node.variant ?? "default"}`} style={style} aria-hidden={node.accessibility?.decorative === true}>
    {text(node, "name") === "shield-check" ? "✓" : "•"}
  </span>
);

const Badge = ({ node, style, hostProps }: RuntimeComponentProps) => (
  <span {...hostProps} className={`ui-badge ui-badge--${node.variant ?? "default"}`} style={style}>{text(node, "label")}</span>
);

const Card = ({ node, slots, style, hostProps }: RuntimeComponentProps) => (
  <article {...hostProps} className={`ui-card ui-card--${node.variant ?? "default"}`} style={style}>{content(slots)}</article>
);

const Divider = ({ node, style, hostProps }: RuntimeComponentProps) => (
  <hr
    {...hostProps}
    className={`ui-divider ui-divider--${node.variant ?? "horizontal"}`}
    style={style}
    aria-orientation={node.variant === "vertical" ? "vertical" : "horizontal"}
  />
);

export const canvasComponentRegistry: RuntimeComponentRegistry = {
  Button,
  Link,
  Heading,
  Text,
  Image,
  Icon,
  Badge,
  Card,
  Divider
};
