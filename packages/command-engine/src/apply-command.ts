import type { PageDocument } from "@agidn/document-schema";
import { validateDocument, type RuleContext } from "@agidn/rule-engine";
import { checkDocumentCommand } from "./command-schema.js";
import type { CommandResult } from "./command-result.js";
import { dispatchCommand } from "./handlers/index.js";
import { rejectCommand } from "./rejection.js";

export function applyCommand(document: PageDocument, input: unknown, rules: RuleContext): CommandResult {
  const decoded = checkDocumentCommand(input);
  if (!decoded.valid) {
    const firstIssue = decoded.issues[0];
    return rejectCommand(
      document,
      "COMMAND_INVALID",
      firstIssue ? `Invalid Command at ${firstIssue.path}: ${firstIssue.message}` : "Invalid Command.",
      { ...(firstIssue?.path ? { path: firstIssue.path } : {}) }
    );
  }
  const command = structuredClone(decoded.command);
  if (command.protocolVersion !== document.schemaVersion) {
    return rejectCommand(document, "COMMAND_INVALID", `Command protocol ${command.protocolVersion} does not match document schema ${document.schemaVersion}.`);
  }

  const candidate = structuredClone(document);
  const handled = dispatchCommand({ document: candidate, rules }, command);
  if (!handled.accepted) {
    return { accepted: false, document, violations: [handled.violation] };
  }

  const validation = validateDocument(candidate, rules);
  if (!validation.valid) return { accepted: false, document, violations: validation.violations };
  return {
    accepted: true,
    document: candidate,
    command,
    patch: { protocolVersion: "2.0.0", commandId: command.commandId, operations: handled.operations }
  };
}
