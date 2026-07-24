export { applyCommand } from "./apply-command.js";
export { checkDocumentCommand, DocumentCommandSchema, type CommandSchemaIssue } from "./command-schema.js";
export type {
  DocumentCommand,
  InsertNodeCommand,
  MoveNodeCommand,
  RemoveNodeCommand,
  SetAccessibilityCommand,
  SetInteractionsCommand,
  SetLayoutPropertyCommand,
  SetNameCommand,
  SetPlacementCommand,
  SetPropCommand,
  SetResponsivePolicyCommand,
  SetRoleCommand,
  SetStyleBindingCommand,
  SetVariantCommand,
  SetVisibilityCommand
} from "./command.js";
export type { CommandResult } from "./command-result.js";
export type { DocumentPatch, PatchOperation } from "./patch.js";
export { checkDocumentPatch, DocumentPatchSchema, PatchOperationSchema } from "./patch-schema.js";
