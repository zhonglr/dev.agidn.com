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
import type { PageNode } from "@agidn/document-schema";
import { useStudioSession } from "./studio-session.js";
import {
  COMPONENT_DRAG_MIME,
  NODE_DRAG_MIME,
  resolveInsertTarget,
  resolveMoveTarget,
  resolveSiblingMove,
  SAVED_COMPONENT_DRAG_MIME,
  type StructureDragErrorCode
} from "./structure-drag.js";
import { displayLabel } from "./display-label.js";
import { useComponentWorkbenchNavigation } from "./component-workbench-navigation.js";
import { removeCustomComponent, useCustomComponents } from "./custom-components.js";
import { useI18n, type MessageKey } from "./i18n.js";
import { translateStructureDragError } from "./i18n/structure-drag.js";
import {
  ActionButton,
  AlertDialog,
  Button,
  Checkbox,
  useContextMenu,
  Disclosure,
  IconButton,
  NumberField,
  ProductIcon,
  SearchField,
  Select,
  TextField,
  type SelectOption
} from "./components/ui/index.js";

const CATEGORY_KEYS: Readonly<Record<string, MessageKey>> = {
  actions: "components.categoryActions",
  typography: "components.categoryTypography",
  media: "components.categoryMedia",
  content: "components.categoryContent",
  layout: "components.categoryLayout",
  navigation: "components.categoryNavigation",
  commerce: "components.categoryCommerce",
  other: "components.categoryOther"
};

const COMMAND_KEYS: Readonly<Record<string, MessageKey>> = {
  "node.insert": "history.commandInsert",
  "node.move": "history.commandMove",
  "node.remove": "history.commandRemove",
  "node.setLayoutProperty": "history.commandSetLayoutProperty",
  "node.setProp": "history.commandSetProp",
  "node.setVariant": "history.commandSetVariant",
  "node.setToken": "history.commandSetToken",
  "node.setResponsivePolicy": "history.commandSetResponsivePolicy",
  "node.setRole": "history.commandSetRole"
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
    const saved =
      payload.type === "saved"
        ? session.savedComponents.find(({ id }) => id === payload.id)
        : undefined;
    const source =
      payload.type === "component"
        ? { kind: "component" as const, componentRef: payload.id }
        : saved?.node.kind === "component"
          ? { kind: "component" as const, componentRef: saved.node.componentRef }
          : { kind: "layout" as const };
    return { payload, source };
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
          const resolution = resolveInsertTarget(document, catalog, insert.source, node.id, { x: event.clientX, y: event.clientY }, {
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
          const resolution = resolveInsertTarget(document, catalog, insert.source, node.id, { x: event.clientX, y: event.clientY }, {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          });
          setDropIndicator(undefined);
          if (resolution.valid)
            void (insert.payload.type === "component"
              ? session.insertComponent(insert.payload.id, resolution.target)
              : session.insertSavedComponent(insert.payload.id, resolution.target));
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
  const { locale, t } = useI18n();
  const { openComponentWorkbench } = useComponentWorkbenchNavigation();
  const { openContextMenu } = useContextMenu();
  const customComponents = useCustomComponents();
  const [query, setQuery] = useState("");
  const definitions = Object.values(session.catalog?.components.components ?? {});
  const filtered = definitions.filter((component) =>
    [component.name, displayLabel(component.displayName, component.name, locale), component.source, ...component.roles]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
  const groups = useMemo(() => {
    const result = new Map<string, typeof filtered>();
    for (const component of filtered) {
      const key = component.category ?? "other";
      const values = result.get(key) ?? [];
      values.push(component);
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
      <div className="component-create-card">
        <div>
          <strong>{t("componentWorkbench.create")}</strong>
          <span>{t("componentWorkbench.createDescription")}</span>
        </div>
        <Button onPress={() => openComponentWorkbench()}>{t("componentWorkbench.create")}</Button>
      </div>
      {customComponents.length ? (
        <>
          <p className="tool-section-title">{t("componentWorkbench.custom")}</p>
          <div className="custom-component-list">
            {customComponents.map((component) => {
              const savedId = `custom_${component.id}`;
              return (
                <div key={component.id}>
                  <div
                    className="custom-component-tile"
                    draggable
                    title={`${component.name} · ${t("components.dragToInsert")}`}
                    onDragStart={(event) => {
                      session.beginInsertDrag({ type: "saved", id: savedId });
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData(SAVED_COMPONENT_DRAG_MIME, savedId);
                    }}
                    onDragEnd={session.endInsertDrag}
                    onContextMenu={(event) =>
                      openContextMenu(event, {
                        type: "custom-component",
                        id: component.id,
                        label: component.name,
                        capabilities: {
                          edit: { execute: () => openComponentWorkbench(component.id) },
                          remove: {
                            execute: () => {
                              removeCustomComponent(component.id);
                              session.removeSavedComponent(savedId);
                            }
                          }
                        }
                      })
                    }
                  >
                    <span>◇</span>
                    <div><b>{component.name}</b><small>{component.variables.length} V · {component.slots.length} S</small></div>
                  </div>
                  <span className="custom-component-actions">
                    <IconButton
                      icon={<ProductIcon name="settings" />}
                      label={t("componentWorkbench.create")}
                      onPress={() => openComponentWorkbench(component.id)}
                    />
                    <IconButton
                      icon={<ProductIcon name="close" />}
                      label={t("components.removeSaved", { name: component.name })}
                      onPress={() => {
                        removeCustomComponent(component.id);
                        session.removeSavedComponent(savedId);
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      <p className="tool-section-title">{t("components.registered")}</p>
      {groups.length ? (
        groups.map(([category, components]) => (
          <section className="component-group" key={category}>
            <h3>
              {components[0]?.categoryDisplayName
                ? displayLabel(components[0].categoryDisplayName, category, locale)
                : t(CATEGORY_KEYS[category] ?? "components.categoryOther")}
            </h3>
            <div className="component-grid">
              {components.map((component) => {
                const label = displayLabel(component.displayName, component.name, locale);
                return (
                  <div
                    className={`component-tile${session.status === "saving" ? " is-disabled" : ""}`}
                    draggable={session.status !== "saving"}
                    title={`${label} · ${t("components.dragToInsert")}`}
                    key={component.name}
                    onDragStart={(event) => {
                      session.beginInsertDrag({ type: "component", id: component.name });
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
                    <span>{label.slice(0, 2)}</span>
                    <b>{label}</b>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <div className="tool-empty">
          {t("components.noMatches", { query })}{" "}
          <ActionButton onPress={() => setQuery("")}>{t("common.clearSearch")}</ActionButton>
        </div>
      )}
      <p className="tool-section-title">{t("components.saved")}</p>
      {session.savedComponents.some((saved) => !saved.customComponentId) ? (
        <div className="saved-component-list">
          {session.savedComponents.filter((saved) => !saved.customComponentId).map((saved) => (
            <div key={saved.id}>
              <div
                className={`saved-component-tile${session.status === "saving" ? " is-disabled" : ""}`}
                draggable={session.status !== "saving"}
                title={`${saved.displayName} · ${t("components.dragToInsert")}`}
                onDragStart={(event) => {
                  session.beginInsertDrag({ type: "saved", id: saved.id });
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData(SAVED_COMPONENT_DRAG_MIME, saved.id);
                }}
                onDragEnd={session.endInsertDrag}
                onContextMenu={(event) =>
                  openContextMenu(event, {
                    type: "saved-component",
                    id: saved.id,
                    label: saved.displayName,
                    capabilities: {
                      remove: {
                        execute: () => session.removeSavedComponent(saved.id),
                        isDisabled: session.status === "saving"
                      }
                    }
                  })
                }
              >
                <span>◆</span>
                <b>{saved.displayName}</b>
              </div>
              <span className="saved-component-remove">
                <IconButton
                  icon={<ProductIcon name="close" />}
                  label={t("components.removeSaved", { name: saved.displayName })}
                  onPress={() => session.removeSavedComponent(saved.id)}
                />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="component-empty-note">{t("components.noSaved")}</p>
      )}
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
      <div className="inspector-field">
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
      <div className="inspector-field">
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
      <div className="inspector-field">
        <NumberField
          label={label}
          value={Number.isFinite(numberValue) ? numberValue : 0}
          isDisabled={session.status === "saving"}
          {...(definition.required === undefined ? {} : { isRequired: definition.required })}
          onChange={(next) => setDraft(String(next))}
          onBlur={commitDraft}
          onSubmit={commitDraft}
        />
      </div>
    );
  }
  return (
    <div className="inspector-field">
      <TextField
        label={label}
        value={draft}
        isDisabled={session.status === "saving"}
        {...(definition.required === undefined ? {} : { isRequired: definition.required })}
        onChange={setDraft}
        onBlur={commitDraft}
        onSubmit={commitDraft}
      />
    </div>
  );
}

export function InspectorPanel() {
  const session = useStudioSession();
  const { format, locale, t } = useI18n();
  const node = session.selectedNode;
  const [contentOpen, setContentOpen] = useState(true);
  const [appearanceOpen, setAppearanceOpen] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedName, setSavedName] = useState("");
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
  const saveReusable = (): void => {
    if (!savedName.trim()) return;
    if (session.saveSelectedComponent(savedName)) {
      setSaveOpen(false);
      setSavedName("");
    }
  };
  return (
    <div className="tool-panel inspector">
      <div className="selection-summary">
        <span className="selection-icon">{title[0]?.toUpperCase()}</span>
        <div>
          <strong>{title}</strong>
          <small>{node.kind === "component" ? t("common.component") : t("common.layout")}</small>
        </div>
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
              {definition.variants.length ? (
                <div className="inspector-field">
                  <Select
                    label={t("inspector.variant")}
                    options={definition.variants.map((variant) => ({
                      id: variant,
                      label: displayLabel(definition.variantDisplayNames?.[variant], variant, locale)
                    }))}
                    selectedKey={node.variant ?? definition.variants[0]!}
                    isDisabled={session.status === "saving"}
                    onSelectionChange={(key) => void session.setVariant(node.id, key)}
                  />
                </div>
              ) : null}
              {Object.entries(node.tokens ?? {}).map(([name, token]) => (
                <div className="readonly-field" key={name}>
                  <span>{displayLabel(undefined, name, locale)}</span>
                  <output title={t("inspector.tokenReadOnlyTitle")}>{displayLabel(undefined, token, locale)}</output>
                </div>
              ))}
            </Disclosure>
          </div>
          <div className="inspector-note">{t("inspector.componentNote")}</div>
        </>
      ) : (
        <div className="inspector-note">{t("inspector.layoutNote")}</div>
      )}
      <div className="inspector-save">
        {saveOpen ? (
          <>
            <div className="inspector-save-field">
              <TextField
                label={t("components.saveReusable")}
                autoFocus
                value={savedName}
                onChange={setSavedName}
                onSubmit={saveReusable}
                placeholder={title}
              />
            </div>
            <div className="inspector-save-actions">
              <Button isDisabled={!savedName.trim()} onPress={saveReusable}>
                {t("common.save")}
              </Button>
              <Button variant="secondary" onPress={() => setSaveOpen(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </>
        ) : (
          <ActionButton
            onPress={() => {
              setSavedName(title);
              setSaveOpen(true);
            }}
          >
            {t("components.saveReusable")}
          </ActionButton>
        )}
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
