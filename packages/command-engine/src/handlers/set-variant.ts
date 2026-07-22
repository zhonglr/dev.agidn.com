import type { SetVariantCommand } from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { findNodeLocation, isComponentNode } from "../tree.js";

export function handleSetVariant(context: HandlerContext, command: SetVariantCommand): HandlerResult {
  const node = findNodeLocation(context.document, command.nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (!isComponentNode(node)) return handlerRejection("COMMAND_TARGET_INVALID", "Variants can only be set on component nodes.", node.id);
  node.variant = command.variant;
  return { accepted: true, operations: [{ op: "node.update", nodeId: node.id, changes: { variant: command.variant } }] };
}
