import type { SetRoleCommand } from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { findNodeLocation } from "../tree.js";

export function handleSetRole(context: HandlerContext, command: SetRoleCommand): HandlerResult {
  const node = findNodeLocation(context.document, command.nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (command.role === null) delete node.role;
  else node.role = command.role;
  return { accepted: true, operations: [{ op: "node.update", nodeId: node.id, changes: { role: command.role } }] };
}
