import type { GetCatalogResponse } from "@agidn/api-protocol";
import type { PageDocument } from "@agidn/document-schema";
import {
  resolveNodeDrop,
  resolveSiblingDrop,
  validateInsertSourcesTarget,
  type DropErrorCode,
  type DropPolicy,
  type DropResolution,
  type DropTarget,
  type InsertSource,
  type Point,
  type Rect
} from "@agidn/layout-engine";

export const NODE_DRAG_MIME = "application/x-agidn-node";
export const COMPONENT_DRAG_MIME = "application/x-agidn-component";
export const LAYOUT_DRAG_MIME = "application/x-agidn-layout";
export const PATTERN_DRAG_MIME = "application/x-agidn-pattern";

export type MoveTarget = DropTarget;
export type StructureDragErrorCode = DropErrorCode;
export type InsertResolution = DropResolution;
export type MoveResolution = DropResolution;
export type DragPointer = Point;
export type DragHitRect = Rect;
export type { InsertSource };

function policyFromCatalog(catalog: GetCatalogResponse): DropPolicy {
  const policies =
    typeof catalog.policies === "object" && catalog.policies !== null
      ? catalog.policies as Record<string, unknown>
      : undefined;
  const maxLayoutDepth =
    typeof policies?.maxLayoutDepth === "number" && Number.isInteger(policies.maxLayoutDepth)
      ? policies.maxLayoutDepth
      : undefined;
  return {
    components: catalog.components,
    ...(maxLayoutDepth !== undefined ? { maxLayoutDepth } : {})
  };
}

export function resolveInsertTarget(
  document: PageDocument,
  catalog: GetCatalogResponse,
  source: InsertSource,
  hitNodeId: string,
  pointer?: DragPointer,
  hitRect?: DragHitRect
): InsertResolution {
  return resolveNodeDrop({
    document,
    policy: policyFromCatalog(catalog),
    source: { type: "insert", source },
    hitNodeId,
    ...(pointer ? { pointer } : {}),
    ...(hitRect ? { hitRect } : {})
  });
}

export function resolveInsertSourcesTarget(
  document: PageDocument,
  catalog: GetCatalogResponse,
  sources: readonly InsertSource[],
  hitNodeId: string,
  pointer?: DragPointer,
  hitRect?: DragHitRect
): InsertResolution {
  const first = sources[0];
  if (!first) return { valid: false, reason: "invalidTarget" };
  const resolution = resolveInsertTarget(
    document,
    catalog,
    first,
    hitNodeId,
    pointer,
    hitRect
  );
  if (!resolution.valid || sources.length === 1) return resolution;
  const validation = validateInsertSourcesTarget(
    document,
    policyFromCatalog(catalog),
    sources,
    resolution.target
  );
  return validation.valid
    ? { ...resolution, target: validation.target }
    : validation;
}

export function resolveMoveTarget(
  document: PageDocument,
  catalog: GetCatalogResponse,
  sourceNodeId: string,
  hitNodeId: string,
  pointer: DragPointer,
  hitRect: DragHitRect
): MoveResolution {
  return resolveNodeDrop({
    document,
    policy: policyFromCatalog(catalog),
    source: { type: "existing", nodeId: sourceNodeId },
    hitNodeId,
    pointer,
    hitRect
  });
}

export function resolveSiblingMove(
  document: PageDocument,
  sourceNodeId: string,
  direction: "up" | "down"
): MoveResolution {
  return resolveSiblingDrop(document, sourceNodeId, direction);
}
