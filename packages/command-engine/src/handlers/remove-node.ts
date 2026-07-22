import type { RemoveNodeCommand } from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { detachNode, findNodeLocation } from "../tree.js";

export function handleRemoveNode(context: HandlerContext, command: RemoveNodeCommand): HandlerResult {
  const location = findNodeLocation(context.document, command.nodeId);
  if (!location) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  detachNode(location);
  return { accepted: true, operations: [{ op: "node.remove", nodeId: command.nodeId }] };
}
