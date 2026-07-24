export type PatchOperation =
  | { op: "node.update"; nodeId: string; changes: Record<string, unknown> }
  | { op: "node.insert"; nodeId: string; targetParentId: string; targetSlot?: string; beforeNodeId?: string }
  | { op: "node.move"; nodeId: string; targetParentId: string; targetSlot?: string; beforeNodeId?: string }
  | { op: "node.remove"; nodeId: string };

export interface DocumentPatch {
  protocolVersion: "2.0.0";
  commandId: string;
  operations: PatchOperation[];
}
