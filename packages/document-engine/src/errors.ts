import type { RuleViolation } from "@agidn/rule-engine";

export class InvalidInitialDocumentError extends Error {
  constructor(public readonly violations: RuleViolation[]) {
    super(`Initial PageDocument is invalid: ${violations.map(({ code, message }) => `${code}: ${message}`).join("; ")}`);
    this.name = "InvalidInitialDocumentError";
  }
}

export class InvalidRevisionStoreStateError extends Error {
  constructor(public readonly issues: readonly { path: string; message: string }[]) {
    super(`Invalid Revision Store state: ${issues.map(({ path, message }) => `${path} ${message}`).join("; ")}`);
    this.name = "InvalidRevisionStoreStateError";
  }
}
