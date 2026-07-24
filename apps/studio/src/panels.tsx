import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction
} from "react";
import type { GetCatalogResponse } from "@agidn/api-protocol";
import type {
  Accessibility,
  Interaction,
  PageDocument,
  PageNode,
  Placement,
  Visibility
} from "@agidn/document-schema";
import { useStudioSession } from "./studio-session.js";
import {
  COMPONENT_DRAG_MIME,
  LAYOUT_DRAG_MIME,
  NODE_DRAG_MIME,
  PATTERN_DRAG_MIME,
  resolveInsertSourcesTarget,
  resolveMoveTarget,
  resolveSiblingMove,
  type StructureDragErrorCode
} from "./structure-drag.js";
import { insertSourcesForPayload } from "./insert-source.js";
import { LAYOUT_KINDS, type LayoutKind } from "./layout-node-factory.js";
import { displayLabel } from "./display-label.js";
import { useI18n, type MessageKey } from "./i18n.js";
import { translateStructureDragError } from "./i18n/structure-drag.js";
import {
  ActionButton,
  AlertDialog,
  CatalogIcon,
  Checkbox,
  useContextMenu,
  Disclosure,
  IconButton,
  NumberField,
  ProductIcon,
  SearchField,
  Select,
  TextArea,
  TextField,
  type SelectOption
} from "./components/ui/index.js";
import {
  componentPanelEntries,
  filterComponentPanelEntries
} from "./component-panel-model.js";

const CATEGORY_KEYS: Readonly<Record<string, MessageKey>> = {
  action: "components.categoryActions",
  typography: "components.categoryTypography",
  media: "components.categoryMedia",
  surface: "components.categoryContent",
  composite: "components.categoryOther",
  other: "components.categoryOther"
};

const COMMAND_KEYS: Readonly<Record<string, MessageKey>> = {
  "node.insert": "history.commandInsert",
  "node.move": "history.commandMove",
  "node.remove": "history.commandRemove",
  "node.setLayoutProperty": "history.commandSetLayoutProperty",
  "node.setProp": "history.commandSetProp",
  "node.setVariant": "history.commandSetVariant",
  "node.setStyleBinding": "history.commandSetStyleBinding",
  "node.setResponsivePolicy": "history.commandSetResponsivePolicy",
  "node.setRole": "history.commandSetRole",
  "node.setName": "history.commandSetName",
  "node.setPlacement": "history.commandSetPlacement",
  "node.setVisibility": "history.commandSetVisibility",
  "node.setAccessibility": "history.commandSetAccessibility",
  "node.setInteractions": "history.commandSetInteractions"
};

const LAYOUT_LABEL_KEYS: Readonly<Record<LayoutKind, MessageKey>> = {
  section: "components.layoutSection",
  container: "components.layoutContainer",
  stack: "components.layoutStack",
  row: "components.layoutRow",
  grid: "components.layoutGrid",
  overlay: "components.layoutOverlay"
};

const LAYOUT_DESCRIPTION_KEYS: Readonly<Record<LayoutKind, MessageKey>> = {
  section: "components.layoutSectionDescription",
  container: "components.layoutContainerDescription",
  stack: "components.layoutStackDescription",
  row: "components.layoutRowDescription",
  grid: "components.layoutGridDescription",
  overlay: "components.layoutOverlayDescription"
};

function childNodes(node: PageNode): PageNode[] {
  return node.kind === "layout" ? [...node.children] : Object.values(node.slots ?? {}).flat();
}

function nodeTitle(node: PageNode): string {
  if (node.name) return node.name;
  if (node.kind === "layout") return node.role ?? node.layout;
  const text = node.props?.text ?? node.props?.label ?? node.props?.planName;
  return typeof text === "string" && text.length < 80 ? text : node.componentRef;
}

function searchableNode(node: PageNode): string {
  return [nodeTitle(node), node.id, node.role, node.kind === "component" ? node.componentRef : node.layout]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

interface OutlineEntry {
  node: PageNode;
  depth: number;
  parentId?: string;
}

function collectOutline(
  nodes: readonly PageNode[],
  expanded: ReadonlySet<string>,
  query: string,
  depth = 1,
  parentId?: string
): OutlineEntry[] {
  const result: OutlineEntry[] = [];
  for (const node of nodes) {
    const children = childNodes(node);
    const descendantEntries = collectOutline(children, expanded, query, depth + 1, node.id);
    const matches = !query || searchableNode(node).includes(query) || descendantEntries.length > 0;
    if (!matches) continue;
    result.push({ node, depth, ...(parentId ? { parentId } : {}) });
    if (query || expanded.has(node.id)) result.push(...descendantEntries);
  }
  return result;
}

type DropIndicator = { nodeId: string; position: "before" | "inside" | "after" };

function OutlineNodeRow({
  node,
  depth,
  parentId,
  document,
  catalog,
  selectedNodeId,
  normalizedQuery,
  expanded,
  dropIndicator,
  setExpanded,
  setDropIndicator,
  setDragError,
  handleKey
}: {
  node: PageNode;
  depth: number;
  parentId?: string;
  document: ReturnType<typeof useStudioSession>["document"];
  catalog: GetCatalogResponse | undefined;
  selectedNodeId: string | undefined;
  normalizedQuery: string;
  expanded: ReadonlySet<string>;
  dropIndicator: DropIndicator | undefined;
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
  setDropIndicator: Dispatch<SetStateAction<DropIndicator | undefined>>;
  setDragError: Dispatch<SetStateAction<StructureDragErrorCode | undefined>>;
  handleKey: (event: KeyboardEvent<HTMLElement>, node?: PageNode, parentId?: string) => void;
}) {
  const session = useStudioSession();
  const { t } = useI18n();
  const { openContextMenu } = useContextMenu();
  const children = childNodes(node);
  const isExpanded = normalizedQuery ? true : expanded.has(node.id);
  const insertSource = () => {
    const payload = session.activeInsertDrag;
    if (!payload) return undefined;
    return {
      payload,
      sources: catalog ? insertSourcesForPayload(catalog, payload) : []
    };
  };
  return (
    <div
      role="treeitem"
      tabIndex={-1}
      draggable
      data-node-id={node.id}
      aria-level={depth + 1}
      aria-selected={selectedNodeId === node.id}
      aria-expanded={children.length ? isExpanded : undefined}
      aria-describedby="outline-drag-instructions"
      className={`tree-row${selectedNodeId === node.id ? " is-selected" : ""}${dropIndicator?.nodeId === node.id ? ` is-drop-${dropIndicator.position}` : ""}`}
      style={{ paddingLeft: 6 + depth * 14, "--tree-depth": depth } as CSSProperties}
      onClick={() => session.selectNode(node.id)}
      onContextMenu={(event) =>
        openContextMenu(event, {
          type: "node",
          id: node.id,
          label: nodeTitle(node),
          metadata: { nodeKind: node.kind, surface: "outline" },
          capabilities: {
            select: { execute: () => session.selectNode(node.id) },
            remove: {
              execute: () => session.removeNode(node.id),
              isDisabled: session.status === "saving"
            }
          }
        })
      }
      onKeyDown={(event) => handleKey(event, node, parentId)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(NODE_DRAG_MIME, node.id);
        event.dataTransfer.setData("text/plain", node.id);
        session.beginNodeDrag(node.id);
        session.selectNode(node.id);
      }}
      onDragEnd={() => {
        session.endNodeDrag();
        setDropIndicator(undefined);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndicator(undefined);
      }}
      onDragOver={(event) => {
        const insert = insertSource();
        const sourceNodeId = session.activeNodeDragId ?? event.dataTransfer.getData(NODE_DRAG_MIME);
        if (insert && document && catalog) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          const rect = event.currentTarget.getBoundingClientRect();
          const resolution = resolveInsertSourcesTarget(document, catalog, insert.sources, node.id, { x: event.clientX, y: event.clientY }, {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          });
          setDropIndicator(resolution.valid ? { nodeId: node.id, position: resolution.position } : undefined);
          setDragError(resolution.valid ? undefined : resolution.reason);
          return;
        }
        if (!sourceNodeId || !document || !catalog) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const rect = event.currentTarget.getBoundingClientRect();
        const resolution = resolveMoveTarget(document, catalog, sourceNodeId, node.id, { x: event.clientX, y: event.clientY }, {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          });
        setDropIndicator(resolution.valid ? { nodeId: node.id, position: resolution.position } : undefined);
        setDragError(resolution.valid ? undefined : resolution.reason);
      }}
      onDrop={(event) => {
        const insert = insertSource();
        const sourceNodeId = session.activeNodeDragId ?? event.dataTransfer.getData(NODE_DRAG_MIME);
        if (insert && document && catalog) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const resolution = resolveInsertSourcesTarget(document, catalog, insert.sources, node.id, { x: event.clientX, y: event.clientY }, {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          });
          setDropIndicator(undefined);
          if (resolution.valid)
            void session.insertNode(insert.payload, resolution.target);
          else setDragError(resolution.reason);
          return;
        }
        if (!sourceNodeId || !document || !catalog) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const resolution = resolveMoveTarget(document, catalog, sourceNodeId, node.id, { x: event.clientX, y: event.clientY }, {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          });
        setDropIndicator(undefined);
        if (resolution.valid) {
          setDragError(undefined);
          void session.moveNode(sourceNodeId, resolution.target);
        } else setDragError(resolution.reason);
      }}
    >
      {children.length ? (
        <button
          type="button"
          className="tree-disclosure"
          aria-label={t(isExpanded ? "outline.collapseNode" : "outline.expandNode", {
            node: nodeTitle(node)
          })}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => {
              const next = new Set(value);
              if (isExpanded) next.delete(node.id);
              else next.add(node.id);
              return next;
            });
          }}
        >
          {isExpanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="tree-disclosure-placeholder" />
      )}
      <span className={`tree-kind ${node.kind}`}>
        {node.kind === "layout" ? node.layout[0]!.toUpperCase() : node.componentRef[0]}
      </span>
      <span className="tree-label" title={`${nodeTitle(node)} · ${node.id}`}>
        {nodeTitle(node)}
      </span>
    </div>
  );
}

export function PageOutlinePanel() {
  const session = useStudioSession();
  const {
    document,
    pages,
    activePageId,
    openPageIds,
    catalog,
    selectedNodeId,
    selectNode,
    createPage,
    activatePage,
    closePage,
    moveNode
  } = session;
  const { t } = useI18n();
  const { openContextMenu } = useContextMenu();
  const [query, setQuery] = useState("");
  const [rootExpanded, setRootExpanded] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>();
  const [dragError, setDragError] = useState<StructureDragErrorCode>();
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!document) return;
    const next = new Set(expanded);
    const reveal = (nodes: readonly PageNode[], ancestors: string[]): boolean => {
      for (const node of nodes) {
        if (node.id === selectedNodeId) {
          ancestors.forEach((id) => next.add(id));
          return true;
        }
        if (reveal(childNodes(node), [...ancestors, node.id])) return true;
      }
      return false;
    };
    if (selectedNodeId && reveal(document.children, [])) {
      setRootExpanded(true);
      setExpanded(next);
    }
    // Only reveal when selection changes; expanded is intentionally local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, selectedNodeId]);

  useEffect(() => {
    setRootExpanded(true);
  }, [activePageId]);

  const normalizedQuery = query.trim().toLowerCase();
  const entries = useMemo(
    () =>
      document && (rootExpanded || normalizedQuery) ? collectOutline(document.children, expanded, normalizedQuery) : [],
    [document, expanded, normalizedQuery, rootExpanded]
  );

  const focusAt = (current: HTMLElement, delta: "first" | "last" | number): void => {
    const items = [...(treeRef.current?.querySelectorAll<HTMLElement>("[role=treeitem]") ?? [])];
    const index = items.indexOf(current);
    const next =
      delta === "first"
        ? items[0]
        : delta === "last"
          ? items.at(-1)
          : items[Math.max(0, Math.min(items.length - 1, index + delta))];
    next?.focus();
  };

  const handleKey = (event: KeyboardEvent<HTMLElement>, node?: PageNode, parentId?: string): void => {
    if (node && document && event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const resolution = resolveSiblingMove(document, node.id, event.key === "ArrowUp" ? "up" : "down");
      if (resolution.valid) void moveNode(node.id, resolution.target);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusAt(
        event.currentTarget,
        event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : event.key === "Home" ? "first" : "last"
      );
      return;
    }
    const children = node ? childNodes(node) : (document?.children ?? []);
    const isExpanded = node ? expanded.has(node.id) : rootExpanded;
    if (event.key === "ArrowRight" && children.length) {
      event.preventDefault();
      if (!isExpanded) {
        if (node) setExpanded((value) => new Set(value).add(node.id));
        else setRootExpanded(true);
      } else {
        focusAt(event.currentTarget, 1);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (isExpanded && children.length) {
        if (node)
          setExpanded((value) => {
            const next = new Set(value);
            next.delete(node.id);
            return next;
          });
        else setRootExpanded(false);
      } else if (parentId)
        treeRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(parentId)}"]`)?.focus();
      else
        treeRef.current
          ?.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(activePageId ?? "")}"]`)
          ?.focus();
    } else if ((event.key === "Enter" || event.key === " ") && node) {
      event.preventDefault();
      selectNode(node.id);
    } else if (
      node &&
      (event.key === "Delete" || event.key === "Backspace") &&
      session.status !== "saving"
    ) {
      event.preventDefault();
      void session.removeNode(node.id);
    }
  };

  return (
    <div className="tool-panel outline-panel">
      <div className="tool-search tool-search--with-action">
        <SearchField
          label={t("common.search")}
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder={t("outline.filterPlaceholder")}
        />
        <IconButton
          icon={<ProductIcon name="add" />}
          label={t("outline.newPage")}
          onPress={() => createPage()}
        />
      </div>
      <div className="tree" role="tree" aria-label={t("outline.treeLabel")} ref={treeRef}>
        <p id="outline-drag-instructions" className="visually-hidden">
          {t("outline.dragDescription")}
        </p>
        {pages.map((page) => {
          const active = page.id === activePageId;
          return (
            <Fragment key={page.id}>
              <div
                role="treeitem"
                tabIndex={active ? 0 : -1}
                data-page-id={page.id}
                aria-selected={active && !selectedNodeId}
                aria-expanded={active ? rootExpanded : false}
                className={`tree-row tree-row--root${active && !selectedNodeId ? " is-selected" : ""}`}
                onClick={() => {
                  activatePage(page.id);
                  selectNode();
                }}
                onContextMenu={(event) =>
                  openContextMenu(event, {
                    type: "page",
                    id: page.id,
                    label: page.name,
                    metadata: { active },
                    capabilities: {
                      activate: { execute: () => activatePage(page.id) },
                      createPage: { execute: () => void createPage() },
                      close: {
                        execute: () => closePage(page.id),
                        isDisabled: openPageIds.length <= 1
                      }
                    }
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activatePage(page.id);
                    selectNode();
                  } else if (
                    event.key === "ArrowUp" ||
                    event.key === "ArrowDown" ||
                    event.key === "Home" ||
                    event.key === "End"
                  ) {
                    event.preventDefault();
                    focusAt(
                      event.currentTarget,
                      event.key === "ArrowUp"
                        ? -1
                        : event.key === "ArrowDown"
                          ? 1
                          : event.key === "Home"
                            ? "first"
                            : "last"
                    );
                  } else if (active && event.key === "ArrowRight") {
                    event.preventDefault();
                    if (!rootExpanded) setRootExpanded(true);
                    else focusAt(event.currentTarget, 1);
                  } else if (active && event.key === "ArrowLeft") {
                    event.preventDefault();
                    setRootExpanded(false);
                  }
                }}
              >
                <button
                  type="button"
                  className="tree-disclosure"
                  aria-label={rootExpanded ? t("outline.collapsePage") : t("outline.expandPage")}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!active) activatePage(page.id);
                    else setRootExpanded((value) => !value);
                  }}
                >
                  {active && rootExpanded ? "▾" : "▸"}
                </button>
                <span className="tree-kind">P</span>
                <strong className="tree-label" title={page.name}>
                  {page.name}
                </strong>
              </div>
              {active && rootExpanded
                ? entries.map(({ node, depth, parentId }) => (
                    <OutlineNodeRow
                      key={node.id}
                      node={node}
                      depth={depth}
                      {...(parentId ? { parentId } : {})}
                      document={document}
                      catalog={catalog}
                      selectedNodeId={selectedNodeId}
                      normalizedQuery={normalizedQuery}
                      expanded={expanded}
                      dropIndicator={dropIndicator}
                      setExpanded={setExpanded}
                      setDropIndicator={setDropIndicator}
                      setDragError={setDragError}
                      handleKey={handleKey}
                    />
                  ))
                : null}
            </Fragment>
          );
        })}
        {pages.length === 0 ? (
          <div className="tool-empty">{t("outline.loadingPage")}</div>
        ) : null}
        {normalizedQuery && entries.length === 0 ? (
          <div className="tool-empty">
            {t("outline.noMatches", { query })}{" "}
            <ActionButton onPress={() => setQuery("")}>{t("common.clearSearch")}</ActionButton>
          </div>
        ) : null}
        {dragError ? (
          <div className="tree-drag-message" role="status">
            {translateStructureDragError(t, dragError)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ComponentsPanel() {
  const session = useStudioSession();
  const { format, locale, t } = useI18n();
  const { openContextMenu } = useContextMenu();
  const [query, setQuery] = useState("");
  const entries = componentPanelEntries(session.catalog);
  const filtered = filterComponentPanelEntries(entries, query, locale);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const layouts = LAYOUT_KINDS.filter((layout) =>
    [
      layout,
      t(LAYOUT_LABEL_KEYS[layout]),
      t(LAYOUT_DESCRIPTION_KEYS[layout])
    ]
      .join(" ")
      .toLocaleLowerCase(locale)
      .includes(normalizedQuery)
  );
  const patterns = Object.values(session.catalog?.assets.patterns ?? {}).filter((pattern) =>
    [
      pattern.id,
      displayLabel(pattern.displayName, pattern.id, locale),
      displayLabel(pattern.description, pattern.id, locale),
      pattern.category
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
  const groups = useMemo(() => {
    const result = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const key = entry.component.category ?? "other";
      const values = result.get(key) ?? [];
      values.push(entry);
      result.set(key, values);
    }
    return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);
  return (
    <div className="tool-panel component-panel">
      <div className="tool-search">
        <SearchField
          label={t("common.search")}
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder={t("components.findPlaceholder")}
        />
      </div>
      <p className="tool-section-title">{t("components.layouts")}</p>
      {layouts.length ? (
        <section className="component-group">
          <div className="component-grid">
            {layouts.map((layout) => {
              const label = t(LAYOUT_LABEL_KEYS[layout]);
              const description = t(LAYOUT_DESCRIPTION_KEYS[layout]);
              return (
                <div
                  className={`component-tile${session.status === "saving" ? " is-disabled" : ""}`}
                  data-insert-type="layout"
                  data-insert-id={layout}
                  draggable={session.status !== "saving"}
                  title={`${description} · ${t("components.dragToInsert")}`}
                  key={layout}
                  onDragStart={(event) => {
                    session.beginInsertDrag({ type: "layout", id: layout });
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(LAYOUT_DRAG_MIME, layout);
                    event.dataTransfer.setData("text/plain", layout);
                  }}
                  onDragEnd={session.endInsertDrag}
                >
                  <span><CatalogIcon name={`layout-${layout}`} /></span>
                  <b>{label}</b>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      <p className="tool-section-title">{t("components.registered")}</p>
      {groups.length ? (
        groups.map(([category, componentEntries]) => (
          <section className="component-group" key={category}>
            <h3>
              {t(CATEGORY_KEYS[category] ?? "components.categoryOther")}
            </h3>
            <div className="component-grid">
              {componentEntries.map(({ component, preset, presetId }) => {
                const componentLabel = displayLabel(component.displayName, component.name, locale);
                const presetCount = Object.keys(component.editor.presets).length;
                const presetLabel = preset
                  ? displayLabel(preset.displayName, presetId ?? component.name, locale)
                  : componentLabel;
                const label = presetCount > 1 ? `${componentLabel} · ${presetLabel}` : componentLabel;
                return (
                    <div
                      className={`component-tile${session.status === "saving" ? " is-disabled" : ""}`}
                      data-insert-type="component"
                      data-insert-id={component.name}
                      draggable={session.status !== "saving"}
                      title={`${label} · ${t("components.dragToInsert")}`}
                      key={`${component.name}:${presetId ?? "default"}`}
                      onDragStart={(event) => {
                        session.beginInsertDrag({
                          type: "component",
                          id: component.name,
                          ...(presetId ? { presetId } : {})
                        });
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData(COMPONENT_DRAG_MIME, component.name);
                      }}
                      onDragEnd={session.endInsertDrag}
                      onContextMenu={(event) =>
                        openContextMenu(event, {
                          type: "registered-component",
                          id: component.name,
                          label
                        })
                      }
                    >
                      <span><CatalogIcon name={component.editor.icon} /></span>
                      <b>{label}</b>
                    </div>
                );
              })}
            </div>
          </section>
        ))
      ) : null}
      {patterns.length ? (
        <section className="component-group">
          <h3>{t("components.patterns")}</h3>
          <div className="component-grid">
            {patterns.map((pattern) => {
              const label = displayLabel(pattern.displayName, pattern.id, locale);
              return (
                <button
                  type="button"
                  className="component-tile pattern-tile"
                  data-insert-type="pattern"
                  data-insert-id={pattern.id}
                  draggable={session.status !== "saving"}
                  title={t("components.insertPattern", { pattern: label })}
                  disabled={session.status === "saving"}
                  key={pattern.id}
                  onClick={() => void session.insertPattern(pattern.id)}
                  onDragStart={(event) => {
                    session.beginInsertDrag({
                      type: "pattern",
                      id: pattern.id
                    });
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(PATTERN_DRAG_MIME, pattern.id);
                    event.dataTransfer.setData("text/plain", pattern.id);
                  }}
                  onDragEnd={session.endInsertDrag}
                >
                  <span><CatalogIcon name="pattern" /></span>
                  <b>{label}</b>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
      {session.status === "loading" && !session.catalog ? (
        <div className="tool-empty" role="status">{t("components.loading")}</div>
      ) : null}
      {session.status === "error" && !session.catalog ? (
        <div className="tool-empty component-catalog-error" role="alert">
          <p>{t("components.catalogUnavailable")}</p>
          {session.error ? <small>{format(session.error)}</small> : null}
          <ActionButton onPress={() => void session.reload()}>{t("components.retry")}</ActionButton>
        </div>
      ) : null}
      {session.catalog && entries.length === 0 && patterns.length === 0 ? (
        <div className="tool-empty">{t("components.emptyCatalog")}</div>
      ) : null}
      {session.catalog && entries.length > 0 && !layouts.length && !groups.length && !patterns.length ? (
        <div className="tool-empty">
          {t("components.noMatches", { query })}{" "}
          <ActionButton onPress={() => setQuery("")}>{t("common.clearSearch")}</ActionButton>
        </div>
      ) : null}
    </div>
  );
}

function PropField({
  nodeId,
  name,
  definition,
  value
}: {
  nodeId: string;
  name: string;
  definition: GetCatalogResponse["components"]["components"][string]["props"][string];
  value: unknown;
}) {
  const session = useStudioSession();
  const { locale } = useI18n();
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [nodeId, value]);
  const commitDraft = (): void => {
    const next = definition.type === "number" ? Number(draft) : draft;
    if (!Object.is(next, value)) void session.setProp(nodeId, name, next);
  };
  const label = displayLabel(definition.displayName, name, locale);
  if (definition.type === "enum") {
    const options: readonly SelectOption[] = (definition.values ?? []).map((option) => ({
      id: String(option),
      label: displayLabel(definition.valueDisplayNames?.[String(option)], String(option), locale)
    }));
    return (
      <div className="inspector-field" data-inspector-prop={name}>
        <Select
          label={label}
          options={options}
          selectedKey={draft}
          isDisabled={session.status === "saving"}
          {...(definition.required === undefined ? {} : { isRequired: definition.required })}
          onSelectionChange={(key) => {
            setDraft(key);
            void session.setProp(
              nodeId,
              name,
              definition.values?.find((candidate) => String(candidate) === key) ?? key
            );
          }}
        />
      </div>
    );
  }
  if (definition.type === "boolean") {
    return (
      <div className="inspector-field" data-inspector-prop={name}>
        <Checkbox
          label={label}
          isSelected={value === true}
          isDisabled={session.status === "saving"}
          {...(definition.required === undefined ? {} : { isRequired: definition.required })}
          onChange={(isSelected) => void session.setProp(nodeId, name, isSelected)}
        />
      </div>
    );
  }
  if (definition.type === "number") {
    const numberValue = Number(draft);
    return (
      <div className="inspector-field" data-inspector-prop={name}>
      <NumberField
        label={label}
        value={Number.isFinite(numberValue) ? numberValue : 0}
        {...(definition.validation?.min === undefined ? {} : { minValue: definition.validation.min })}
        {...(definition.validation?.max === undefined ? {} : { maxValue: definition.validation.max })}
          isDisabled={session.status === "saving"}
          {...(definition.required === undefined ? {} : { isRequired: definition.required })}
          onChange={(next) => setDraft(String(next))}
          onBlur={commitDraft}
          onSubmit={commitDraft}
        />
      </div>
    );
  }
  if (definition.editor === "textarea") {
    return (
      <div className="inspector-field" data-inspector-prop={name}>
        <TextArea
          label={label}
          value={draft}
          isDisabled={session.status === "saving"}
          isRequired={definition.required}
          isInvalid={
            definition.validation?.pattern !== undefined &&
            draft.length > 0 &&
            !new RegExp(definition.validation.pattern).test(draft)
          }
          onChange={setDraft}
          onBlur={commitDraft}
        />
      </div>
    );
  }
  return (
    <div className="inspector-field" data-inspector-prop={name}>
      <TextField
        label={label}
        type={definition.editor === "url" ? "url" : "text"}
        value={draft}
        isInvalid={
          definition.validation?.pattern !== undefined &&
          draft.length > 0 &&
          !new RegExp(definition.validation.pattern).test(draft)
        }
        isDisabled={session.status === "saving"}
        {...(definition.required === undefined ? {} : { isRequired: definition.required })}
        onChange={setDraft}
        onBlur={commitDraft}
        onSubmit={commitDraft}
      />
    </div>
  );
}

const EMPTY_OPTION = "__none__";
const BREAKPOINTS = ["mobile", "tablet", "desktop"] as const;

function DraftTextField({
  label,
  value,
  disabled,
  onCommit
}: {
  label: string;
  value: string | undefined;
  disabled: boolean;
  onCommit: (value?: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const commit = (): void => {
    const next = draft.trim() || undefined;
    if (next !== value) onCommit(next);
  };
  return (
    <div className="inspector-field">
      <TextField
        label={label}
        value={draft}
        isDisabled={disabled}
        onChange={setDraft}
        onBlur={commit}
        onSubmit={commit}
      />
    </div>
  );
}

function findParentNode(document: PageDocument | undefined, nodeId: string): PageNode | undefined {
  if (!document) return undefined;
  let parent: PageNode | undefined;
  const visit = (node: PageNode): boolean => {
    const children = node.kind === "layout" ? node.children : Object.values(node.slots ?? {}).flat();
    if (children.some(({ id }) => id === nodeId)) {
      parent = node;
      return true;
    }
    return children.some(visit);
  };
  document.children.some(visit);
  return parent;
}

function GeneralFields({
  node,
  roles
}: {
  node: PageNode;
  roles?: readonly string[];
}) {
  const session = useStudioSession();
  const { t } = useI18n();
  const disabled = session.status === "saving";
  return (
    <>
      <DraftTextField
        label={t("inspector.name")}
        value={node.name}
        disabled={disabled}
        onCommit={(name) => void session.setName(node.id, name)}
      />
      {roles ? (
        <div className="inspector-field">
          <Select
            label={t("inspector.role")}
            options={[
              { id: EMPTY_OPTION, label: t("common.none") },
              ...roles.map((role) => ({ id: role, label: role }))
            ]}
            selectedKey={node.role ?? EMPTY_OPTION}
            isDisabled={disabled}
            onSelectionChange={(role) =>
              void session.setRole(node.id, role === EMPTY_OPTION ? undefined : role)
            }
          />
        </div>
      ) : (
        <DraftTextField
          label={t("inspector.role")}
          value={node.role}
          disabled={disabled}
          onCommit={(role) => void session.setRole(node.id, role)}
        />
      )}
    </>
  );
}

function TokenBindingFields({
  node,
  definition
}: {
  node: Extract<PageNode, { kind: "component" }>;
  definition: GetCatalogResponse["components"]["components"][string];
}) {
  const session = useStudioSession();
  const { locale, t } = useI18n();
  return (
    <>
      {Object.entries(definition.tokenSlots).map(([name, tokenSlot]) => {
        const options = Object.entries(session.catalog?.tokens.tokens ?? {})
          .filter(([, token]) => tokenSlot.tokenTypes.includes(token.type))
          .map(([reference]) => ({ id: reference, label: reference }));
        return (
          <div className="inspector-field" key={name}>
            <Select
              label={displayLabel(tokenSlot.displayName, name, locale)}
              options={[{ id: EMPTY_OPTION, label: t("common.none") }, ...options]}
              selectedKey={node.styleBindings?.[name] ?? EMPTY_OPTION}
              isDisabled={session.status === "saving"}
              onSelectionChange={(reference) =>
                void session.setStyleBinding(
                  node.id,
                  name,
                  reference === EMPTY_OPTION ? undefined : reference
                )
              }
            />
          </div>
        );
      })}
    </>
  );
}

function PlacementFields({
  node,
  parent
}: {
  node: PageNode;
  parent: PageNode | undefined;
}) {
  const session = useStudioSession();
  const { t } = useI18n();
  const disabled = session.status === "saving";
  const update = <K extends keyof Placement>(property: K, value: Placement[K] | undefined): void => {
    const next: Placement = { ...(node.placement ?? {}) };
    if (value === undefined) delete next[property];
    else next[property] = value;
    void session.setPlacement(node.id, Object.keys(next).length ? next : undefined);
  };
  return (
    <>
      <div className="inspector-field">
        <Select
          label={t("inspector.width")}
          options={[
            { id: EMPTY_OPTION, label: t("common.default") },
            { id: "auto", label: t("inspector.widthAuto") },
            { id: "fit", label: t("inspector.widthFit") },
            { id: "fill", label: t("inspector.widthFill") }
          ]}
          selectedKey={node.placement?.width ?? EMPTY_OPTION}
          isDisabled={disabled}
          onSelectionChange={(value) =>
            update("width", value === EMPTY_OPTION ? undefined : (value as Placement["width"]))
          }
        />
      </div>
      <div className="inspector-field">
        <Select
          label={t("inspector.alignSelf")}
          options={[
            { id: EMPTY_OPTION, label: t("common.default") },
            ...["auto", "start", "center", "end", "stretch"].map((value) => ({
              id: value,
              label: value
            }))
          ]}
          selectedKey={node.placement?.alignSelf ?? EMPTY_OPTION}
          isDisabled={disabled}
          onSelectionChange={(value) =>
            update(
              "alignSelf",
              value === EMPTY_OPTION ? undefined : (value as Placement["alignSelf"])
            )
          }
        />
      </div>
      <div className="inspector-field">
        <Checkbox
          label={t("inspector.grow")}
          isSelected={node.placement?.grow === true}
          isDisabled={disabled}
          onChange={(selected) => update("grow", selected || undefined)}
        />
      </div>
      {parent?.kind === "layout" && parent.layout === "grid"
        ? BREAKPOINTS.map((breakpoint) => (
            <div className="inspector-field" key={breakpoint}>
              <Select
                label={t("inspector.gridSpan", { breakpoint })}
                options={[
                  { id: EMPTY_OPTION, label: t("common.default") },
                  ...[1, 2, 3, 4, 6, 12].map((span) => ({
                    id: String(span),
                    label: String(span)
                  }))
                ]}
                selectedKey={
                  node.placement?.gridSpan?.[breakpoint] === undefined
                    ? EMPTY_OPTION
                    : String(node.placement.gridSpan[breakpoint])
                }
                isDisabled={disabled}
                onSelectionChange={(value) => {
                  const gridSpan = { ...(node.placement?.gridSpan ?? {}) };
                  if (value === EMPTY_OPTION) delete gridSpan[breakpoint];
                  else gridSpan[breakpoint] = Number(value) as 1 | 2 | 3 | 4 | 6 | 12;
                  update("gridSpan", Object.keys(gridSpan).length ? gridSpan : undefined);
                }}
              />
            </div>
          ))
        : null}
    </>
  );
}

function VisibilityFields({ node }: { node: PageNode }) {
  const session = useStudioSession();
  const { t } = useI18n();
  const update = (breakpoint: (typeof BREAKPOINTS)[number], selected: boolean): void => {
    const next: Visibility = { ...(node.visibility ?? {}) };
    if (selected) delete next[breakpoint];
    else next[breakpoint] = false;
    void session.setVisibility(node.id, Object.keys(next).length ? next : undefined);
  };
  return (
    <>
      {BREAKPOINTS.map((breakpoint) => (
        <div className="inspector-field" key={breakpoint}>
          <Checkbox
            label={t("inspector.visibleAt", { breakpoint })}
            isSelected={node.visibility?.[breakpoint] !== false}
            isDisabled={session.status === "saving"}
            onChange={(selected) => update(breakpoint, selected)}
          />
        </div>
      ))}
    </>
  );
}

function AccessibilityFields({ node }: { node: Extract<PageNode, { kind: "component" }> }) {
  const session = useStudioSession();
  const { t } = useI18n();
  const update = <K extends keyof Accessibility>(
    property: K,
    value: Accessibility[K] | undefined
  ): void => {
    const next: Accessibility = { ...(node.accessibility ?? {}) };
    if (value === undefined || value === false) delete next[property];
    else next[property] = value;
    void session.setAccessibility(node.id, Object.keys(next).length ? next : undefined);
  };
  return (
    <>
      <DraftTextField
        label={t("inspector.accessibleLabel")}
        value={node.accessibility?.label}
        disabled={session.status === "saving"}
        onCommit={(label) => update("label", label)}
      />
      <DraftTextField
        label={t("inspector.describedBy")}
        value={node.accessibility?.describedBy}
        disabled={session.status === "saving"}
        onCommit={(describedBy) => update("describedBy", describedBy)}
      />
      <div className="inspector-field">
        <Checkbox
          label={t("inspector.decorative")}
          isSelected={node.accessibility?.decorative === true}
          isDisabled={session.status === "saving"}
          onChange={(selected) => update("decorative", selected || undefined)}
        />
      </div>
    </>
  );
}

function InteractionFields({
  node,
  definition
}: {
  node: Extract<PageNode, { kind: "component" }>;
  definition: GetCatalogResponse["components"]["components"][string];
}) {
  const session = useStudioSession();
  const { locale, t } = useI18n();
  const actions = session.catalog?.actions.actions ?? {};
  const replaceInteraction = (event: string, interaction?: Interaction): void => {
    const next = (node.interactions ?? []).filter((candidate) => candidate.event !== event);
    if (interaction) next.push(interaction);
    void session.setInteractions(node.id, next);
  };
  return (
    <>
      {Object.entries(definition.events).map(([event, eventDefinition]) => {
        const interaction = node.interactions?.find((candidate) => candidate.event === event);
        const action = interaction ? actions[interaction.actionRef] : undefined;
        return (
          <Fragment key={event}>
            <div className="inspector-field">
              <Select
                label={displayLabel(eventDefinition.displayName, event, locale)}
                options={[
                  { id: EMPTY_OPTION, label: t("common.none") },
                  ...Object.entries(actions).map(([reference, metadata]) => ({
                    id: reference,
                    label: metadata.name
                  }))
                ]}
                selectedKey={interaction?.actionRef ?? EMPTY_OPTION}
                isDisabled={session.status === "saving"}
                onSelectionChange={(actionRef) => {
                  if (actionRef === EMPTY_OPTION) {
                    replaceInteraction(event);
                    return;
                  }
                  const argumentsDefinition = actions[actionRef]?.arguments ?? {};
                  const argumentValues = Object.fromEntries(
                    Object.entries(argumentsDefinition).map(([name, type]) => [
                      name,
                      type === "number" ? 0 : type === "boolean" ? false : ""
                    ])
                  );
                  replaceInteraction(event, {
                    event,
                    actionRef,
                    ...(Object.keys(argumentValues).length ? { arguments: argumentValues } : {})
                  });
                }}
              />
            </div>
            {interaction && action
              ? Object.entries(action.arguments ?? {}).map(([name, type]) => {
                  const value = interaction.arguments?.[name];
                  const updateArgument = (nextValue: string | number | boolean): void =>
                    replaceInteraction(event, {
                      ...interaction,
                      arguments: { ...(interaction.arguments ?? {}), [name]: nextValue }
                    });
                  if (type === "boolean")
                    return (
                      <div className="inspector-field inspector-subfield" key={name}>
                        <Checkbox
                          label={name}
                          isSelected={value === true}
                          isDisabled={session.status === "saving"}
                          onChange={updateArgument}
                        />
                      </div>
                    );
                  if (type === "number")
                    return (
                      <div className="inspector-field inspector-subfield" key={name}>
                        <NumberField
                          label={name}
                          value={typeof value === "number" ? value : 0}
                          isDisabled={session.status === "saving"}
                          onChange={updateArgument}
                        />
                      </div>
                    );
                  return (
                    <div className="inspector-subfield" key={name}>
                      <DraftTextField
                        label={name}
                        value={typeof value === "string" ? value : ""}
                        disabled={session.status === "saving"}
                        onCommit={(next) => updateArgument(next ?? "")}
                      />
                    </div>
                  );
                })
              : null}
          </Fragment>
        );
      })}
      {Object.keys(definition.events).length === 0 ? (
        <p className="inspector-muted">{t("inspector.noEvents")}</p>
      ) : null}
    </>
  );
}

function LayoutFields({ node }: { node: Extract<PageNode, { kind: "layout" }> }) {
  const session = useStudioSession();
  const { t } = useI18n();
  const disabled = session.status === "saving";
  const spacingTokens = Object.entries(session.catalog?.tokens.tokens ?? {})
    .filter(([, token]) => token.type === "spacing")
    .map(([reference]) => ({ id: reference, label: reference }));
  return (
    <>
      <div className="readonly-field">
        <span>{t("inspector.layoutType")}</span>
        <output>{node.layout}</output>
      </div>
      <div className="inspector-field">
        <Select
          label={t("inspector.gapToken")}
          options={[{ id: EMPTY_OPTION, label: t("common.none") }, ...spacingTokens]}
          selectedKey={node.gapToken ?? EMPTY_OPTION}
          isDisabled={disabled}
          onSelectionChange={(value) =>
            void session.setLayoutProperty(
              node.id,
              "gapToken",
              value === EMPTY_OPTION ? undefined : value
            )
          }
        />
      </div>
      <div className="inspector-field">
        <Select
          label={t("inspector.align")}
          options={["start", "center", "end", "stretch"].map((value) => ({
            id: value,
            label: value
          }))}
          selectedKey={node.align ?? "stretch"}
          isDisabled={disabled}
          onSelectionChange={(value) => void session.setLayoutProperty(node.id, "align", value)}
        />
      </div>
      {node.layout === "section" || node.layout === "container" ? (
        <div className="inspector-field">
          <Select
            label={t("inspector.contentWidth")}
            options={["sm", "md", "lg", "full"].map((value) => ({ id: value, label: value }))}
            selectedKey={node.width ?? "full"}
            isDisabled={disabled}
            onSelectionChange={(value) => void session.setLayoutProperty(node.id, "width", value)}
          />
        </div>
      ) : null}
      {node.layout === "grid"
        ? BREAKPOINTS.map((breakpoint) => (
            <div className="inspector-field" key={breakpoint}>
              <Select
                label={t("inspector.gridColumns", { breakpoint })}
                options={[1, 2, 3, 4, 6, 12].map((count) => ({
                  id: String(count),
                  label: String(count)
                }))}
                selectedKey={String(node.columns?.[breakpoint] ?? (breakpoint === "mobile" ? 1 : 12))}
                isDisabled={disabled}
                onSelectionChange={(value) =>
                  void session.setLayoutProperty(node.id, "columns", {
                    ...(node.columns ?? {}),
                    [breakpoint]: Number(value)
                  })
                }
              />
            </div>
          ))
        : null}
    </>
  );
}

export function InspectorPanel() {
  const session = useStudioSession();
  const { format, locale, t } = useI18n();
  const node = session.selectedNode;
  const [generalOpen, setGeneralOpen] = useState(true);
  const [contentOpen, setContentOpen] = useState(true);
  const [appearanceOpen, setAppearanceOpen] = useState(true);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [interactionsOpen, setInteractionsOpen] = useState(false);
  if (!node)
    return (
      <div className="tool-panel inspector inspector-empty">
        <span className="selection-icon">N</span>
        <strong>{t("inspector.selectNode")}</strong>
        <p>{t("inspector.selectNodeHelp")}</p>
      </div>
    );
  const definition = node.kind === "component" ? session.catalog?.components.components[node.componentRef] : undefined;
  const title =
    node.kind === "component"
      ? displayLabel(definition?.displayName, node.componentRef, locale)
      : displayLabel(undefined, node.layout, locale);
  const parent = findParentNode(session.document, node.id);
  return (
    <div className="tool-panel inspector" data-selected-node-id={node.id}>
      <div className="selection-summary">
        <span className="selection-icon">{title[0]?.toUpperCase()}</span>
        <div>
          <strong>{title}</strong>
          <small>{node.kind === "component" ? t("common.component") : t("common.layout")}</small>
        </div>
      </div>
      <div className="inspector-section">
        <Disclosure
          title={t("inspector.general")}
          isExpanded={generalOpen}
          onExpandedChange={setGeneralOpen}
        >
          <GeneralFields node={node} {...(definition ? { roles: definition.roles } : {})} />
        </Disclosure>
      </div>
      {node.kind === "component" && definition ? (
        <>
          <div className="inspector-section">
            <Disclosure title={t("inspector.content")} isExpanded={contentOpen} onExpandedChange={setContentOpen}>
              {Object.entries(definition.props).map(([name, prop]) => (
                <PropField nodeId={node.id} name={name} definition={prop} value={node.props?.[name]} key={name} />
              ))}
              {Object.keys(definition.props).length === 0 ? (
                <p className="inspector-muted">{t("inspector.noProps")}</p>
              ) : null}
            </Disclosure>
          </div>
          <div className="inspector-section">
            <Disclosure
              title={t("inspector.appearance")}
              isExpanded={appearanceOpen}
              onExpandedChange={setAppearanceOpen}
            >
              {Object.keys(definition.variants).length ? (
                <div className="inspector-field">
                  <Select
                    label={t("inspector.variant")}
                    options={[
                      { id: EMPTY_OPTION, label: t("common.default") },
                      ...Object.entries(definition.variants).map(([variant, metadata]) => ({
                        id: variant,
                        label: displayLabel(metadata.displayName, variant, locale)
                      }))
                    ]}
                    selectedKey={node.variant ?? EMPTY_OPTION}
                    isDisabled={session.status === "saving"}
                    onSelectionChange={(key) =>
                      void session.setVariant(node.id, key === EMPTY_OPTION ? undefined : key)
                    }
                  />
                </div>
              ) : null}
              <TokenBindingFields node={node} definition={definition} />
            </Disclosure>
          </div>
          <div className="inspector-section">
            <Disclosure
              title={t("inspector.accessibility")}
              isExpanded={accessibilityOpen}
              onExpandedChange={setAccessibilityOpen}
            >
              <AccessibilityFields node={node} />
            </Disclosure>
          </div>
          <div className="inspector-section">
            <Disclosure
              title={t("inspector.interactions")}
              isExpanded={interactionsOpen}
              onExpandedChange={setInteractionsOpen}
            >
              <InteractionFields node={node} definition={definition} />
            </Disclosure>
          </div>
        </>
      ) : (
        node.kind === "layout" ? (
          <div className="inspector-section">
            <Disclosure
              title={t("inspector.layout")}
              isExpanded={contentOpen}
              onExpandedChange={setContentOpen}
            >
              <LayoutFields node={node} />
            </Disclosure>
          </div>
        ) : (
          <div className="inspector-note">{t("inspector.unknownComponent")}</div>
        )
      )}
      <div className="inspector-section">
        <Disclosure
          title={t("inspector.placement")}
          isExpanded={placementOpen}
          onExpandedChange={setPlacementOpen}
        >
          <PlacementFields node={node} parent={parent} />
        </Disclosure>
      </div>
      <div className="inspector-section">
        <Disclosure
          title={t("inspector.visibility")}
          isExpanded={visibilityOpen}
          onExpandedChange={setVisibilityOpen}
        >
          <VisibilityFields node={node} />
        </Disclosure>
      </div>
      {session.error ? (
        <div className="inspector-error" role="alert">
          {format(session.error)}
        </div>
      ) : null}
    </div>
  );
}

export function ProblemsPanel() {
  const session = useStudioSession();
  const { format, t } = useI18n();
  return (
    <div className="bottom-panel">
      <div className="problem-row">
        <span className={`problem-icon ${session.status === "error" ? "warn" : "info"}`}>
          {session.status === "error" ? "!" : "i"}
        </span>
        <div>
          <strong>
            {session.status === "error" ? t("problems.workspaceAttention") : t("problems.workspaceActive")}
          </strong>
          <small>
            {session.error ? format(session.error) : t("problems.revisionSynchronized", { revision: session.revision })}
          </small>
        </div>
        <span>{t("common.workspace")}</span>
      </div>
      <div className="problem-row">
        <span className="problem-icon info">i</span>
        <div>
          <strong>{t("problems.previewActive")}</strong>
          <small>{t("problems.previewDescription")}</small>
        </div>
        <span>{t("common.preview")}</span>
      </div>
    </div>
  );
}

export function HistoryPanel() {
  const session = useStudioSession();
  const { format, t } = useI18n();
  const [pendingRevision, setPendingRevision] = useState<number>();
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const closeRestore = (): void => {
    setPendingRevision(undefined);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
      });
    });
  };
  const requestRestore = (revision: number): void => {
    restoreFocusRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setPendingRevision(revision);
  };
  const restore = async (): Promise<void> => {
    if (pendingRevision === undefined) return;
    if (await session.restoreRevision(pendingRevision)) closeRestore();
  };
  const summary = (entry: (typeof session.history)[number]): string =>
    entry.kind === "commit"
      ? entry.commands.map((command) => t(COMMAND_KEYS[command.type] ?? "commandPalette.defaultCategory")).join(", ")
      : entry.kind === "restore"
        ? t("history.restoredRevision", { revision: entry.targetRevision })
        : t(entry.kind === "undo" ? "history.undoToRevision" : "history.redoToRevision", {
            revision: entry.targetRevision
          });
  const source = (value: "human" | "system" | "mcp"): string =>
    t(value === "human" ? "history.sourceHuman" : value === "system" ? "history.sourceSystem" : "history.sourceMcp");
  return (
    <div className="bottom-panel history-list">
      <AlertDialog
        isOpen={pendingRevision !== undefined}
        title={t("history.restoreRevision", { revision: pendingRevision ?? 0 })}
        confirmLabel={session.status === "saving" ? t("common.restoring") : t("common.restore")}
        cancelLabel={t("common.cancel")}
        isPending={session.status === "saving"}
        onCancel={closeRestore}
        onConfirm={() => void restore()}
      >
        {t("history.restoreCreatesRevision", { revision: session.revision + 1 })}
      </AlertDialog>
      {[...session.history].reverse().map((entry) => (
        <div className={entry.revision === session.revision ? "is-current" : ""} key={entry.revision}>
          <span className="history-dot" />
          <strong>{t("common.revision", { revision: entry.revision })}</strong>
          <small>{summary(entry)}</small>
          <time>{entry.revision === session.revision ? t("common.current") : source(entry.source)}</time>
          {entry.revision !== session.revision ? (
            <div className="history-restore-action">
              <ActionButton onPress={() => requestRestore(entry.revision)}>{t("common.restore")}</ActionButton>
            </div>
          ) : null}
        </div>
      ))}
      <div className={session.revision === 0 ? "is-current" : ""}>
        <span className="history-dot" />
        <strong>{t("common.revision", { revision: 0 })}</strong>
        <small>{t("common.initialDocument")}</small>
        <time>{session.revision === 0 ? t("common.current") : t("common.workspace")}</time>
        {session.revision !== 0 ? (
          <div className="history-restore-action">
            <ActionButton onPress={() => requestRestore(0)}>{t("common.restore")}</ActionButton>
          </div>
        ) : null}
      </div>
      {session.error ? (
        <div className="history-error" role="alert">
          {format(session.error)}
        </div>
      ) : null}
    </div>
  );
}
