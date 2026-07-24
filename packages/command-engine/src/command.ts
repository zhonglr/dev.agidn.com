import type { Static } from "@sinclair/typebox";
import type { DocumentCommandSchema } from "./command-schema.js";

export type DocumentCommand = Static<typeof DocumentCommandSchema>;
export type InsertNodeCommand = Extract<DocumentCommand, { type: "node.insert" }>;
export type MoveNodeCommand = Extract<DocumentCommand, { type: "node.move" }>;
export type RemoveNodeCommand = Extract<DocumentCommand, { type: "node.remove" }>;
export type SetLayoutPropertyCommand = Extract<DocumentCommand, { type: "node.setLayoutProperty" }>;
export type SetPropCommand = Extract<DocumentCommand, { type: "node.setProp" }>;
export type SetNameCommand = Extract<DocumentCommand, { type: "node.setName" }>;
export type SetVariantCommand = Extract<DocumentCommand, { type: "node.setVariant" }>;
export type SetStyleBindingCommand = Extract<DocumentCommand, { type: "node.setStyleBinding" }>;
export type SetResponsivePolicyCommand = Extract<DocumentCommand, { type: "node.setResponsivePolicy" }>;
export type SetRoleCommand = Extract<DocumentCommand, { type: "node.setRole" }>;
export type SetPlacementCommand = Extract<DocumentCommand, { type: "node.setPlacement" }>;
export type SetVisibilityCommand = Extract<DocumentCommand, { type: "node.setVisibility" }>;
export type SetAccessibilityCommand = Extract<DocumentCommand, { type: "node.setAccessibility" }>;
export type SetInteractionsCommand = Extract<DocumentCommand, { type: "node.setInteractions" }>;
