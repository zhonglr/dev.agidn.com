import type { PageNode } from "@agidn/document-schema";
import type { HandlerContext, RejectedHandlerResult } from "./handler.js";
import { handlerRejection } from "./handler.js";
import { childCollection, findNodeLocation } from "./tree.js";

export type TargetResult =
  | { accepted: true; parent: PageNode; collection: PageNode[] }
  | RejectedHandlerResult;

export function resolveTarget(context: HandlerContext, targetParentId: string, targetSlot?: string): TargetResult {
  const parent = findNodeLocation(context.document, targetParentId)?.node;
  if (!parent) return handlerRejection("SCHEMA_INVALID", `Target parent '${targetParentId}' does not exist.`);
  if (parent.kind === "layout") {
    if (targetSlot) return handlerRejection("INVALID_SLOT", "Layout nodes do not expose named slots.", parent.id);
  } else {
    if (!targetSlot) return handlerRejection("INVALID_SLOT", `A target slot is required for ${parent.componentRef}.`, parent.id);
    const definition = context.rules.components.components[parent.componentRef];
    if (!definition?.slots[targetSlot]) {
      return handlerRejection("INVALID_SLOT", `Slot '${targetSlot}' is not registered for ${parent.componentRef}.`, parent.id);
    }
  }
  const collection = childCollection(parent, targetSlot);
  if (!collection) return handlerRejection("INVALID_SLOT", "The target does not expose the requested child collection.", parent.id);
  return { accepted: true, parent, collection };
}
