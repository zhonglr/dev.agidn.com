import type { SetPropCommand } from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { findNodeLocation, isComponentNode } from "../tree.js";

export function handleSetProp(context: HandlerContext, command: SetPropCommand): HandlerResult {
  const node = findNodeLocation(context.document, command.nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (!isComponentNode(node)) return handlerRejection("COMMAND_TARGET_INVALID", "Props can only be set on component nodes.", node.id);
  (node.props ??= {})[command.property] = command.value;
  return { accepted: true, operations: [{ op: "node.update", nodeId: node.id, changes: { props: { [command.property]: command.value } } }] };
}
