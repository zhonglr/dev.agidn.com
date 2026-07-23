import {
  createCustomComponentAsset,
  createSlot,
  createVariable,
  getCustomComponent,
  loadCustomComponents,
  removeCustomComponent,
  saveCustomComponent
} from "../../apps/studio/src/custom-components.js";
import { readFile } from "node:fs/promises";

describe("Studio custom component assets", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    });
    vi.stubGlobal("window", new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a reusable Stack template with configurable variables and slots", () => {
    const asset = createCustomComponentAsset();
    asset.variables.push(createVariable());
    asset.slots.push(createSlot());

    expect(asset.document.role).toBe("component-preview");
    expect(asset.document.children[0]).toMatchObject({
      kind: "layout",
      layout: "stack",
      role: "component-root"
    });
    expect(asset.variables[0]).toMatchObject({ type: "string", initialValue: "" });
    expect(asset.slots[0]).toMatchObject({ valueType: "component", initialValue: "" });
  });

  it("persists, updates, and removes component assets by stable id", () => {
    const asset = createCustomComponentAsset();
    const saved = saveCustomComponent({ ...asset, name: "Feature card" });

    expect(loadCustomComponents()).toHaveLength(1);
    expect(getCustomComponent(saved.id)?.name).toBe("Feature card");

    saveCustomComponent({ ...saved, name: "Pricing feature" });
    expect(loadCustomComponents()).toHaveLength(1);
    expect(getCustomComponent(saved.id)?.name).toBe("Pricing feature");

    removeCustomComponent(saved.id);
    expect(loadCustomComponents()).toEqual([]);
  });

  it("uses the same four-column authoring order as the main workbench", async () => {
    const [source, appSource, styles] = await Promise.all([
      readFile("apps/studio/src/ComponentWorkbench.tsx", "utf8"),
      readFile("apps/studio/src/App.tsx", "utf8"),
      readFile("apps/studio/src/styles.css", "utf8")
    ]);

    const tree = source.indexOf('className="component-workbench__tree-panel"');
    const library = source.indexOf('className="component-workbench__library"');
    const stage = source.indexOf('className="component-workbench__stage"');
    const configuration = source.indexOf('className="component-workbench__configuration"');

    expect(tree).toBeGreaterThan(-1);
    expect(tree).toBeLessThan(library);
    expect(library).toBeLessThan(stage);
    expect(stage).toBeLessThan(configuration);
    expect(styles).toContain('"tree library stage configuration"');
    expect(appSource).toContain('className="component-workbench-layer"');
    expect(appSource).toContain("inert={paletteOpen || componentEditor ? true : undefined}");
    expect(appSource).not.toContain("if (componentEditor) {");
    expect(source).toContain('message.type === "preview.contentOverflow"');
    expect(source).toContain("setPreviewReady(true)");
  });
});
