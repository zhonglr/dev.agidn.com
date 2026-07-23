import type { StructureDragErrorCode } from "../structure-drag.js";
import { message, type MessageDescriptor, type MessageKey, type Translate } from "./types.js";

const messageKeys: Readonly<Record<StructureDragErrorCode, MessageKey>> = {
  dropTargetMissing: "drag.dropTargetMissing",
  sourceOrTargetMissing: "drag.sourceOrTargetMissing",
  selfOrDescendant: "drag.selfOrDescendant",
  requiredSourceSlot: "drag.requiredSourceSlot",
  alreadyAtPosition: "drag.alreadyAtPosition",
  nodeMissing: "drag.nodeMissing",
  alreadyFirst: "drag.alreadyFirst",
  alreadyLast: "drag.alreadyLast"
};

export function translateStructureDragError(t: Translate, code: StructureDragErrorCode): string {
  return t(messageKeys[code]);
}

export function structureDragErrorMessage(code: StructureDragErrorCode): MessageDescriptor {
  return message(messageKeys[code]);
}
