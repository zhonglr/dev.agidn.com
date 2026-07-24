import type { SetStyleBindingCommand } from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { findNodeLocation, isComponentNode } from "../tree.js";

export function handleSetStyleBinding(context: HandlerContext, command: SetStyleBindingCommand): HandlerResult {
  const node = findNodeLocation(context.document, command.nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (!isComponentNode(node))
    return handlerRejection("COMMAND_TARGET_INVALID", "Style bindings can only be set on component nodes.", node.id);
  if (command.tokenRef === null) {
    delete node.styleBindings?.[command.property];
    if (node.styleBindings && Object.keys(node.styleBindings).length === 0) delete node.styleBindings;
  } else {
    (node.styleBindings ??= {})[command.property] = command.tokenRef;
  }
  return {
    accepted: true,
    operations: [
      { op: "node.update", nodeId: node.id, changes: { styleBindings: { [command.property]: command.tokenRef } } }
    ]
  };
}
