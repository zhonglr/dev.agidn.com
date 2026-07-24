import type { GetCatalogResponse } from "@agidn/api-protocol";
import {
  componentPanelEntries,
  filterComponentPanelEntries
} from "../../apps/studio/src/component-panel-model.js";
import { loadFoundationProject } from "../helpers.js";

async function foundationCatalog(): Promise<GetCatalogResponse> {
  const project = await loadFoundationProject();
  return {
    protocolVersion: "2.0.0",
    ok: true,
    components: structuredClone(project.components) as GetCatalogResponse["components"],
    tokens: project.tokens,
    policies: project.policies,
    actions: project.actions,
    constraints: project.constraints,
    assets: project.assets
  };
}

describe("Components panel model", () => {
  it("exposes every Foundation component from the active catalog", async () => {
    const entries = componentPanelEntries(await foundationCatalog());

    expect(new Set(entries.map(({ component }) => component.name))).toEqual(
      new Set([
        "Button",
        "Link",
        "Heading",
        "Text",
        "Image",
        "Icon",
        "Badge",
        "Card",
        "Divider",
        "project.foundation-callout"
      ])
    );
  });

  it("does not hide a registered component when it has no presets", async () => {
    const catalog = await foundationCatalog();
    const button = catalog.components.components.Button!;
    catalog.components.components.Button = {
      ...button,
      editor: { ...button.editor, presets: {} }
    };

    expect(componentPanelEntries(catalog)).toContainEqual({
      component: catalog.components.components.Button
    });
  });

  it("searches localized labels, metadata and preset labels", async () => {
    const entries = componentPanelEntries(await foundationCatalog());

    expect(
      filterComponentPanelEntries(entries, "按钮", "zh-CN").some(
        ({ component }) => component.name === "Button"
      )
    ).toBe(true);
    expect(
      filterComponentPanelEntries(entries, "navigation", "en-US").some(
        ({ component }) => component.name === "Link"
      )
    ).toBe(true);
  });
});
