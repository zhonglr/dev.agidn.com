import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { GetCatalogResponse } from "@agidn/api-protocol";
import { decodePreviewToStudioMessage, PREVIEW_PROTOCOL_VERSION, type PreviewRect } from "@agidn/preview-protocol";
import { findNode, type ComponentNode, type PageDocument, type PageNode } from "@agidn/document-schema";
import {
  createCustomComponentAsset,
  createSlot,
  createVariable,
  getCustomComponent,
  saveCustomComponent,
  type CustomComponentAsset,
  type CustomComponentSlot,
  type CustomComponentVariable,
  type CustomSlotValueType,
  type CustomValueType
} from "./custom-components.js";
import { displayLabel } from "./display-label.js";
import { useI18n } from "./i18n.js";
import { useStudioSession, type InsertTarget } from "./studio-session.js";
import { COMPONENT_DRAG_MIME, NODE_DRAG_MIME, resolveInsertTarget, resolveMoveTarget } from "./structure-drag.js";
import {
  ActionButton,
  Button,
  Checkbox,
  IconButton,
  NumberField,
  ProductIcon,
  Select,
  TextField,
  useContextMenu,
  type SelectOption
} from "./components/ui/index.js";

function defaultValue(
  definition: GetCatalogResponse["components"]["components"][string]["props"][string],
  defaultContent: string
): unknown {
  if (definition.type === "boolean") return false;
  if (definition.type === "number") return 0;
  if (definition.type === "enum") return definition.values?.[0] ?? "";
  return defaultContent;
}

function createComponentNode(
  catalog: GetCatalogResponse,
  componentRef: string,
  defaultContent: string,
  depth = 0
): ComponentNode | undefined {
  const definition = catalog.components.components[componentRef];
  if (!definition) return undefined;
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const props = Object.fromEntries(
    Object.entries(definition.props)
      .filter(([, prop]) => prop.required)
      .map(([name, prop]) => [name, defaultValue(prop, defaultContent)])
  );
  const slots: Record<string, PageNode[]> = {};
  if (depth < 3) {
    for (const [slotName, slot] of Object.entries(definition.slots)) {
      const count = Math.max(slot.minItems ?? 0, slot.required ? 1 : 0);
      if (!count) continue;
      const childRef = slot.accepts?.find((candidate) => candidate !== "*") ?? "Text";
      const children = Array.from({ length: count }, () =>
        createComponentNode(catalog, childRef, defaultContent, depth + 1)
      ).filter((node): node is ComponentNode => Boolean(node));
      if (children.length) slots[slotName] = children;
    }
  }
  return {
    id: `${componentRef.toLowerCase()}_${suffix}`,
    kind: "component",
    componentRef,
    ...(definition.variants[0] ? { variant: definition.variants[0] } : {}),
    ...(Object.keys(props).length ? { props } : {}),
    ...(Object.keys(slots).length ? { slots } : {})
  };
}

function childCollections(node: PageNode): PageNode[][] {
  return node.kind === "layout" ? [node.children] : Object.values(node.slots ?? {});
}

function visitNodes(document: PageDocument, visitor: (node: PageNode) => void): void {
  const visit = (node: PageNode): void => {
    visitor(node);
    childCollections(node).flat().forEach(visit);
  };
  document.children.forEach(visit);
}

function insertNode(document: PageDocument, target: InsertTarget, node: PageNode): boolean {
  let collection: PageNode[] | undefined;
  if (target.parentId === document.id) {
    collection = document.children;
  } else {
    const parent = findNode(document, target.parentId);
    if (parent?.kind === "layout" && !target.slot) collection = parent.children;
    if (parent?.kind === "component" && target.slot) {
      parent.slots ??= {};
      collection = parent.slots[target.slot] ??= [];
    }
  }
  if (!collection) return false;
  const index = target.beforeNodeId ? collection.findIndex(({ id }) => id === target.beforeNodeId) : collection.length;
  if (index < 0) return false;
  collection.splice(index, 0, node);
  return true;
}

function removeNode(document: PageDocument, nodeId: string): boolean {
  const remove = (collection: PageNode[]): boolean => {
    const index = collection.findIndex(({ id }) => id === nodeId);
    if (index >= 0) {
      collection.splice(index, 1);
      return true;
    }
    return collection.some((node) => childCollections(node).some(remove));
  };
  return remove(document.children);
}

function nodeLabel(node: PageNode): string {
  return node.name ?? (node.kind === "component" ? node.componentRef : node.layout);
}

function containsNode(node: PageNode, nodeId: string): boolean {
  return (
    node.id === nodeId ||
    childCollections(node)
      .flat()
      .some((child) => containsNode(child, nodeId))
  );
}

type ComponentTreeEntry =
  | { kind: "node"; node: PageNode; depth: number; parentId?: string }
  | { kind: "slot"; id: string; name: string; parentId: string; depth: number; children: readonly PageNode[] };

function collectComponentTree(
  nodes: readonly PageNode[],
  expanded: ReadonlySet<string>,
  depth = 1,
  parentId?: string
): ComponentTreeEntry[] {
  const entries: ComponentTreeEntry[] = [];
  for (const node of nodes) {
    entries.push({ kind: "node", node, depth, ...(parentId ? { parentId } : {}) });
    if (!expanded.has(node.id)) continue;
    if (node.kind === "layout") {
      entries.push(...collectComponentTree(node.children, expanded, depth + 1, node.id));
      continue;
    }
    for (const [slotName, children] of Object.entries(node.slots ?? {})) {
      const slotId = `${node.id}::${slotName}`;
      entries.push({
        kind: "slot",
        id: slotId,
        name: slotName,
        parentId: node.id,
        depth: depth + 1,
        children
      });
      if (expanded.has(slotId)) entries.push(...collectComponentTree(children, expanded, depth + 2, node.id));
    }
  }
  return entries;
}

function withBinding<T extends { binding?: string }>(item: T, binding: string): T {
  const copy = { ...item };
  delete copy.binding;
  if (binding) copy.binding = binding;
  return copy;
}

function VariableInitialValue({
  variable,
  onChange
}: {
  variable: CustomComponentVariable;
  onChange: (value: string | number | boolean) => void;
}) {
  if (variable.type === "boolean") {
    return <Checkbox label="Initial value" isSelected={variable.initialValue === true} onChange={onChange} />;
  }
  if (variable.type === "number") {
    return (
      <NumberField
        label="Initial value"
        value={typeof variable.initialValue === "number" ? variable.initialValue : 0}
        onChange={onChange}
      />
    );
  }
  return <TextField label="Initial value" value={String(variable.initialValue)} onChange={onChange} />;
}

export interface ComponentWorkbenchProps {
  componentId?: string;
  onClose: () => void;
  onSaved: (componentId: string) => void;
}

export function ComponentWorkbench({ componentId, onClose, onSaved }: ComponentWorkbenchProps) {
  const session = useStudioSession();
  const { locale, t } = useI18n();
  const { openContextMenu } = useContextMenu();
  const [asset, setAsset] = useState<CustomComponentAsset>(() =>
    componentId ? (getCustomComponent(componentId) ?? createCustomComponentAsset()) : createCustomComponentAsset()
  );
  const [revision, setRevision] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(
    () => new Set([asset.document.children[0]?.id].filter((id): id is string => Boolean(id)))
  );
  const [treeDropIndicator, setTreeDropIndicator] = useState<{
    id: string;
    position: "before" | "inside" | "after";
  }>();
  const [selectionBounds, setSelectionBounds] = useState<{ nodeId: string; rect: PreviewRect }>();
  const [previewReady, setPreviewReady] = useState(false);
  const [saved, setSaved] = useState(Boolean(componentId));
  const stageRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initializedRef = useRef(false);
  const requestRef = useRef(0);
  const pendingDropsRef = useRef(new Map<string, string>());
  const assetRef = useRef(asset);
  const revisionRef = useRef(revision);
  const selectedRef = useRef(selectedNodeId);
  assetRef.current = asset;
  revisionRef.current = revision;
  selectedRef.current = selectedNodeId;
  const selectionRect =
    selectionBounds && selectionBounds.nodeId === selectedNodeId ? selectionBounds.rect : undefined;
  const previewUrl = import.meta.env.VITE_PREVIEW_URL ?? "http://127.0.0.1:4174/";

  useEffect(() => {
    if (!selectedNodeId) return;
    const path = new Set<string>();
    const reveal = (nodes: readonly PageNode[]): boolean => {
      for (const node of nodes) {
        if (node.id === selectedNodeId) return true;
        if (node.kind === "layout") {
          if (reveal(node.children)) {
            path.add(node.id);
            return true;
          }
          continue;
        }
        for (const [slotName, children] of Object.entries(node.slots ?? {})) {
          if (reveal(children)) {
            path.add(node.id);
            path.add(`${node.id}::${slotName}`);
            return true;
          }
        }
      }
      return false;
    };
    if (!reveal(asset.document.children)) return;
    setTreeExpanded((current) => {
      const next = new Set(current);
      let changed = false;
      for (const id of path) {
        if (next.has(id)) continue;
        next.add(id);
        changed = true;
      }
      return changed ? next : current;
    });
  }, [asset.document.children, selectedNodeId]);

  const nextRequestId = useCallback((prefix: string) => `${prefix}_${++requestRef.current}`, []);
  const messageBase = useCallback(
    (requestId: string) => ({
      source: "agidn.studio" as const,
      protocolVersion: PREVIEW_PROTOCOL_VERSION,
      requestId,
      documentRevision: revisionRef.current
    }),
    []
  );
  const post = useCallback((message: object): void => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);
  const revealSelection = useCallback((rect: PreviewRect): void => {
    const stage = stageRef.current;
    const preview = iframeRef.current;
    if (!stage || !preview) return;
    const stageRect = stage.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const left = previewRect.left - stageRect.left + stage.scrollLeft + rect.x;
    const top = previewRect.top - stageRect.top + stage.scrollTop + rect.y;
    const right = left + rect.width;
    const bottom = top + rect.height;
    const padding = 40;
    const visible =
      left >= stage.scrollLeft + padding &&
      top >= stage.scrollTop + 42 + padding &&
      right <= stage.scrollLeft + stage.clientWidth - padding &&
      bottom <= stage.scrollTop + stage.clientHeight - padding;
    if (visible) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stage.scrollTo({
      left: Math.max(0, left + rect.width / 2 - stage.clientWidth / 2),
      top: Math.max(0, top + rect.height / 2 - stage.clientHeight / 2),
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }, []);

  const updateAsset = useCallback((update: (current: CustomComponentAsset) => CustomComponentAsset): void => {
    setAsset((current) => update(current));
    setSaved(false);
  }, []);

  const updateDocument = useCallback(
    (update: (document: PageDocument) => void): void => {
      updateAsset((current) => {
        const document = structuredClone(current.document);
        update(document);
        return { ...current, document };
      });
      setRevision((value) => value + 1);
    },
    [updateAsset]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const decoded = decodePreviewToStudioMessage(event.data);
      if (!decoded.valid) return;
      const message = decoded.message;
      if (message.type === "preview.ready") {
        if (!initializedRef.current) {
          post({
            ...messageBase(nextRequestId("component_initialize")),
            type: "preview.initialize",
            document: assetRef.current.document,
            breakpoint: "desktop",
            ...(selectedRef.current ? { selectedNodeId: selectedRef.current } : {})
          });
          initializedRef.current = true;
        }
        return;
      }
      if (message.documentRevision !== revisionRef.current) return;
      if (message.type === "preview.nodePointerDown") {
        setSelectedNodeId(message.nodeId);
        setSelectionBounds({ nodeId: message.nodeId, rect: message.rect });
        revealSelection(message.rect);
      } else if (message.type === "preview.nodeBounds" && message.nodeId === selectedRef.current) {
        setSelectionBounds({ nodeId: message.nodeId, rect: message.rect });
        revealSelection(message.rect);
      } else if (message.type === "preview.dropIntent") {
        const componentRef = pendingDropsRef.current.get(message.requestId);
        pendingDropsRef.current.delete(message.requestId);
        const catalog = session.catalog;
        if (!componentRef || !catalog) return;
        const resolution = resolveInsertTarget(
          assetRef.current.document,
          catalog,
          { kind: "component", componentRef },
          message.nodeId,
          message.pointerY,
          message.rect
        );
        if (!resolution.valid) return;
        const node = createComponentNode(catalog, componentRef, t("defaults.newContent"));
        if (!node) return;
        updateDocument((document) => {
          insertNode(document, resolution.target, node);
        });
        setSelectedNodeId(node.id);
      } else if (message.type === "preview.contentOverflow") {
        setPreviewReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [messageBase, nextRequestId, post, revealSelection, session.catalog, t, updateDocument]);

  useEffect(() => {
    if (!previewReady || !initializedRef.current) return;
    post({
      ...messageBase(nextRequestId("component_document")),
      type: "preview.setDocument",
      document: asset.document
    });
  }, [asset.document, messageBase, nextRequestId, post, previewReady, revision]);

  useEffect(() => {
    if (!previewReady || !initializedRef.current) return;
    post({
      ...messageBase(nextRequestId("component_selection")),
      type: "preview.setSelection",
      ...(selectedNodeId ? { nodeId: selectedNodeId } : {})
    });
    if (!selectedNodeId) setSelectionBounds(undefined);
  }, [messageBase, nextRequestId, post, previewReady, selectedNodeId]);

  const selectedNode = selectedNodeId ? findNode(asset.document, selectedNodeId) : undefined;
  const treeEntries = useMemo(
    () => collectComponentTree(asset.document.children, treeExpanded),
    [asset.document.children, treeExpanded]
  );
  const definitions = Object.values(session.catalog?.components.components ?? {});
  const valueTypeOptions: readonly SelectOption[] = [
    { id: "string", label: t("componentWorkbench.typeString") },
    { id: "number", label: t("componentWorkbench.typeNumber") },
    { id: "boolean", label: t("componentWorkbench.typeBoolean") },
    { id: "enum", label: t("componentWorkbench.typeEnum") }
  ];
  const slotTypeOptions: readonly SelectOption[] = [
    { id: "component", label: t("componentWorkbench.slotSingle") },
    { id: "component-list", label: t("componentWorkbench.slotList") },
    { id: "text", label: t("componentWorkbench.slotText") }
  ];
  const propertyBindings = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [{ id: "", label: "Unbound" }];
    visitNodes(asset.document, (node) => {
      if (node.kind !== "component") return;
      const definition = session.catalog?.components.components[node.componentRef];
      for (const property of Object.keys(definition?.props ?? {})) {
        options.push({ id: `${node.id}::${property}`, label: `${nodeLabel(node)} · ${property}` });
      }
    });
    return options;
  }, [asset.document, session.catalog]);
  const slotBindings = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [{ id: "", label: "Unbound" }];
    visitNodes(asset.document, (node) => {
      if (node.kind !== "component") return;
      const definition = session.catalog?.components.components[node.componentRef];
      for (const slot of Object.keys(definition?.slots ?? {})) {
        options.push({ id: `${node.id}::${slot}`, label: `${nodeLabel(node)} · ${slot}` });
      }
    });
    return options;
  }, [asset.document, session.catalog]);

  const applyVariableValue = useCallback(
    (binding: string | undefined, value: string | number | boolean): void => {
      if (!binding) return;
      const [nodeId, property] = binding.split("::");
      if (!nodeId || !property) return;
      updateDocument((document) => {
        const node = findNode(document, nodeId);
        if (node?.kind === "component") (node.props ??= {})[property] = value;
      });
    },
    [updateDocument]
  );

  const updateVariable = (
    variableId: string,
    update: (variable: CustomComponentVariable) => CustomComponentVariable
  ): void => {
    updateAsset((current) => ({
      ...current,
      variables: current.variables.map((variable) => (variable.id === variableId ? update(variable) : variable))
    }));
  };
  const updateSlot = (slotId: string, update: (slot: CustomComponentSlot) => CustomComponentSlot): void => {
    updateAsset((current) => ({
      ...current,
      slots: current.slots.map((slot) => (slot.id === slotId ? update(slot) : slot))
    }));
  };

  const save = (): void => {
    const next = saveCustomComponent({
      ...asset,
      document: { ...asset.document, name: asset.name }
    });
    setAsset(next);
    const root = next.document.children[0];
    if (root) session.upsertCustomComponentTemplate(next.id, next.name, root);
    setSaved(true);
    onSaved(next.id);
  };

  const pointerInPreview = (event: ReactPointerEvent | DragEvent): { x: number; y: number } | undefined => {
    const rect = iframeRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  return (
    <main className="component-workbench">
      <header className="component-workbench__header">
        <div className="component-workbench__header-start">
          <ActionButton onPress={onClose}>← {t("componentWorkbench.back")}</ActionButton>
          <span className="component-workbench__mode">{t("componentWorkbench.focusMode")}</span>
        </div>
        <div className="component-workbench__identity">
          <TextField
            label={t("componentWorkbench.componentName")}
            value={asset.name}
            onChange={(name) => updateAsset((current) => ({ ...current, name }))}
          />
        </div>
        <div className="component-workbench__actions">
          <span className={saved ? "is-saved" : "is-dirty"}>
            {saved ? t("componentWorkbench.saved") : t("componentWorkbench.unsaved")}
          </span>
          <Button isDisabled={!asset.name.trim()} onPress={save}>
            {t("common.save")}
          </Button>
        </div>
      </header>

      <aside className="component-workbench__tree-panel">
        <div className="component-workbench__panel-heading">
          <span>{t("componentWorkbench.layers")}</span>
        </div>
        <div
          className="component-workbench__tree tree"
          role="tree"
          tabIndex={-1}
          aria-label={t("componentWorkbench.treeLabel")}
          onKeyDown={(event) => {
            if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
            const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=treeitem]")];
            const current = document.activeElement instanceof HTMLElement ? rows.indexOf(document.activeElement) : -1;
            const index =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? rows.length - 1
                  : Math.max(0, Math.min(rows.length - 1, current + (event.key === "ArrowUp" ? -1 : 1)));
            if (rows[index]) {
              event.preventDefault();
              rows[index].focus();
            }
          }}
        >
          <div
            className="tree-row tree-row--root"
            role="treeitem"
            tabIndex={0}
            aria-selected={false}
            aria-expanded
            onContextMenu={(event) =>
              openContextMenu(event, {
                type: "component-asset",
                id: asset.id,
                label: asset.name
              })
            }
          >
            <span className="tree-disclosure-placeholder" />
            <span className="tree-kind">C</span>
            <strong className="tree-label">{asset.name}</strong>
          </div>
          {treeEntries.map((entry) => {
            if (entry.kind === "slot") {
              const expanded = treeExpanded.has(entry.id);
              return (
                <div
                  className={`tree-row component-tree-slot${treeDropIndicator?.id === entry.id ? " is-drop-inside" : ""}`}
                  role="treeitem"
                  tabIndex={-1}
                  aria-selected={false}
                  aria-level={entry.depth + 1}
                  aria-expanded={entry.children.length ? expanded : undefined}
                  style={{ paddingLeft: 6 + entry.depth * 14, "--tree-depth": entry.depth } as CSSProperties}
                  key={entry.id}
                  onDragOver={(event) => {
                    const sourceNodeId = event.dataTransfer.getData(NODE_DRAG_MIME);
                    const source = sourceNodeId ? findNode(asset.document, sourceNodeId) : undefined;
                    const parent = findNode(asset.document, entry.parentId);
                    const slot =
                      parent?.kind === "component"
                        ? session.catalog?.components.components[parent.componentRef]?.slots[entry.name]
                        : undefined;
                    const accepts = slot?.accepts ?? ["*"];
                    if (
                      !source ||
                      !parent ||
                      !slot ||
                      sourceNodeId === entry.parentId ||
                      containsNode(source, entry.parentId) ||
                      (source.kind !== "component" && !accepts.includes("*")) ||
                      (source.kind === "component" &&
                        !accepts.includes("*") &&
                        !accepts.includes(source.componentRef)) ||
                      (slot.maxItems !== undefined && entry.children.length >= slot.maxItems)
                    )
                      return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setTreeDropIndicator({ id: entry.id, position: "inside" });
                  }}
                  onDragLeave={() => setTreeDropIndicator(undefined)}
                  onContextMenu={(event) =>
                    openContextMenu(event, {
                      type: "component-slot",
                      id: entry.id,
                      label: entry.name
                    })
                  }
                  onDrop={(event) => {
                    const sourceNodeId = event.dataTransfer.getData(NODE_DRAG_MIME);
                    if (!sourceNodeId || sourceNodeId === entry.parentId) return;
                    event.preventDefault();
                    updateDocument((document) => {
                      const source = findNode(document, sourceNodeId);
                      const parent = findNode(document, entry.parentId);
                      const slot =
                        parent?.kind === "component"
                          ? session.catalog?.components.components[parent.componentRef]?.slots[entry.name]
                          : undefined;
                      const accepts = slot?.accepts ?? ["*"];
                      if (
                        !source ||
                        !parent ||
                        !slot ||
                        containsNode(source, entry.parentId) ||
                        (source.kind !== "component" && !accepts.includes("*")) ||
                        (source.kind === "component" &&
                          !accepts.includes("*") &&
                          !accepts.includes(source.componentRef)) ||
                        (slot.maxItems !== undefined && entry.children.length >= slot.maxItems)
                      )
                        return;
                      const moving = structuredClone(source);
                      if (!removeNode(document, sourceNodeId)) return;
                      insertNode(document, { parentId: entry.parentId, slot: entry.name }, moving);
                    });
                    setTreeDropIndicator(undefined);
                    setSelectedNodeId(sourceNodeId);
                  }}
                >
                  {entry.children.length ? (
                    <button
                      type="button"
                      className="tree-disclosure"
                      aria-label={t(expanded ? "outline.collapseNode" : "outline.expandNode", {
                        node: entry.name
                      })}
                      onClick={() =>
                        setTreeExpanded((current) => {
                          const next = new Set(current);
                          if (expanded) next.delete(entry.id);
                          else next.add(entry.id);
                          return next;
                        })
                      }
                    >
                      {expanded ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="tree-disclosure-placeholder" />
                  )}
                  <span className="tree-kind component-tree-slot__kind">S</span>
                  <span className="tree-label">{entry.name}</span>
                </div>
              );
            }
            const { node } = entry;
            const children = childCollections(node).flat();
            const expanded = treeExpanded.has(node.id);
            return (
              <div
                className={`tree-row${selectedNodeId === node.id ? " is-selected" : ""}${treeDropIndicator?.id === node.id ? ` is-drop-${treeDropIndicator.position}` : ""}`}
                role="treeitem"
                tabIndex={-1}
                draggable={entry.depth > 1}
                aria-level={entry.depth + 1}
                aria-selected={selectedNodeId === node.id}
                aria-expanded={children.length ? expanded : undefined}
                style={{ paddingLeft: 6 + entry.depth * 14, "--tree-depth": entry.depth } as CSSProperties}
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                onContextMenu={(event) =>
                  openContextMenu(event, {
                    type: "node",
                    id: node.id,
                    label: nodeLabel(node),
                    metadata: { nodeKind: node.kind, surface: "component-workbench" },
                    capabilities: {
                      select: { execute: () => setSelectedNodeId(node.id) },
                      remove: {
                        execute: () => {
                          updateDocument((document) => {
                            removeNode(document, node.id);
                          });
                          setSelectedNodeId(undefined);
                        }
                      }
                    }
                  })
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedNodeId(node.id);
                }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(NODE_DRAG_MIME, node.id);
                  setSelectedNodeId(node.id);
                }}
                onDragEnd={() => setTreeDropIndicator(undefined)}
                onDragLeave={() => setTreeDropIndicator(undefined)}
                onDragOver={(event) => {
                  const sourceNodeId = event.dataTransfer.getData(NODE_DRAG_MIME);
                  if (!sourceNodeId || !session.catalog) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const resolution = resolveMoveTarget(
                    asset.document,
                    session.catalog,
                    sourceNodeId,
                    node.id,
                    event.clientY,
                    { y: rect.top, height: rect.height }
                  );
                  if (!resolution.valid) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setTreeDropIndicator({ id: node.id, position: resolution.position });
                }}
                onDrop={(event) => {
                  const sourceNodeId = event.dataTransfer.getData(NODE_DRAG_MIME);
                  if (!sourceNodeId || !session.catalog) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const resolution = resolveMoveTarget(
                    asset.document,
                    session.catalog,
                    sourceNodeId,
                    node.id,
                    event.clientY,
                    { y: rect.top, height: rect.height }
                  );
                  if (!resolution.valid) return;
                  event.preventDefault();
                  updateDocument((document) => {
                    const source = findNode(document, sourceNodeId);
                    if (!source) return;
                    const moving = structuredClone(source);
                    if (!removeNode(document, sourceNodeId)) return;
                    insertNode(document, resolution.target, moving);
                  });
                  setTreeDropIndicator(undefined);
                  setSelectedNodeId(sourceNodeId);
                }}
              >
                {children.length ? (
                  <button
                    type="button"
                    className="tree-disclosure"
                    aria-label={t(expanded ? "outline.collapseNode" : "outline.expandNode", {
                      node: nodeLabel(node)
                    })}
                    onClick={(event) => {
                      event.stopPropagation();
                      setTreeExpanded((current) => {
                        const next = new Set(current);
                        if (expanded) next.delete(node.id);
                        else next.add(node.id);
                        return next;
                      });
                    }}
                  >
                    {expanded ? "▾" : "▸"}
                  </button>
                ) : (
                  <span className="tree-disclosure-placeholder" />
                )}
                <span className={`tree-kind ${node.kind}`}>
                  {node.kind === "component" ? node.componentRef[0] : node.layout[0]!.toUpperCase()}
                </span>
                <span className="tree-label" title={`${nodeLabel(node)} · ${node.id}`}>
                  {nodeLabel(node)}
                </span>
              </div>
            );
          })}
        </div>
      </aside>

      <aside className="component-workbench__library">
        <div className="component-workbench__panel-heading">
          <span>{t("componentWorkbench.buildingBlocks")}</span>
          <small>{t("componentWorkbench.dragHint")}</small>
        </div>
        <div className="component-workbench__component-list">
          {definitions.map((definition) => {
            const label = displayLabel(definition.displayName, definition.name, locale);
            return (
              <div
                className="component-workbench__component-tile"
                draggable
                key={definition.name}
                title={`${label} · ${t("components.dragToInsert")}`}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData(COMPONENT_DRAG_MIME, definition.name);
                }}
                onContextMenu={(event) =>
                  openContextMenu(event, {
                    type: "registered-component",
                    id: definition.name,
                    label
                  })
                }
              >
                <span>{label.slice(0, 2)}</span>
                <b>{label}</b>
                <small>{definition.category ?? t("components.categoryOther")}</small>
              </div>
            );
          })}
        </div>
      </aside>

      <section ref={stageRef} className="component-workbench__stage">
        <div className="component-workbench__stage-label">
          <strong>{asset.name}</strong>
          <span>Desktop · 900 × 720</span>
        </div>
        <div
          className="component-workbench__preview-shell"
          onPointerDown={(event) => {
            const point = pointerInPreview(event);
            if (!point || !previewReady) return;
            post({ ...messageBase(nextRequestId("component_hit")), type: "preview.hitTest", ...point });
          }}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(COMPONENT_DRAG_MIME)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            const componentRef = event.dataTransfer.getData(COMPONENT_DRAG_MIME);
            const point = pointerInPreview(event);
            if (!componentRef || !point || !previewReady) return;
            event.preventDefault();
            const requestId = nextRequestId("component_drop");
            pendingDropsRef.current.set(requestId, componentRef);
            post({
              ...messageBase(requestId),
              type: "preview.resolveDrop",
              componentRef,
              ...point
            });
          }}
        >
          <iframe
            ref={iframeRef}
            className="component-workbench__preview"
            title={t("componentWorkbench.previewTitle")}
            src={previewUrl}
            sandbox="allow-scripts"
            width={900}
            height={720}
            onLoad={() => {
              initializedRef.current = false;
              setPreviewReady(false);
            }}
          />
          {selectionRect ? (
            <div
              className="component-workbench__selection"
              style={{
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.width,
                height: selectionRect.height
              }}
            />
          ) : null}
          {previewReady &&
          asset.document.children[0]?.kind === "layout" &&
          asset.document.children[0].children.length === 0 ? (
            <div className="component-workbench__empty-preview">
              <ProductIcon name="components" />
              <strong>{t("componentWorkbench.emptyPreview")}</strong>
              <span>{t("componentWorkbench.dragHint")}</span>
            </div>
          ) : null}
          {!previewReady ? <div className="component-workbench__preview-status">{t("canvas.connecting")}</div> : null}
        </div>
      </section>

      <aside className="component-workbench__configuration">
        <section className="component-config-section">
          <div className="component-config-section__title">
            <div>
              <span>{t("componentWorkbench.variables")}</span>
              <small>{t("componentWorkbench.variablesHelp")}</small>
            </div>
            <ActionButton
              onPress={() =>
                updateAsset((current) => ({ ...current, variables: [...current.variables, createVariable()] }))
              }
            >
              + {t("componentWorkbench.addVariable")}
            </ActionButton>
          </div>
          {asset.variables.map((variable) => (
            <div className="component-config-card" key={variable.id}>
              <div className="component-config-card__header">
                <strong>{variable.name || t("componentWorkbench.unnamedVariable")}</strong>
                <IconButton
                  icon={<ProductIcon name="close" />}
                  label={t("componentWorkbench.removeVariable", { name: variable.name })}
                  onPress={() =>
                    updateAsset((current) => ({
                      ...current,
                      variables: current.variables.filter(({ id }) => id !== variable.id)
                    }))
                  }
                />
              </div>
              <TextField
                label={t("componentWorkbench.name")}
                value={variable.name}
                onChange={(name) => updateVariable(variable.id, (current) => ({ ...current, name }))}
              />
              <Select
                label={t("componentWorkbench.valueType")}
                options={valueTypeOptions}
                selectedKey={variable.type}
                onSelectionChange={(key) => {
                  const type = key as CustomValueType;
                  const initialValue = type === "boolean" ? false : type === "number" ? 0 : "";
                  updateVariable(variable.id, (current) => ({ ...current, type, initialValue }));
                }}
              />
              {variable.type === "enum" ? (
                <TextField
                  label={t("componentWorkbench.enumValues")}
                  value={(variable.enumValues ?? []).join(", ")}
                  onChange={(value) =>
                    updateVariable(variable.id, (current) => ({
                      ...current,
                      enumValues: value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    }))
                  }
                />
              ) : null}
              <VariableInitialValue
                variable={variable}
                onChange={(initialValue) => {
                  updateVariable(variable.id, (current) => ({ ...current, initialValue }));
                  applyVariableValue(variable.binding, initialValue);
                }}
              />
              <Select
                label={t("componentWorkbench.binding")}
                options={propertyBindings}
                selectedKey={variable.binding ?? ""}
                onSelectionChange={(binding) => {
                  updateVariable(variable.id, (current) => withBinding(current, binding));
                  applyVariableValue(binding, variable.initialValue);
                }}
              />
            </div>
          ))}
          {!asset.variables.length ? (
            <p className="component-config-empty">{t("componentWorkbench.noVariables")}</p>
          ) : null}
        </section>

        <section className="component-config-section">
          <div className="component-config-section__title">
            <div>
              <span>{t("componentWorkbench.slots")}</span>
              <small>{t("componentWorkbench.slotsHelp")}</small>
            </div>
            <ActionButton
              onPress={() => updateAsset((current) => ({ ...current, slots: [...current.slots, createSlot()] }))}
            >
              + {t("componentWorkbench.addSlot")}
            </ActionButton>
          </div>
          {asset.slots.map((slot) => (
            <div className="component-config-card" key={slot.id}>
              <div className="component-config-card__header">
                <strong>{slot.name || t("componentWorkbench.unnamedSlot")}</strong>
                <IconButton
                  icon={<ProductIcon name="close" />}
                  label={t("componentWorkbench.removeSlot", { name: slot.name })}
                  onPress={() =>
                    updateAsset((current) => ({
                      ...current,
                      slots: current.slots.filter(({ id }) => id !== slot.id)
                    }))
                  }
                />
              </div>
              <TextField
                label={t("componentWorkbench.name")}
                value={slot.name}
                onChange={(name) => updateSlot(slot.id, (current) => ({ ...current, name }))}
              />
              <Select
                label={t("componentWorkbench.valueType")}
                options={slotTypeOptions}
                selectedKey={slot.valueType}
                onSelectionChange={(valueType) =>
                  updateSlot(slot.id, (current) => ({
                    ...current,
                    valueType: valueType as CustomSlotValueType,
                    initialValue: ""
                  }))
                }
              />
              {slot.valueType === "text" ? (
                <TextField
                  label={t("componentWorkbench.initialValue")}
                  value={slot.initialValue}
                  onChange={(initialValue) => updateSlot(slot.id, (current) => ({ ...current, initialValue }))}
                />
              ) : (
                <Select
                  label={t("componentWorkbench.initialValue")}
                  options={[
                    { id: "", label: t("componentWorkbench.empty") },
                    ...definitions.map((definition) => ({
                      id: definition.name,
                      label: displayLabel(definition.displayName, definition.name, locale)
                    }))
                  ]}
                  selectedKey={slot.initialValue}
                  onSelectionChange={(initialValue) => updateSlot(slot.id, (current) => ({ ...current, initialValue }))}
                />
              )}
              <Select
                label={t("componentWorkbench.binding")}
                options={slotBindings}
                selectedKey={slot.binding ?? ""}
                onSelectionChange={(binding) => updateSlot(slot.id, (current) => withBinding(current, binding))}
              />
            </div>
          ))}
          {!asset.slots.length ? <p className="component-config-empty">{t("componentWorkbench.noSlots")}</p> : null}
        </section>

        <section className="component-config-section component-instance-section">
          <div className="component-config-section__title">
            <div>
              <span>{t("componentWorkbench.selectedInstance")}</span>
              <small>{selectedNode ? nodeLabel(selectedNode) : t("common.noSelection")}</small>
            </div>
          </div>
          {selectedNode?.kind === "component" && session.catalog ? (
            <>
              {(() => {
                const definition = session.catalog.components.components[selectedNode.componentRef];
                return (
                  <>
                    {definition?.variants.length ? (
                      <Select
                        label={t("inspector.variant")}
                        options={definition.variants.map((variant) => ({ id: variant, label: variant }))}
                        selectedKey={selectedNode.variant ?? definition.variants[0] ?? null}
                        onSelectionChange={(variant) =>
                          updateDocument((document) => {
                            const node = findNode(document, selectedNode.id);
                            if (node?.kind === "component") node.variant = variant;
                          })
                        }
                      />
                    ) : null}
                    {Object.entries(definition?.props ?? {}).map(([name, property]) => {
                      const value = selectedNode.props?.[name] ?? defaultValue(property, t("defaults.newContent"));
                      if (property.type === "boolean") {
                        return (
                          <Checkbox
                            key={name}
                            label={displayLabel(property.displayName, name, locale)}
                            isSelected={value === true}
                            onChange={(next) =>
                              updateDocument((document) => {
                                const node = findNode(document, selectedNode.id);
                                if (node?.kind === "component") (node.props ??= {})[name] = next;
                              })
                            }
                          />
                        );
                      }
                      if (property.type === "number") {
                        return (
                          <NumberField
                            key={name}
                            label={displayLabel(property.displayName, name, locale)}
                            value={typeof value === "number" ? value : 0}
                            onChange={(next) =>
                              updateDocument((document) => {
                                const node = findNode(document, selectedNode.id);
                                if (node?.kind === "component") (node.props ??= {})[name] = next;
                              })
                            }
                          />
                        );
                      }
                      if (property.type === "enum") {
                        return (
                          <Select
                            key={name}
                            label={displayLabel(property.displayName, name, locale)}
                            options={(property.values ?? []).map((item) => ({ id: String(item), label: String(item) }))}
                            selectedKey={String(value)}
                            onSelectionChange={(next) =>
                              updateDocument((document) => {
                                const node = findNode(document, selectedNode.id);
                                if (node?.kind === "component") {
                                  (node.props ??= {})[name] =
                                    property.values?.find((candidate) => String(candidate) === next) ?? next;
                                }
                              })
                            }
                          />
                        );
                      }
                      return (
                        <TextField
                          key={name}
                          label={displayLabel(property.displayName, name, locale)}
                          value={String(value)}
                          onChange={(next) =>
                            updateDocument((document) => {
                              const node = findNode(document, selectedNode.id);
                              if (node?.kind === "component") (node.props ??= {})[name] = next;
                            })
                          }
                        />
                      );
                    })}
                  </>
                );
              })()}
              <Button
                variant="danger"
                onPress={() => {
                  updateDocument((document) => {
                    removeNode(document, selectedNode.id);
                  });
                  setSelectedNodeId(undefined);
                }}
              >
                {t("componentWorkbench.removeInstance")}
              </Button>
            </>
          ) : (
            <p className="component-config-empty">{t("componentWorkbench.selectInstanceHelp")}</p>
          )}
        </section>
      </aside>
    </main>
  );
}
