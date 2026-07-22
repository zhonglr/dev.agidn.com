import type { MoveNodeCommand } from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { resolveTarget } from "../target.js";
import { containsNode, detachNode, findNodeLocation, insertBefore } from "../tree.js";

export function handleMoveNode(context: HandlerContext, command: MoveNodeCommand): HandlerResult {
  const source = findNodeLocation(context.document, command.nodeId);
  if (!source) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (containsNode(source.node, command.targetParentId)) {
    return handlerRejection("INVALID_LAYOUT_NESTING", "A node cannot be moved into itself or one of its descendants.", source.node.id);
  }
  const target = resolveTarget(context, command.targetParentId, command.targetSlot);
  if (!target.accepted) return target;
  const node = detachNode(source);
  if (!insertBefore(target.collection, node, command.beforeNodeId)) {
    return handlerRejection("SCHEMA_INVALID", `beforeNodeId '${command.beforeNodeId}' is not a child of the target.`, node.id);
  }
  return {
    accepted: true,
    operations: [{
      op: "node.move",
      nodeId: node.id,
      targetParentId: command.targetParentId,
      ...(command.targetSlot ? { targetSlot: command.targetSlot } : {}),
      ...(command.beforeNodeId ? { beforeNodeId: command.beforeNodeId } : {})
    }]
  };
}
