import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

export const WORKBENCH_LAYOUT_VERSION = "1.0.0" as const;

export interface SplitLayoutNode {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  sizes: number[];
  children: WorkbenchLayoutNode[];
}

export interface TabLayoutNode {
  type: "tabs";
  id: string;
  activePanelId: string;
  panelIds: string[];
}

export interface PanelLayoutNode {
  type: "panel";
  id: string;
  panelId: string;
}

export type WorkbenchLayoutNode = SplitLayoutNode | TabLayoutNode | PanelLayoutNode;

export interface WorkbenchLayoutState {
  version: typeof WORKBENCH_LAYOUT_VERSION;
  root: WorkbenchLayoutNode;
  hiddenPanelIds: string[];
  maximizedPanelId?: string;
}

export type DockPosition = "center" | "left" | "right" | "top" | "bottom";

const IdentifierSchema = Type.String({ minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" });

export const WorkbenchLayoutNodeSchema = Type.Recursive((Node) =>
  Type.Union([
    Type.Object(
      {
        type: Type.Literal("split"),
        id: IdentifierSchema,
        direction: Type.Union([Type.Literal("horizontal"), Type.Literal("vertical")]),
        sizes: Type.Array(Type.Number({ exclusiveMinimum: 0 })),
        children: Type.Array(Node, { minItems: 2 })
      },
      { additionalProperties: false }
    ),
    Type.Object(
      {
        type: Type.Literal("tabs"),
        id: IdentifierSchema,
        activePanelId: IdentifierSchema,
        panelIds: Type.Array(IdentifierSchema, { minItems: 1 })
      },
      { additionalProperties: false }
    ),
    Type.Object(
      { type: Type.Literal("panel"), id: IdentifierSchema, panelId: IdentifierSchema },
      { additionalProperties: false }
    )
  ])
);

export const WorkbenchLayoutStateSchema = Type.Object(
  {
    version: Type.Literal(WORKBENCH_LAYOUT_VERSION),
    root: WorkbenchLayoutNodeSchema,
    hiddenPanelIds: Type.Array(IdentifierSchema),
    maximizedPanelId: Type.Optional(IdentifierSchema)
  },
  { additionalProperties: false }
);

const compiledLayout = TypeCompiler.Compile(WorkbenchLayoutStateSchema);

export interface LayoutIssue {
  path: string;
  message: string;
}

export function checkWorkbenchLayout(value: unknown):
  | { valid: true; layout: WorkbenchLayoutState }
  | { valid: false; issues: LayoutIssue[] } {
  if (compiledLayout.Check(value)) return { valid: true, layout: value as WorkbenchLayoutState };
  return {
    valid: false,
    issues: [...compiledLayout.Errors(value)].map((error) => ({ path: error.path || "/", message: error.message }))
  };
}

function normalizeSizes(sizes: readonly number[], count: number): number[] {
  if (sizes.length !== count || sizes.some((size) => !Number.isFinite(size) || size <= 0)) {
    return Array.from({ length: count }, () => 1 / count);
  }
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return sizes.map((size) => size / total);
}

function collectVisiblePanels(node: WorkbenchLayoutNode, result = new Set<string>()): Set<string> {
  if (node.type === "panel") result.add(node.panelId);
  else if (node.type === "tabs") node.panelIds.forEach((panelId) => result.add(panelId));
  else node.children.forEach((child) => collectVisiblePanels(child, result));
  return result;
}

function normalizeNode(node: WorkbenchLayoutNode, availablePanels: ReadonlySet<string>): WorkbenchLayoutNode | undefined {
  if (node.type === "panel") return availablePanels.has(node.panelId) ? { ...node } : undefined;
  if (node.type === "tabs") {
    const panelIds = [...new Set(node.panelIds)].filter((panelId) => availablePanels.has(panelId));
    if (panelIds.length === 0) return undefined;
    return {
      ...node,
      panelIds,
      activePanelId: panelIds.includes(node.activePanelId) ? node.activePanelId : panelIds[0]!
    };
  }

  const retained = node.children.flatMap((child, index) => {
    const normalized = normalizeNode(child, availablePanels);
    return normalized ? [{ child: normalized, size: node.sizes[index] }] : [];
  });
  if (retained.length === 0) return undefined;
  if (retained.length === 1) return retained[0]!.child;
  return {
    ...node,
    children: retained.map(({ child }) => child),
    sizes: normalizeSizes(retained.map(({ size }) => size ?? 0), retained.length)
  };
}

export function normalizeWorkbenchLayout(
  input: WorkbenchLayoutState,
  availablePanelIds: Iterable<string>,
  fallback: WorkbenchLayoutState
): WorkbenchLayoutState {
  const availablePanels = new Set(availablePanelIds);
  const root = normalizeNode(input.root, availablePanels) ?? normalizeNode(fallback.root, availablePanels);
  if (!root) throw new Error("Workbench requires at least one available panel.");
  const visible = collectVisiblePanels(root);
  const hiddenPanelIds = [...new Set(input.hiddenPanelIds)].filter((panelId) => availablePanels.has(panelId) && !visible.has(panelId));
  return {
    version: WORKBENCH_LAYOUT_VERSION,
    root,
    hiddenPanelIds,
    ...(input.maximizedPanelId && visible.has(input.maximizedPanelId) ? { maximizedPanelId: input.maximizedPanelId } : {})
  };
}

export function restoreWorkbenchLayout(
  value: unknown,
  availablePanelIds: Iterable<string>,
  fallback: WorkbenchLayoutState
): WorkbenchLayoutState {
  const checked = checkWorkbenchLayout(value);
  return normalizeWorkbenchLayout(checked.valid ? checked.layout : fallback, availablePanelIds, fallback);
}

function mapNode(node: WorkbenchLayoutNode, mapper: (node: WorkbenchLayoutNode) => WorkbenchLayoutNode): WorkbenchLayoutNode {
  const mapped = node.type === "split" ? { ...node, children: node.children.map((child) => mapNode(child, mapper)) } : node;
  return mapper(mapped);
}

export function setActivePanel(layout: WorkbenchLayoutState, tabGroupId: string, panelId: string): WorkbenchLayoutState {
  return {
    ...layout,
    root: mapNode(layout.root, (node) =>
      node.type === "tabs" && node.id === tabGroupId && node.panelIds.includes(panelId)
        ? { ...node, activePanelId: panelId }
        : node
    )
  };
}

export function resizeSplit(
  layout: WorkbenchLayoutState,
  splitId: string,
  dividerIndex: number,
  deltaFraction: number,
  minimumFraction = 0.08
): WorkbenchLayoutState {
  return {
    ...layout,
    root: mapNode(layout.root, (node) => {
      if (node.type !== "split" || node.id !== splitId || dividerIndex < 0 || dividerIndex >= node.children.length - 1) return node;
      const sizes = normalizeSizes(node.sizes, node.children.length);
      const pairTotal = sizes[dividerIndex]! + sizes[dividerIndex + 1]!;
      const minimum = Math.min(minimumFraction, pairTotal / 2);
      const left = Math.min(pairTotal - minimum, Math.max(minimum, sizes[dividerIndex]! + deltaFraction));
      sizes[dividerIndex] = left;
      sizes[dividerIndex + 1] = pairTotal - left;
      return { ...node, sizes };
    })
  };
}

function removePanelFromNode(node: WorkbenchLayoutNode, panelId: string): WorkbenchLayoutNode | undefined {
  if (node.type === "panel") return node.panelId === panelId ? undefined : node;
  if (node.type === "tabs") {
    const panelIds = node.panelIds.filter((candidate) => candidate !== panelId);
    if (panelIds.length === 0) return undefined;
    return { ...node, panelIds, activePanelId: panelIds.includes(node.activePanelId) ? node.activePanelId : panelIds[0]! };
  }
  const retained = node.children.flatMap((child, index) => {
    const next = removePanelFromNode(child, panelId);
    return next ? [{ child: next, size: node.sizes[index] }] : [];
  });
  if (retained.length === 0) return undefined;
  if (retained.length === 1) return retained[0]!.child;
  return {
    ...node,
    children: retained.map(({ child }) => child),
    sizes: normalizeSizes(retained.map(({ size }) => size ?? 0), retained.length)
  };
}

export function closePanel(layout: WorkbenchLayoutState, panelId: string): WorkbenchLayoutState {
  const root = removePanelFromNode(layout.root, panelId);
  if (!root) return layout;
  const next: WorkbenchLayoutState = {
    ...layout,
    root,
    hiddenPanelIds: [...new Set([...layout.hiddenPanelIds, panelId])]
  };
  if (layout.maximizedPanelId !== panelId) return next;
  const { maximizedPanelId: _removed, ...restored } = next;
  return restored;
}

function containsPanel(node: WorkbenchLayoutNode, panelId: string): boolean {
  if (node.type === "panel") return node.panelId === panelId;
  if (node.type === "tabs") return node.panelIds.includes(panelId);
  return node.children.some((child) => containsPanel(child, panelId));
}

export function openPanel(layout: WorkbenchLayoutState, panelId: string, targetTabGroupId: string): WorkbenchLayoutState {
  if (containsPanel(layout.root, panelId)) {
    return {
      ...layout,
      root: mapNode(layout.root, (node) =>
        node.type === "tabs" && node.panelIds.includes(panelId) ? { ...node, activePanelId: panelId } : node
      )
    };
  }
  let inserted = false;
  const root = mapNode(layout.root, (node) => {
    if (node.type !== "tabs" || node.id !== targetTabGroupId) return node;
    inserted = true;
    return { ...node, panelIds: [...node.panelIds, panelId], activePanelId: panelId };
  });
  if (!inserted) return layout;
  return { ...layout, root, hiddenPanelIds: layout.hiddenPanelIds.filter((candidate) => candidate !== panelId) };
}

export function toggleMaximizedPanel(layout: WorkbenchLayoutState, panelId: string): WorkbenchLayoutState {
  if (layout.maximizedPanelId !== panelId) return { ...layout, maximizedPanelId: panelId };
  const { maximizedPanelId: _removed, ...restored } = layout;
  return restored;
}

export function findPanelTabGroup(node: WorkbenchLayoutNode, panelId: string): string | undefined {
  if (node.type === "tabs" && node.panelIds.includes(panelId)) return node.id;
  if (node.type === "split") {
    for (const child of node.children) {
      const result = findPanelTabGroup(child, panelId);
      if (result) return result;
    }
  }
  return undefined;
}

function findNodeById(node: WorkbenchLayoutNode, nodeId: string): WorkbenchLayoutNode | undefined {
  if (node.id === nodeId) return node;
  if (node.type !== "split") return undefined;
  for (const child of node.children) {
    const result = findNodeById(child, nodeId);
    if (result) return result;
  }
  return undefined;
}

function replaceNodeById(
  node: WorkbenchLayoutNode,
  nodeId: string,
  replacement: WorkbenchLayoutNode
): WorkbenchLayoutNode {
  if (node.id === nodeId) return replacement;
  if (node.type !== "split") return node;
  return { ...node, children: node.children.map((child) => replaceNodeById(child, nodeId, replacement)) };
}

function collectNodeIds(node: WorkbenchLayoutNode, result = new Set<string>()): Set<string> {
  result.add(node.id);
  if (node.type === "split") node.children.forEach((child) => collectNodeIds(child, result));
  return result;
}

function uniqueNodeId(existing: Set<string>, preferred: string): string {
  let candidate = preferred;
  let suffix = 2;
  while (existing.has(candidate)) candidate = `${preferred}.${suffix++}`;
  existing.add(candidate);
  return candidate;
}

/** Moves a visible or hidden panel into a leaf node using IDE-style center or edge docking. */
export function dockPanel(
  layout: WorkbenchLayoutState,
  panelId: string,
  targetNodeId: string,
  position: DockPosition
): WorkbenchLayoutState {
  const originalTarget = findNodeById(layout.root, targetNodeId);
  if (!originalTarget || originalTarget.type === "split") return layout;

  if (containsPanel(originalTarget, panelId)) {
    if (position === "center" && originalTarget.type === "tabs") {
      return setActivePanel(layout, originalTarget.id, panelId);
    }
    if (originalTarget.type === "panel" || originalTarget.panelIds.length === 1) return layout;
  }

  const detachedRoot = removePanelFromNode(layout.root, panelId);
  if (!detachedRoot) return layout;
  const target = findNodeById(detachedRoot, targetNodeId);
  if (!target || target.type === "split") return layout;

  const existingIds = collectNodeIds(detachedRoot);
  let replacement: WorkbenchLayoutNode;
  if (position === "center") {
    replacement = target.type === "tabs"
      ? { ...target, panelIds: [...target.panelIds, panelId], activePanelId: panelId }
      : {
          type: "tabs",
          id: uniqueNodeId(existingIds, `tabs.dock.${target.id}`),
          activePanelId: panelId,
          panelIds: [target.panelId, panelId]
        };
  } else {
    const before = position === "left" || position === "top";
    const panelNode: PanelLayoutNode = {
      type: "panel",
      id: uniqueNodeId(existingIds, `panel.dock.${panelId}`),
      panelId
    };
    replacement = {
      type: "split",
      id: uniqueNodeId(existingIds, `split.dock.${target.id}`),
      direction: position === "left" || position === "right" ? "horizontal" : "vertical",
      sizes: before ? [0.3, 0.7] : [0.7, 0.3],
      children: before ? [panelNode, target] : [target, panelNode]
    };
  }

  return {
    ...layout,
    root: replaceNodeById(detachedRoot, target.id, replacement),
    hiddenPanelIds: layout.hiddenPanelIds.filter((candidate) => candidate !== panelId)
  };
}
