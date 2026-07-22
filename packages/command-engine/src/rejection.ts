import type { PageDocument } from "@agidn/document-schema";
import type { RuleViolation } from "@agidn/rule-engine";
import type { CommandResult } from "./command-result.js";

export function rejectCommand(
  document: PageDocument,
  code: RuleViolation["code"],
  message: string,
  options: { nodeId?: string; path?: string } = {}
): CommandResult {
  return {
    accepted: false,
    document,
    violations: [{
      code,
      severity: "error",
      message,
      suggestions: [],
      approvalAllowed: false,
      ...(options.nodeId ? { nodeId: options.nodeId } : {}),
      ...(options.path ? { path: options.path } : {})
    }]
  };
}
