import type { SetResponsivePolicyCommand } from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { findNodeLocation, isLayoutNode } from "../tree.js";

export function handleSetResponsivePolicy(context: HandlerContext, command: SetResponsivePolicyCommand): HandlerResult {
  const node = findNodeLocation(context.document, command.nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (!isLayoutNode(node) || node.layout !== "grid") {
    return handlerRejection("COMMAND_TARGET_INVALID", "Responsive columns can only be set on Grid layout nodes.", node.id);
  }
  node.columns = command.columns;
  return { accepted: true, operations: [{ op: "node.update", nodeId: node.id, changes: { columns: command.columns } }] };
}
