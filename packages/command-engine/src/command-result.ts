import type { PageDocument } from "@agidn/document-schema";
import type { RuleViolation } from "@agidn/rule-engine";
import type { DocumentCommand } from "./command.js";
import type { DocumentPatch } from "./patch.js";

export type CommandResult =
  | { accepted: true; document: PageDocument; command: DocumentCommand; patch: DocumentPatch }
  | { accepted: false; document: PageDocument; violations: RuleViolation[] };
