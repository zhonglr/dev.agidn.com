import { useEffect, useState } from "react";
import type { PageNode } from "@agidn/document-schema";
import { useStudioSession } from "./studio-session.js";

function childNodes(node: PageNode): PageNode[] {
  return node.kind === "layout" ? [...node.children] : Object.values(node.slots ?? {}).flat();
}

function nodeTitle(node: PageNode): string {
  if (node.name) return node.name;
  if (node.kind === "layout") return node.role ?? node.layout;
  const text = node.props?.text ?? node.props?.label ?? node.props?.planName;
  return typeof text === "string" && text.length < 34 ? text : node.componentRef;
}

function OutlineNode({ node, depth }: { node: PageNode; depth: number }) {
  const { selectedNodeId, selectNode } = useStudioSession();
  const children = childNodes(node);
  return (
    <>
      <button
        type="button"
        role="treeitem"
        aria-selected={selectedNodeId === node.id}
        className={`tree-row${selectedNodeId === node.id ? " is-selected" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => selectNode(node.id)}
      >
        <span className="tree-arrow">{children.length ? "▾" : ""}</span>
        <span className={`tree-kind ${node.kind}`}>{node.kind === "layout" ? node.layout[0]!.toUpperCase() : node.componentRef[0]}</span>
        <span>{nodeTitle(node)}</span>
      </button>
      {children.map((child) => <OutlineNode node={child} depth={depth + 1} key={child.id} />)}
    </>
  );
}

export function PageOutlinePanel() {
  const { document, selectedNodeId, selectNode } = useStudioSession();
  return (
    <div className="tool-panel outline-panel">
      <label className="tool-search"><span>Search</span><input type="search" placeholder="Filter page…" /></label>
      <div className="tree" role="tree" aria-label="Page structure">
        <button type="button" role="treeitem" aria-selected={!selectedNodeId} className={`tree-row tree-row--root${!selectedNodeId ? " is-selected" : ""}`} onClick={() => selectNode()}>
          <span className="tree-arrow">▾</span><span className="tree-kind">P</span><strong>{document?.name ?? "Loading page…"}</strong>
        </button>
        {document?.children.map((node) => <OutlineNode node={node} depth={1} key={node.id} />)}
      </div>
    </div>
  );
}

const components = ["Button", "Heading", "Text", "Image", "Badge", "Card", "PricingCard", "FAQItem", "Container", "Stack", "Row", "Grid"];

export function ComponentsPanel() {
  return (
    <div className="tool-panel">
      <label className="tool-search"><span>Search</span><input type="search" placeholder="Find component…" /></label>
      <p className="tool-section-title">Registered components</p>
      <div className="component-grid">
        {components.map((component) => <button type="button" key={component}><span>{component.slice(0, 2)}</span>{component}</button>)}
      </div>
    </div>
  );
}

export function InspectorPanel() {
  const session = useStudioSession();
  const node = session.selectedNode;
  const editable = node?.kind === "component" && (node.componentRef === "Heading" || node.componentRef === "Text") ? node : undefined;
  const sourceText = editable && typeof editable.props?.text === "string" ? editable.props.text : "";
  const [draft, setDraft] = useState(sourceText);
  useEffect(() => setDraft(sourceText), [editable?.id, sourceText]);

  if (!node) {
    return <div className="tool-panel inspector inspector-empty"><span className="selection-icon">↖</span><strong>Select a node</strong><p>Choose an element on the canvas or in Page Outline to inspect it.</p></div>;
  }

  const title = node.kind === "component" ? node.componentRef : node.layout;
  const icon = title[0]?.toUpperCase() ?? "N";
  const applyText = async (): Promise<void> => {
    if (!editable || draft === sourceText) return;
    await session.setProp(editable.id, "text", draft);
  };

  return (
    <div className="tool-panel inspector">
      <div className="selection-summary"><span className="selection-icon">{icon}</span><div><strong>{title}</strong><small>{node.id}</small></div></div>
      {editable ? (
        <>
          <div className="inspector-section">
            <button type="button" className="inspector-section__title"><span>▾</span>Content</button>
            <label><span>Text</span><textarea value={draft} rows={3} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void applyText();
            }} /></label>
            {editable.componentRef === "Heading" ? (
              <label><span>Level</span><select value={String(editable.props?.level ?? 2)} disabled={session.status === "saving"} onChange={(event) => void session.setProp(editable.id, "level", Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((level) => <option key={level}>{level}</option>)}</select></label>
            ) : null}
            <div className="inspector-actions">
              <span>{session.error ?? (draft === sourceText ? "No pending changes" : "Unsaved change")}</span>
              <button type="button" disabled={draft === sourceText || session.status === "saving"} onClick={() => void applyText()}>{session.status === "saving" ? "Saving…" : "Apply"}</button>
            </div>
          </div>
          <div className="inspector-section">
            <button type="button" className="inspector-section__title"><span>▾</span>Appearance</button>
            <label><span>Variant</span><select value={editable.variant ?? (editable.componentRef === "Heading" ? "title" : "body")} disabled={session.status === "saving"} onChange={(event) => void session.setVariant(editable.id, event.target.value)}>
              {(editable.componentRef === "Heading" ? ["display", "title", "section"] : ["body", "muted", "emphasis"]).map((variant) => <option key={variant}>{variant}</option>)}
            </select></label>
            <label><span>Text color</span><button type="button" className="token-field" disabled><i />{editable.tokens?.textColor ?? "Inherited"}</button></label>
            <label><span>Typography</span><button type="button" className="token-field" disabled>{editable.tokens?.typography ?? "Inherited"}</button></label>
          </div>
          <div className="inspector-note">Changes are validated by the Workspace Server and committed as a new document revision.</div>
        </>
      ) : (
        <div className="inspector-note">The first editing slice supports Heading and Text. This node is currently read-only.</div>
      )}
    </div>
  );
}

export function ProblemsPanel() {
  const session = useStudioSession();
  return (
    <div className="bottom-panel">
      <div className="problem-row"><span className={`problem-icon ${session.status === "error" ? "warn" : "info"}`}>{session.status === "error" ? "!" : "i"}</span><div><strong>{session.status === "error" ? "Workspace needs attention" : "Workspace connection active"}</strong><small>{session.error ?? `Revision ${session.revision} is validated and synchronized`}</small></div><span>workspace</span></div>
      <div className="problem-row"><span className="problem-icon info">i</span><div><strong>Preview isolation active</strong><small>Versioned messages are runtime validated across the sandbox boundary</small></div><span>preview</span></div>
    </div>
  );
}

export function HistoryPanel() {
  const { history, revision } = useStudioSession();
  return (
    <div className="bottom-panel history-list">
      {history.length === 0 ? <div><span className="history-dot" /><strong>Revision {revision}</strong><small>Golden Pricing Page loaded</small><time>workspace</time></div> : null}
      {[...history].reverse().map((entry) => (
        <div key={entry.revision}><span className="history-dot" /><strong>Revision {entry.revision}</strong><small>{entry.kind === "commit" ? entry.commands.map((command) => command.type).join(", ") : entry.kind}</small><time>{entry.source}</time></div>
      ))}
    </div>
  );
}
