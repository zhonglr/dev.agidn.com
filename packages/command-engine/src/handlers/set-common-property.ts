import type {
  SetAccessibilityCommand,
  SetInteractionsCommand,
  SetNameCommand,
  SetPlacementCommand,
  SetVisibilityCommand
} from "../command.js";
import { handlerRejection, type HandlerContext, type HandlerResult } from "../handler.js";
import { findNodeLocation, isComponentNode } from "../tree.js";

function updateOptionalField(
  context: HandlerContext,
  nodeId: string,
  field: "name" | "placement" | "visibility",
  value: unknown
): HandlerResult {
  const node = findNodeLocation(context.document, nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${nodeId}' does not exist.`);
  if (value === null) delete node[field];
  else Object.assign(node, { [field]: value });
  return {
    accepted: true,
    operations: [{ op: "node.update", nodeId: node.id, changes: { [field]: value } }]
  };
}

export function handleSetName(context: HandlerContext, command: SetNameCommand): HandlerResult {
  return updateOptionalField(context, command.nodeId, "name", command.name);
}

export function handleSetPlacement(context: HandlerContext, command: SetPlacementCommand): HandlerResult {
  return updateOptionalField(context, command.nodeId, "placement", command.placement);
}

export function handleSetVisibility(context: HandlerContext, command: SetVisibilityCommand): HandlerResult {
  return updateOptionalField(context, command.nodeId, "visibility", command.visibility);
}

export function handleSetAccessibility(
  context: HandlerContext,
  command: SetAccessibilityCommand
): HandlerResult {
  const node = findNodeLocation(context.document, command.nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (!isComponentNode(node))
    return handlerRejection(
      "COMMAND_TARGET_INVALID",
      "Accessibility can only be set on component nodes.",
      node.id
    );
  if (command.accessibility === null) delete node.accessibility;
  else node.accessibility = command.accessibility;
  return {
    accepted: true,
    operations: [
      { op: "node.update", nodeId: node.id, changes: { accessibility: command.accessibility } }
    ]
  };
}

export function handleSetInteractions(
  context: HandlerContext,
  command: SetInteractionsCommand
): HandlerResult {
  const node = findNodeLocation(context.document, command.nodeId)?.node;
  if (!node) return handlerRejection("SCHEMA_INVALID", `Node '${command.nodeId}' does not exist.`);
  if (!isComponentNode(node))
    return handlerRejection(
      "COMMAND_TARGET_INVALID",
      "Interactions can only be set on component nodes.",
      node.id
    );
  if (command.interactions.length === 0) delete node.interactions;
  else node.interactions = command.interactions;
  return {
    accepted: true,
    operations: [
      { op: "node.update", nodeId: node.id, changes: { interactions: command.interactions } }
    ]
  };
}
