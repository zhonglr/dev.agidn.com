import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { GetCatalogResponse } from "@agidn/api-protocol";
import type { PageNode } from "@agidn/document-schema";
import { useStudioSession } from "./studio-session.js";
import { NODE_DRAG_MIME, resolveMoveTarget, resolveSiblingMove } from "./structure-drag.js";

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
  return [nodeTitle(node), node.id, node.role, node.kind === "component" ? node.componentRef : node.layout].filter(Boolean).join(" ").toLowerCase();
}

interface OutlineEntry { node: PageNode; depth: number; parentId?: string }

function collectOutline(nodes: readonly PageNode[], expanded: ReadonlySet<string>, query: string, depth = 1, parentId?: string): OutlineEntry[] {
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

export function PageOutlinePanel() {
  const { document, catalog, selectedNodeId, selectNode, insertComponent, moveNode } = useStudioSession();
  const [query, setQuery] = useState("");
  const [rootExpanded, setRootExpanded] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dropIndicator, setDropIndicator] = useState<{ nodeId: string; position: "before" | "inside" | "after" }>();
  const [dragMessage, setDragMessage] = useState<string>();
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!document) return;
    const next = new Set(expanded);
    const reveal = (nodes: readonly PageNode[], ancestors: string[]): boolean => {
      for (const node of nodes) {
        if (node.id === selectedNodeId) { ancestors.forEach((id) => next.add(id)); return true; }
        if (reveal(childNodes(node), [...ancestors, node.id])) return true;
      }
      return false;
    };
    if (selectedNodeId && reveal(document.children, [])) { setRootExpanded(true); setExpanded(next); }
  // Only reveal when selection changes; expanded is intentionally local state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, selectedNodeId]);

  const normalizedQuery = query.trim().toLowerCase();
  const entries = useMemo(() => document && (rootExpanded || normalizedQuery)
    ? collectOutline(document.children, expanded, normalizedQuery)
    : [], [document, expanded, normalizedQuery, rootExpanded]);

  const focusAt = (current: HTMLElement, delta: "first" | "last" | number): void => {
    const items = [...(treeRef.current?.querySelectorAll<HTMLElement>("[role=treeitem]") ?? [])];
    const index = items.indexOf(current);
    const next = delta === "first" ? items[0] : delta === "last" ? items.at(-1) : items[Math.max(0, Math.min(items.length - 1, index + delta))];
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
      focusAt(event.currentTarget, event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : event.key === "Home" ? "first" : "last");
      return;
    }
    const children = node ? childNodes(node) : document?.children ?? [];
    const isExpanded = node ? expanded.has(node.id) : rootExpanded;
    if (event.key === "ArrowRight" && children.length) {
      event.preventDefault();
      if (!isExpanded) node ? setExpanded((value) => new Set(value).add(node.id)) : setRootExpanded(true);
      else focusAt(event.currentTarget, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (isExpanded && children.length) {
        if (node) setExpanded((value) => { const next = new Set(value); next.delete(node.id); return next; }); else setRootExpanded(false);
      } else if (parentId) treeRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(parentId)}"]`)?.focus();
      else treeRef.current?.querySelector<HTMLElement>("[data-tree-root]")?.focus();
    } else if ((event.key === "Enter" || event.key === " ") && node) {
      event.preventDefault(); selectNode(node.id);
    }
  };

  return (
    <div className="tool-panel outline-panel">
      <label className="tool-search"><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter page…" /></label>
      <div className="tree" role="tree" aria-label="Page structure" ref={treeRef}>
        <div role="treeitem" tabIndex={0} data-tree-root aria-selected={!selectedNodeId} aria-expanded={rootExpanded} className={`tree-row tree-row--root${!selectedNodeId ? " is-selected" : ""}`} onClick={() => selectNode()} onKeyDown={(event) => handleKey(event)}>
          <button type="button" className="tree-disclosure" aria-label={rootExpanded ? "Collapse page" : "Expand page"} onClick={(event) => { event.stopPropagation(); setRootExpanded((value) => !value); }}>{rootExpanded ? "▾" : "▸"}</button>
          <span className="tree-kind">P</span><strong className="tree-label" title={document?.name}>{document?.name ?? "Loading page…"}</strong>
        </div>
        {entries.map(({ node, depth, parentId }) => {
          const children = childNodes(node);
          const isExpanded = normalizedQuery ? true : expanded.has(node.id);
          return (
            <div role="treeitem" tabIndex={-1} draggable data-node-id={node.id} aria-level={depth + 1} aria-selected={selectedNodeId === node.id} aria-expanded={children.length ? isExpanded : undefined} aria-description="Drag to move. Alt plus Up or Down reorders within the current group." className={`tree-row${selectedNodeId === node.id ? " is-selected" : ""}${dropIndicator?.nodeId === node.id ? ` is-drop-${dropIndicator.position}` : ""}`} style={{ paddingLeft: 6 + depth * 14 }} key={node.id} onClick={() => selectNode(node.id)} onKeyDown={(event) => handleKey(event, node, parentId)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData(NODE_DRAG_MIME, node.id); event.dataTransfer.setData("text/plain", node.id); selectNode(node.id); }} onDragEnd={() => setDropIndicator(undefined)} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndicator(undefined); }} onDragOver={(event) => {
              const component = event.dataTransfer.types.includes("application/x-agidn-component");
              const sourceNodeId = event.dataTransfer.getData(NODE_DRAG_MIME);
              if (component && node.kind === "layout") { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; return; }
              if (!sourceNodeId || !document || !catalog) return;
              event.preventDefault(); event.dataTransfer.dropEffect = "move";
              const rect = event.currentTarget.getBoundingClientRect();
              const resolution = resolveMoveTarget(document, catalog, sourceNodeId, node.id, event.clientY, { y: rect.top, height: rect.height });
              setDropIndicator(resolution.valid ? { nodeId: node.id, position: resolution.position } : undefined);
              setDragMessage(resolution.valid ? undefined : resolution.reason);
            }} onDrop={(event) => {
              const component = event.dataTransfer.getData("application/x-agidn-component");
              const sourceNodeId = event.dataTransfer.getData(NODE_DRAG_MIME);
              if (component && node.kind === "layout") { event.preventDefault(); void insertComponent(component, { parentId: node.id }); return; }
              if (!sourceNodeId || !document || !catalog) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const resolution = resolveMoveTarget(document, catalog, sourceNodeId, node.id, event.clientY, { y: rect.top, height: rect.height });
              setDropIndicator(undefined);
              if (resolution.valid) { setDragMessage(undefined); void moveNode(sourceNodeId, resolution.target); }
              else setDragMessage(resolution.reason);
            }}>
              {children.length ? <button type="button" className="tree-disclosure" aria-label={isExpanded ? `Collapse ${nodeTitle(node)}` : `Expand ${nodeTitle(node)}`} onClick={(event) => { event.stopPropagation(); setExpanded((value) => { const next = new Set(value); isExpanded ? next.delete(node.id) : next.add(node.id); return next; }); }}>{isExpanded ? "▾" : "▸"}</button> : <span className="tree-disclosure-placeholder" />}
              <span className={`tree-kind ${node.kind}`}>{node.kind === "layout" ? node.layout[0]!.toUpperCase() : node.componentRef[0]}</span>
              <span className="tree-label" title={`${nodeTitle(node)} · ${node.id}`}>{nodeTitle(node)}</span>
            </div>
          );
        })}
        {normalizedQuery && entries.length === 0 ? <div className="tool-empty">No page nodes match “{query}”. <button type="button" onClick={() => setQuery("")}>Clear search</button></div> : null}
        {dragMessage ? <div className="tree-drag-message" role="status">{dragMessage}</div> : null}
      </div>
    </div>
  );
}

export function ComponentsPanel() {
  const session = useStudioSession();
  const [query, setQuery] = useState("");
  const definitions = Object.values(session.catalog?.components.components ?? {});
  const filtered = definitions.filter((component) => [component.name, component.source, ...component.roles].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="tool-panel component-panel">
      <label className="tool-search"><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find component…" /></label>
      <p className="tool-section-title">Registered components</p>
      {filtered.length ? <div className="component-grid">
        {filtered.map((component) => <button type="button" draggable title={`${component.name} · Click or drag to insert`} key={component.name} disabled={session.status === "saving"} onClick={() => void session.insertComponent(component.name)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-agidn-component", component.name); }}><span>{component.name.slice(0, 2)}</span><b title={component.name}>{component.name}</b></button>)}
      </div> : <div className="tool-empty">No components match “{query}”. <button type="button" onClick={() => setQuery("")}>Clear search</button></div>}
    </div>
  );
}

function PropField({ nodeId, name, definition, value }: { nodeId: string; name: string; definition: GetCatalogResponse["components"]["components"][string]["props"][string]; value: unknown }) {
  const session = useStudioSession();
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [nodeId, value]);
  const commitDraft = (): void => { const next = definition.type === "number" ? Number(draft) : draft; if (!Object.is(next, value)) void session.setProp(nodeId, name, next); };
  return <label><span>{name}{definition.required ? " *" : ""}</span>{definition.type === "enum" ? (
    <select value={draft} disabled={session.status === "saving"} onChange={(event) => { setDraft(event.target.value); void session.setProp(nodeId, name, definition.values?.find((candidate) => String(candidate) === event.target.value) ?? event.target.value); }}>{definition.values?.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select>
  ) : definition.type === "boolean" ? (
    <input type="checkbox" checked={value === true} disabled={session.status === "saving"} onChange={(event) => void session.setProp(nodeId, name, event.target.checked)} />
  ) : (
    <input type={definition.type === "number" ? "number" : "text"} value={draft} disabled={session.status === "saving"} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} onKeyDown={(event) => { if (event.key === "Enter") commitDraft(); }} />
  )}</label>;
}

export function InspectorPanel() {
  const session = useStudioSession();
  const node = session.selectedNode;
  const [contentOpen, setContentOpen] = useState(true);
  const [appearanceOpen, setAppearanceOpen] = useState(true);
  if (!node) return <div className="tool-panel inspector inspector-empty"><span className="selection-icon">N</span><strong>Select a node</strong><p>Choose an element on the canvas or in Page Outline to inspect it.</p></div>;
  const title = node.kind === "component" ? node.componentRef : node.layout;
  const definition = node.kind === "component" ? session.catalog?.components.components[node.componentRef] : undefined;
  return (
    <div className="tool-panel inspector">
      <div className="selection-summary"><span className="selection-icon">{title[0]?.toUpperCase()}</span><div><strong>{title}</strong><small>{node.id}</small></div></div>
      {node.kind === "component" && definition ? <>
        <div className="inspector-section">
          <button type="button" className="inspector-section__title" aria-expanded={contentOpen} onClick={() => setContentOpen((value) => !value)}><span>{contentOpen ? "▾" : "▸"}</span>Content</button>
          {contentOpen ? Object.entries(definition.props).map(([name, prop]) => <PropField nodeId={node.id} name={name} definition={prop} value={node.props?.[name]} key={name} />) : null}
          {contentOpen && Object.keys(definition.props).length === 0 ? <p className="inspector-muted">This component has no registered props.</p> : null}
        </div>
        <div className="inspector-section">
          <button type="button" className="inspector-section__title" aria-expanded={appearanceOpen} onClick={() => setAppearanceOpen((value) => !value)}><span>{appearanceOpen ? "▾" : "▸"}</span>Appearance</button>
          {appearanceOpen && definition.variants.length ? <label><span>Variant</span><select value={node.variant ?? definition.variants[0]} disabled={session.status === "saving"} onChange={(event) => void session.setVariant(node.id, event.target.value)}>{definition.variants.map((variant) => <option key={variant}>{variant}</option>)}</select></label> : null}
          {appearanceOpen ? Object.entries(node.tokens ?? {}).map(([name, token]) => <div className="readonly-field" key={name}><span>{name}</span><output title="Token assignments are read-only in this release">{token}</output></div>) : null}
        </div>
        <div className="inspector-note">Fields and validation are provided by Component Registry. Token assignments are currently read-only.</div>
      </> : <div className="inspector-note">Layout properties are currently read-only. This is shown as information rather than an editable control.</div>}
      {session.error ? <div className="inspector-error" role="alert">{session.error}</div> : null}
    </div>
  );
}

export function ProblemsPanel() {
  const session = useStudioSession();
  return <div className="bottom-panel">
    <div className="problem-row"><span className={`problem-icon ${session.status === "error" ? "warn" : "info"}`}>{session.status === "error" ? "!" : "i"}</span><div><strong>{session.status === "error" ? "Workspace needs attention" : "Workspace connection active"}</strong><small>{session.error ?? `Revision ${session.revision} is validated and synchronized`}</small></div><span>workspace</span></div>
    <div className="problem-row"><span className="problem-icon info">i</span><div><strong>Preview isolation active</strong><small>Versioned messages are runtime validated across the sandbox boundary</small></div><span>preview</span></div>
  </div>;
}

export function HistoryPanel() {
  const { history, revision } = useStudioSession();
  return <div className="bottom-panel history-list">
    {history.length === 0 ? <div><span className="history-dot" /><strong>Revision {revision}</strong><small>Golden Pricing Page loaded</small><time>workspace</time></div> : null}
    {[...history].reverse().map((entry) => <div key={entry.revision}><span className="history-dot" /><strong>Revision {entry.revision}</strong><small>{entry.kind === "commit" ? entry.commands.map((command) => command.type).join(", ") : entry.kind}</small><time>{entry.source}</time></div>)}
  </div>;
}
