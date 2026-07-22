import type { SetTokenCommand } from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { findNodeLocation, isComponentNode } from "../tree.js";

export function handleSetToken(context: HandlerContext, command: SetTokenCommand): HandlerResult {
  const node = findNodeLocation(context.document, command.nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (!isComponentNode(node)) return handlerRejection("COMMAND_TARGET_INVALID", "Component token mappings can only be set on component nodes.", node.id);
  (node.tokens ??= {})[command.property] = command.tokenRef;
  return { accepted: true, operations: [{ op: "node.update", nodeId: node.id, changes: { tokens: { [command.property]: command.tokenRef } } }] };
}
