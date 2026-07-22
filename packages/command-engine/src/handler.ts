import type { PageDocument } from "@agidn/document-schema";
import type { RuleContext, RuleViolation } from "@agidn/rule-engine";
import type { PatchOperation } from "./patch.js";

export interface HandlerContext {
  document: PageDocument;
  rules: RuleContext;
}

export interface RejectedHandlerResult {
  accepted: false;
  violation: RuleViolation;
}

export type HandlerResult = { accepted: true; operations: PatchOperation[] } | RejectedHandlerResult;

export function handlerRejection(code: RuleViolation["code"], message: string, nodeId?: string): RejectedHandlerResult {
  return {
    accepted: false,
    violation: {
      code,
      severity: "error",
      message,
      suggestions: [],
      approvalAllowed: false,
      ...(nodeId ? { nodeId } : {})
    }
  };
}
