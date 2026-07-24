export class InvalidRevisionStoreStateError extends Error {
  constructor(public readonly issues: readonly { path: string; message: string }[]) {
    super(`Invalid Revision Store state: ${issues.map(({ path, message }) => `${path} ${message}`).join("; ")}`);
    this.name = "InvalidRevisionStoreStateError";
  }
}
