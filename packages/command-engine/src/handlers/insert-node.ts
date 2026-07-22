import { findNodeLocation, insertBefore } from "../tree.js";
import { resolveTarget } from "../target.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import type { InsertNodeCommand } from "../command.js";

export function handleInsertNode(context: HandlerContext, command: InsertNodeCommand): HandlerResult {
  if (findNodeLocation(context.document, command.node.id)) {
    return handlerRejection("DUPLICATE_NODE_ID", `Node id '${command.node.id}' already exists.`, command.node.id);
  }
  const target = resolveTarget(context, command.targetParentId, command.targetSlot);
  if (!target.accepted) return target;
  if (!insertBefore(target.collection, command.node, command.beforeNodeId)) {
    return handlerRejection("SCHEMA_INVALID", `beforeNodeId '${command.beforeNodeId}' is not a child of the target.`, command.node.id);
  }
  return {
    accepted: true,
    operations: [{
      op: "node.insert",
      nodeId: command.node.id,
      targetParentId: command.targetParentId,
      ...(command.targetSlot ? { targetSlot: command.targetSlot } : {}),
      ...(command.beforeNodeId ? { beforeNodeId: command.beforeNodeId } : {})
    }]
  };
}
