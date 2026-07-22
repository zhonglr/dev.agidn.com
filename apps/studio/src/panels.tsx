export function PageOutlinePanel() {
  return (
    <div className="tool-panel outline-panel">
      <label className="tool-search"><span>Search</span><input type="search" placeholder="Filter page…" /></label>
      <div className="tree" role="tree" aria-label="Page structure">
        <div className="tree-row tree-row--root"><span className="tree-arrow">▾</span><span className="tree-kind">P</span><strong>Acme Pricing</strong></div>
        <div className="tree-row depth-1"><span className="tree-arrow">▾</span><span className="tree-kind layout">S</span>Header</div>
        <div className="tree-row depth-2"><span className="tree-arrow" /><span className="tree-kind component">N</span>Navigation</div>
        <div className="tree-row depth-1"><span className="tree-arrow">▾</span><span className="tree-kind layout">S</span>Hero</div>
        <div className="tree-row depth-2 is-selected"><span className="tree-arrow" /><span className="tree-kind component">H</span>Heading</div>
        <div className="tree-row depth-2"><span className="tree-arrow" /><span className="tree-kind component">T</span>Description</div>
        <div className="tree-row depth-1"><span className="tree-arrow">▾</span><span className="tree-kind layout">G</span>Pricing plans</div>
        <div className="tree-row depth-2"><span className="tree-arrow" /><span className="tree-kind component">C</span>Starter</div>
        <div className="tree-row depth-2"><span className="tree-arrow" /><span className="tree-kind component">C</span>Pro</div>
        <div className="tree-row depth-2"><span className="tree-arrow" /><span className="tree-kind component">C</span>Business</div>
        <div className="tree-row depth-1"><span className="tree-arrow">▸</span><span className="tree-kind layout">S</span>FAQ</div>
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
  return (
    <div className="tool-panel inspector">
      <div className="selection-summary"><span className="selection-icon">H</span><div><strong>Heading</strong><small>heading_hero</small></div></div>
      <div className="inspector-section">
        <button type="button" className="inspector-section__title"><span>▾</span>Content</button>
        <label><span>Text</span><textarea defaultValue="Simple pricing that scales with you" rows={3} /></label>
        <label><span>Level</span><select defaultValue="1"><option>1</option><option>2</option><option>3</option></select></label>
      </div>
      <div className="inspector-section">
        <button type="button" className="inspector-section__title"><span>▾</span>Appearance</button>
        <label><span>Variant</span><select defaultValue="display"><option>display</option><option>title</option><option>section</option></select></label>
        <label><span>Text color</span><button type="button" className="token-field"><i />color.text.default</button></label>
        <label><span>Typography</span><button type="button" className="token-field">typography.display</button></label>
      </div>
      <div className="inspector-note">Property edits will be connected to Commands in W4.</div>
    </div>
  );
}

export function ProblemsPanel() {
  return (
    <div className="bottom-panel">
      <div className="problem-row"><span className="problem-icon info">i</span><div><strong>Golden Page is valid</strong><small>60 contract and integration checks passed</small></div><span>workspace</span></div>
      <div className="problem-row"><span className="problem-icon warn">!</span><div><strong>Preview isolation pending</strong><small>Versioned postMessage bridge is scheduled for W3</small></div><span>preview</span></div>
    </div>
  );
}

export function HistoryPanel() {
  return (
    <div className="bottom-panel history-list">
      <div><span className="history-dot" /><strong>Revision 0</strong><small>Golden Pricing Page loaded</small><time>workspace</time></div>
    </div>
  );
}
