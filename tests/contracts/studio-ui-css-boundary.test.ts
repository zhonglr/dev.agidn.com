import { readFile } from "node:fs/promises";

describe("Studio UI CSS boundary", () => {
  it("keeps native resets and chrome selectors away from toolkit controls", async () => {
    const source = await readFile("apps/studio/src/styles.css", "utf8");

    expect(source).toContain("button:not([data-rac])");
    expect(source).toContain("input:not([data-rac])");
    expect(source).not.toMatch(/\.canvas-toolbar button/);
    expect(source).not.toMatch(/\.activity-bar button/);
  });

  it("keeps Studio text on a readable typography scale", async () => {
    const source = await readFile("apps/studio/src/styles.css", "utf8");

    expect(source).toContain("--studio-text-caption: 0.75rem");
    expect(source).toContain("--studio-text-control: 0.75rem");
    expect(source).toContain("--studio-text-body: 0.875rem");
    expect(source).toContain("--studio-text-title: 1rem");
    expect(source).toContain("font-size: var(--studio-text-body)");
    expect(source).not.toMatch(/font(?:-size)?:\s*(?:8|9|10)px/);
  });

  it("keeps AGIDN typography names and fonts independent from the toolkit brand", async () => {
    const source = await readFile("apps/studio/src/styles.css", "utf8");

    expect(source).toContain("--studio-font-family-sans: system-ui, sans-serif");
    expect(source).toContain("--s2-font-family-sans: var(--studio-font-family-sans)");
    expect(source).toContain("--studio-font-family-code: var(--studio-font-family-sans)");
    expect(source).not.toMatch(/adobe-clean/i);
    expect(source).not.toMatch(/Inter|Source Sans|Source Code Pro|Monaco|Consolas/);
    expect(source).not.toMatch(/--studio-font-(?:50|75|100|200)\b/);
  });

  it("uses ActionButton for quiet actions and Button for emphasized actions", async () => {
    const [actionButton, button, panels] = await Promise.all([
      readFile("apps/studio/src/components/ui/action-button.tsx", "utf8"),
      readFile("apps/studio/src/components/ui/button.tsx", "utf8"),
      readFile("apps/studio/src/panels.tsx", "utf8")
    ]);

    expect(actionButton).toContain('size="S"');
    expect(actionButton).toContain("isQuiet");
    expect(button).not.toContain('"quiet"');
    expect(panels).toMatch(/<ActionButton[\s\S]*setQuery\(""\)/);
  });

  it("uses ToggleButton for persistent view and panel modes", async () => {
    const [app, canvas, workbench] = await Promise.all([
      readFile("apps/studio/src/App.tsx", "utf8"),
      readFile("apps/studio/src/canvas/CanvasViewport.tsx", "utf8"),
      readFile("packages/studio-workbench/src/workbench.tsx", "utf8")
    ]);

    expect(app).toContain("setRegisteredPanelOpen");
    expect(app).toContain("renderToggleButton={renderWorkbenchToggleButton}");
    expect(app).not.toContain("toggleRegisteredPanel");
    expect(canvas).toContain("<ToggleButton");
    expect(workbench).toContain("<PanelModeToggle");
    expect(workbench).toContain("aria-pressed={props.isSelected}");
  });

  it("uses facade controls for generic application and inspector interactions", async () => {
    const [app, panels, menuButton, numberField, disclosure, styles] = await Promise.all([
      readFile("apps/studio/src/App.tsx", "utf8"),
      readFile("apps/studio/src/panels.tsx", "utf8"),
      readFile("apps/studio/src/components/ui/menu-button.tsx", "utf8"),
      readFile("apps/studio/src/components/ui/number-field.tsx", "utf8"),
      readFile("apps/studio/src/components/ui/disclosure.tsx", "utf8"),
      readFile("apps/studio/src/styles.css", "utf8")
    ]);

    expect(app).not.toMatch(/<(?:button|input|select|textarea|details|summary)\b/);
    expect(app).toContain("<MenuButton");
    expect(app).toContain("<Button");
    expect(panels).not.toMatch(/<input\b/);
    expect(panels).toContain("<NumberField");
    expect(panels).toContain("<Disclosure");
    expect(menuButton).toContain("@react-spectrum/s2/Menu");
    expect(numberField).toContain("@react-spectrum/s2/NumberField");
    expect(disclosure).toContain("@react-spectrum/s2/Disclosure");
    expect(styles).not.toContain(".main-menu details");
    expect(styles).not.toContain(".inspector-number-field");
  });
});
