import type { DocumentCommand } from "../command.js";
import type { HandlerContext, HandlerResult } from "../handler.js";
import { handleInsertNode } from "./insert-node.js";
import { handleMoveNode } from "./move-node.js";
import { handleRemoveNode } from "./remove-node.js";
import { handleSetLayoutProperty } from "./set-layout-property.js";
import { handleSetProp } from "./set-prop.js";
import { handleSetResponsivePolicy } from "./set-responsive-policy.js";
import { handleSetRole } from "./set-role.js";
import { handleSetToken } from "./set-token.js";
import { handleSetVariant } from "./set-variant.js";

export function dispatchCommand(context: HandlerContext, command: DocumentCommand): HandlerResult {
  switch (command.type) {
    case "node.insert": return handleInsertNode(context, command);
    case "node.move": return handleMoveNode(context, command);
    case "node.remove": return handleRemoveNode(context, command);
    case "node.setLayoutProperty": return handleSetLayoutProperty(context, command);
    case "node.setProp": return handleSetProp(context, command);
    case "node.setResponsivePolicy": return handleSetResponsivePolicy(context, command);
    case "node.setRole": return handleSetRole(context, command);
    case "node.setToken": return handleSetToken(context, command);
    case "node.setVariant": return handleSetVariant(context, command);
  }
}
