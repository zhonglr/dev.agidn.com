import type { GetCatalogResponse } from "@agidn/api-protocol";
import type { PageNode } from "@agidn/document-schema";
import type { InsertSource } from "@agidn/layout-engine";
import { instantiatePattern } from "@agidn/project-assets";
import { createComponentNode } from "./component-node-factory.js";
import {
  createLayoutNode,
  type LayoutKind
} from "./layout-node-factory.js";

export type InsertDragPayload =
  | { type: "component"; id: string; presetId?: string }
  | { type: "layout"; id: LayoutKind }
  | { type: "pattern"; id: string };

function sourceForNode(node: PageNode): InsertSource {
  return node.kind === "component"
    ? { kind: "component", componentRef: node.componentRef }
    : { kind: "layout", layout: node.layout };
}

export function insertSourcesForPayload(
  catalog: GetCatalogResponse,
  payload: InsertDragPayload
): InsertSource[] {
  if (payload.type === "component") {
    return [{ kind: "component", componentRef: payload.id }];
  }
  if (payload.type === "layout") {
    return [{ kind: "layout", layout: payload.id }];
  }
  return (catalog.assets.patterns[payload.id]?.nodes ?? []).map(sourceForNode);
}

export function createNodesForPayload(
  catalog: GetCatalogResponse,
  payload: InsertDragPayload,
  defaultContent: string
): PageNode[] {
  if (payload.type === "component") {
    const node = createComponentNode(
      catalog,
      payload.id,
      defaultContent,
      payload.presetId
    );
    return node ? [node] : [];
  }
  if (payload.type === "layout") return [createLayoutNode(payload.id)];
  const pattern = catalog.assets.patterns[payload.id];
  if (!pattern) return [];
  const instanceId = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  return instantiatePattern(
    pattern,
    (templateId) => `pattern_${instanceId}:${templateId}`
  );
}

export function createNodeForPayload(
  catalog: GetCatalogResponse,
  payload: InsertDragPayload,
  defaultContent: string
): PageNode | undefined {
  return createNodesForPayload(catalog, payload, defaultContent)[0];
}

export function insertPayloadKey(payload: InsertDragPayload): string {
  return payload.type === "component"
    ? `component:${payload.id}:${payload.presetId ?? ""}`
    : `${payload.type}:${payload.id}`;
}
