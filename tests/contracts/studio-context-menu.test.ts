import { readFile } from "node:fs/promises";
import {
  ContextMenuRegistry,
  type ContextMenuContribution
} from "../../apps/studio/src/context-menu/registry.js";

function contribution(
  id: string,
  targetTypes: "*" | readonly string[],
  section: string,
  order: number
): ContextMenuContribution {
  return {
    id,
    targetTypes,
    section: { id: section, label: section, order },
    order,
    build: () => ({ id, label: id })
  };
}

describe("Studio context menu contributions", () => {
  it("filters, groups, and orders contributions for each target type", () => {
    const registry = new ContextMenuRegistry([
      contribution("node.remove", ["node"], "destructive", 90),
      contribution("common.copy", "*", "edit", 20),
      contribution("page.open", ["page"], "navigation", 10)
    ]);

    expect(registry.resolve({ type: "node", id: "node_1" })).toEqual([
      {
        id: "edit",
        label: "edit",
        order: 20,
        items: [{ id: "common.copy", label: "common.copy" }]
      },
      {
        id: "destructive",
        label: "destructive",
        order: 90,
        items: [{ id: "node.remove", label: "node.remove" }]
      }
    ]);
    expect(registry.resolve({ type: "page", id: "page_1" }).flatMap(({ items }) => items.map(({ id }) => id))).toEqual([
      "page.open",
      "common.copy"
    ]);
  });

  it("supports conditional registration and disposal for extensions", () => {
    const registry = new ContextMenuRegistry();
    const dispose = registry.register({
      id: "plugin.inspect",
      targetTypes: ["node"],
      section: { id: "plugin", label: "Plugin" },
      when: (target) => target.metadata?.editable === true,
      build: () => ({
        id: "inspect",
        label: "Inspect",
        children: [{ id: "details", label: "Details", execute: () => undefined }]
      })
    });

    expect(registry.resolve({ type: "node", metadata: { editable: false } })).toEqual([]);
    expect(registry.resolve({ type: "node", metadata: { editable: true } })).toHaveLength(1);
    dispose();
    expect(registry.resolve({ type: "node", metadata: { editable: true } })).toEqual([]);
  });

  it("uses Spectrum menus and right-click handlers across editing surfaces", async () => {
    const [facade, panels, canvas] = await Promise.all([
      readFile("apps/studio/src/components/ui/context-menu.tsx", "utf8"),
      readFile("apps/studio/src/panels.tsx", "utf8"),
      readFile("apps/studio/src/canvas/CanvasViewport.tsx", "utf8")
    ]);

    expect(facade).toContain("@react-spectrum/s2/Menu");
    expect(facade).toContain("@react-spectrum/s2/Popover");
    expect(facade).toContain("<SubmenuTrigger");
    expect(facade).toContain("<MenuSection");
    expect(panels).toContain("onContextMenu=");
    expect(canvas).toContain("onContextMenu=");
  });
});
