import type { RuleViolation } from "@agidn/rule-engine";

export class InvalidInitialDocumentError extends Error {
  constructor(public readonly violations: RuleViolation[]) {
    super(`Initial PageDocument is invalid: ${violations.map(({ code, message }) => `${code}: ${message}`).join("; ")}`);
    this.name = "InvalidInitialDocumentError";
  }
}
