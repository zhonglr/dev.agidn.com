import type { SetLayoutPropertyCommand } from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { findNodeLocation, isLayoutNode } from "../tree.js";

export function handleSetLayoutProperty(context: HandlerContext, command: SetLayoutPropertyCommand): HandlerResult {
  const node = findNodeLocation(context.document, command.nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (!isLayoutNode(node)) return handlerRejection("COMMAND_TARGET_INVALID", "Layout properties can only be set on layout nodes.", node.id);
  (node as unknown as Record<string, unknown>)[command.property] = command.value;
  return { accepted: true, operations: [{ op: "node.update", nodeId: node.id, changes: { [command.property]: command.value } }] };
}
