import type { ComponentRegistry } from "@agidn/component-registry";
import type { PageDocument, PageNode } from "@agidn/document-schema";
import {
  createTreeIndex,
  resolveGeometryDrop,
  resolveNodeDrop,
  type DropPolicy,
  type GeometryZone
} from "@agidn/layout-engine";

const components: ComponentRegistry = {
  schemaVersion: "2.0.0",
  components: {
    Box: {
      name: "Box",
      version: "2.0.0",
      source: "Box",
      displayName: "Box",
      description: "Test box",
      category: "surface",
      roles: [],
      props: {},
      slots: {
        content: { displayName: "Content", valueType: "nodes", accepts: ["Text"], required: false, minItems: 0, maxItems: 2 },
        icon: { displayName: "Icon", valueType: "nodes", accepts: ["Icon"], required: false, minItems: 0, maxItems: 1 }
      },
      variants: {},
      tokenSlots: {},
      events: {},
      accessibility: { accessibleName: "none" },
      editor: { icon: "box", keywords: [], presets: { default: { displayName: "Box" } }, defaultPreset: "default" }
    },
    Text: {
      name: "Text",
      version: "2.0.0",
      source: "Text",
      displayName: "Text",
      description: "Test text",
      category: "typography",
      roles: [],
      props: {},
      slots: {},
      variants: {},
      tokenSlots: {},
      events: {},
      accessibility: { accessibleName: "none" },
      editor: { icon: "text", keywords: [], presets: { default: { displayName: "Text" } }, defaultPreset: "default" }
    },
    Icon: {
      name: "Icon",
      version: "2.0.0",
      source: "Icon",
      displayName: "Icon",
      description: "Test icon",
      category: "media",
      roles: [],
      props: {},
      slots: {},
      variants: {},
      tokenSlots: {},
      events: {},
      accessibility: { accessibleName: "none" },
      editor: { icon: "icon", keywords: [], presets: { default: { displayName: "Icon" } }, defaultPreset: "default" }
    }
  }
};

const component = (id: string, componentRef = "Text"): PageNode => ({
  id,
  kind: "component",
  componentRef
});

const gridDocument: PageDocument = {
  schemaVersion: "2.0.0",
  id: "page",
  kind: "page",
  role: "test",
  children: [{
    id: "grid",
    kind: "layout",
    layout: "grid",
    children: [component("a"), component("b"), component("c"), component("d")]
  }]
};

const gridZone: GeometryZone = {
  zoneId: "grid:children",
  collection: { parentId: "grid" },
  ownerNodeId: "grid",
  depth: 1,
  rect: { x: 0, y: 0, width: 200, height: 200 },
  layout: "grid",
  items: [
    { nodeId: "a", rect: { x: 0, y: 0, width: 90, height: 80 } },
    { nodeId: "b", rect: { x: 100, y: 0, width: 90, height: 80 } },
    { nodeId: "c", rect: { x: 0, y: 100, width: 90, height: 80 } },
    { nodeId: "d", rect: { x: 100, y: 100, width: 90, height: 80 } }
  ]
};

const policy: DropPolicy = { components };

describe("layout engine", () => {
  it("treats the page root as a real drop collection", () => {
    const emptyDocument: PageDocument = {
      schemaVersion: "2.0.0",
      id: "empty_page",
      kind: "page",
      role: "test",
      children: []
    };

    expect(resolveNodeDrop({
      document: emptyDocument,
      policy,
      source: {
        type: "insert",
        source: { kind: "component", componentRef: "Text" }
      },
      hitNodeId: emptyDocument.id
    })).toEqual({
      valid: true,
      target: { parentId: emptyDocument.id },
      position: "inside"
    });

    expect(resolveNodeDrop({
      document: gridDocument,
      policy,
      source: { type: "existing", nodeId: "a" },
      hitNodeId: gridDocument.id
    })).toEqual({
      valid: true,
      target: { parentId: gridDocument.id },
      position: "inside"
    });
  });

  it("indexes ancestors, collections and layout depth without recursive lookup", () => {
    const index = createTreeIndex(gridDocument);
    expect(index.get("c")).toMatchObject({
      index: 2,
      depth: 1,
      layoutDepth: 1,
      ancestorIds: ["grid"],
      collectionRef: { parentId: "grid" }
    });
    expect(index.contains("grid", "c")).toBe(true);
    expect(index.contains("c", "grid")).toBe(false);
    expect(index.collection({ parentId: "grid" })?.map(({ id }) => id)).toEqual(["a", "b", "c", "d"]);
  });

  it("resolves wrapped grids by visual row and then horizontal position", () => {
    expect(resolveGeometryDrop({
      document: gridDocument,
      policy,
      source: { type: "insert", source: { kind: "component", componentRef: "Text" } },
      pointer: { x: 10, y: 120 },
      zones: [gridZone]
    })).toMatchObject({
      valid: true,
      target: { parentId: "grid", beforeNodeId: "c" }
    });

    expect(resolveGeometryDrop({
      document: gridDocument,
      policy,
      source: { type: "insert", source: { kind: "component", componentRef: "Text" } },
      pointer: { x: 190, y: 120 },
      zones: [gridZone]
    })).toMatchObject({
      valid: true,
      target: { parentId: "grid" }
    });
  });

  it("uses explicit slot geometry instead of choosing the first catalog slot", () => {
    const document: PageDocument = {
      schemaVersion: "2.0.0",
      id: "page",
      kind: "page",
      role: "test",
      children: [{
        id: "box",
        kind: "component",
        componentRef: "Box",
        slots: { content: [], icon: [] }
      }]
    };
    const contentZone: GeometryZone = {
      zoneId: "box:content",
      collection: { parentId: "box", slot: "content" },
      ownerNodeId: "box",
      depth: 2,
      rect: { x: 0, y: 0, width: 100, height: 50 },
      layout: "slot",
      items: []
    };
    const iconZone: GeometryZone = {
      ...contentZone,
      zoneId: "box:icon",
      collection: { parentId: "box", slot: "icon" },
      rect: { x: 0, y: 50, width: 100, height: 50 }
    };

    expect(resolveGeometryDrop({
      document,
      policy,
      source: { type: "insert", source: { kind: "component", componentRef: "Text" } },
      pointer: { x: 20, y: 25 },
      zones: [contentZone, iconZone]
    })).toMatchObject({
      valid: true,
      target: { parentId: "box", slot: "content" }
    });
    expect(resolveGeometryDrop({
      document,
      policy,
      source: { type: "insert", source: { kind: "component", componentRef: "Text" } },
      pointer: { x: 20, y: 75 },
      zones: [contentZone, iconZone]
    })).toEqual({ valid: false, reason: "slotRejected" });
  });

  it("falls back from an illegal deep zone to a legal ancestor zone", () => {
    const document: PageDocument = {
      schemaVersion: "2.0.0",
      id: "page",
      kind: "page",
      role: "test",
      children: [{
        id: "stack",
        kind: "layout",
        layout: "stack",
        children: [{
          id: "box",
          kind: "component",
          componentRef: "Box",
          slots: { icon: [] }
        }]
      }]
    };
    const zones: GeometryZone[] = [
      {
        zoneId: "stack",
        collection: { parentId: "stack" },
        ownerNodeId: "stack",
        depth: 1,
        rect: { x: 0, y: 0, width: 200, height: 200 },
        layout: "stack",
        items: [{ nodeId: "box", rect: { x: 10, y: 10, width: 180, height: 180 } }]
      },
      {
        zoneId: "box:icon",
        collection: { parentId: "box", slot: "icon" },
        ownerNodeId: "box",
        depth: 2,
        rect: { x: 20, y: 20, width: 160, height: 160 },
        layout: "slot",
        items: []
      }
    ];

    expect(resolveGeometryDrop({
      document,
      policy,
      source: { type: "insert", source: { kind: "component", componentRef: "Text" } },
      pointer: { x: 50, y: 50 },
      zones
    })).toMatchObject({
      valid: true,
      target: { parentId: "stack", beforeNodeId: "box" }
    });
  });

  it("enforces cycle and safe layout-depth constraints", () => {
    const document: PageDocument = {
      schemaVersion: "2.0.0",
      id: "page",
      kind: "page",
      role: "test",
      children: [
        {
          id: "source",
          kind: "layout",
          layout: "stack",
          children: [{
            id: "source_child",
            kind: "layout",
            layout: "stack",
            children: [component("text")]
          }]
        },
        {
          id: "target",
          kind: "layout",
          layout: "stack",
          children: []
        }
      ]
    };

    expect(resolveNodeDrop({
      document,
      policy: { ...policy, maxLayoutDepth: 2 },
      source: { type: "existing", nodeId: "source" },
      hitNodeId: "target",
      pointer: { x: 50, y: 50 },
      hitRect: { x: 0, y: 0, width: 100, height: 100 }
    })).toEqual({ valid: false, reason: "layoutDepthExceeded" });
    expect(resolveNodeDrop({
      document,
      policy,
      source: { type: "existing", nodeId: "source" },
      hitNodeId: "source_child",
      pointer: { x: 50, y: 50 },
      hitRect: { x: 0, y: 0, width: 100, height: 100 }
    })).toEqual({ valid: false, reason: "selfOrDescendant" });
  });
});
