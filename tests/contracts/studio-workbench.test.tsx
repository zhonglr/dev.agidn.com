import { renderToStaticMarkup } from "react-dom/server";
import {
  checkWorkbenchLayout,
  closePanel,
  CommandRegistry,
  normalizeWorkbenchLayout,
  openPanel,
  PanelRegistry,
  resizeSplit,
  Workbench,
  WORKBENCH_LAYOUT_VERSION,
  type WorkbenchLayoutState
} from "@agidn/studio-workbench";

const defaultLayout: WorkbenchLayoutState = {
  version: WORKBENCH_LAYOUT_VERSION,
  hiddenPanelIds: [],
  root: {
    type: "split",
    id: "root",
    direction: "horizontal",
    sizes: [0.25, 0.75],
    children: [
      { type: "tabs", id: "primary", activePanelId: "outline", panelIds: ["outline", "components"] },
      { type: "panel", id: "canvas-host", panelId: "canvas" }
    ]
  }
};

describe("Studio Workbench", () => {
  it("validates the versioned layout contract and rejects unknown fields", () => {
    expect(checkWorkbenchLayout(defaultLayout)).toEqual({ valid: true, layout: defaultLayout });
    expect(checkWorkbenchLayout({ ...defaultLayout, rawCss: "grid-template-columns: 200px 1fr" }).valid).toBe(false);
  });

  it("normalizes unavailable panels and stale active tabs", () => {
    const normalized = normalizeWorkbenchLayout(
      {
        ...defaultLayout,
        root: {
          type: "split",
          id: "root",
          direction: "horizontal",
          sizes: [20, 80],
          children: [
            { type: "tabs", id: "primary", activePanelId: "missing", panelIds: ["missing", "outline"] },
            { type: "panel", id: "canvas-host", panelId: "canvas" }
          ]
        }
      },
      ["outline", "canvas"],
      defaultLayout
    );

    expect(normalized.root).toMatchObject({ type: "split", sizes: [0.2, 0.8] });
    expect(normalized.root.type === "split" ? normalized.root.children[0] : undefined).toMatchObject({
      type: "tabs",
      activePanelId: "outline",
      panelIds: ["outline"]
    });
  });

  it("resizes adjacent split regions without changing their combined size", () => {
    const resized = resizeSplit(defaultLayout, "root", 0, 0.1);
    expect(resized.root).toMatchObject({ type: "split", sizes: [0.35, 0.65] });

    const clamped = resizeSplit(defaultLayout, "root", 0, -1);
    expect(clamped.root).toMatchObject({ type: "split", sizes: [0.08, 0.92] });
  });

  it("closes and reopens panels through layout operations", () => {
    const closed = closePanel(defaultLayout, "components");
    expect(closed.hiddenPanelIds).toContain("components");
    const reopened = openPanel(closed, "components", "primary");
    expect(reopened.hiddenPanelIds).not.toContain("components");
    expect(reopened.root.type === "split" ? reopened.root.children[0] : undefined).toMatchObject({
      type: "tabs",
      activePanelId: "components",
      panelIds: ["outline", "components"]
    });
  });

  it("rejects duplicate commands and keybinding conflicts", () => {
    const commands = new CommandRegistry([
      { id: "workbench.open", title: "Open", keybinding: "Ctrl+P", execute: () => undefined }
    ]);
    expect(() => commands.register({ id: "workbench.other", title: "Other", keybinding: "ctrl+p", execute: () => undefined })).toThrow(/conflicts/);
    expect(() => commands.register({ id: "workbench.open", title: "Duplicate", execute: () => undefined })).toThrow(/already registered/);
  });

  it("renders registered panels, tabs and accessible separators", () => {
    const panels = new PanelRegistry([
      { id: "outline", title: "Outline", defaultLocation: "primary", canClose: true, canMove: true, canDock: true, render: () => <p>Outline panel</p> },
      { id: "components", title: "Components", defaultLocation: "primary", canClose: true, canMove: true, canDock: true, render: () => <p>Components panel</p> },
      { id: "canvas", title: "Canvas", defaultLocation: "center", canClose: false, canMove: true, canDock: false, render: () => <p>Canvas panel</p> }
    ]);
    const html = renderToStaticMarkup(<Workbench layout={defaultLayout} panels={panels} onLayoutChange={() => undefined} />);
    expect(html).toContain("Outline panel");
    expect(html).toContain("Canvas panel");
    expect(html).toContain('role="separator"');
    expect(html).toContain('role="tablist"');
  });
});
