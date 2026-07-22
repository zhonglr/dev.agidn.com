import type { Static } from "@sinclair/typebox";
import type { DocumentCommandSchema } from "./command-schema.js";

export type DocumentCommand = Static<typeof DocumentCommandSchema>;
export type InsertNodeCommand = Extract<DocumentCommand, { type: "node.insert" }>;
export type MoveNodeCommand = Extract<DocumentCommand, { type: "node.move" }>;
export type RemoveNodeCommand = Extract<DocumentCommand, { type: "node.remove" }>;
export type SetLayoutPropertyCommand = Extract<DocumentCommand, { type: "node.setLayoutProperty" }>;
export type SetPropCommand = Extract<DocumentCommand, { type: "node.setProp" }>;
export type SetVariantCommand = Extract<DocumentCommand, { type: "node.setVariant" }>;
export type SetTokenCommand = Extract<DocumentCommand, { type: "node.setToken" }>;
export type SetResponsivePolicyCommand = Extract<DocumentCommand, { type: "node.setResponsivePolicy" }>;
export type SetRoleCommand = Extract<DocumentCommand, { type: "node.setRole" }>;
