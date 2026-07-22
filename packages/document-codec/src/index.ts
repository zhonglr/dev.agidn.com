import { checkPageDocument, type PageDocument } from "@agidn/document-schema";

export class DocumentCodecError extends Error {
  constructor(public readonly issues: readonly { path: string; message: string }[]) {
    super(`Invalid PageDocument: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
    this.name = "DocumentCodecError";
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJson(entry)]));
  }
  return value;
}

export function serializeDocument(document: PageDocument): string {
  return `${JSON.stringify(sortJson(document), null, 2)}\n`;
}

export function parseDocument(source: string): PageDocument {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new DocumentCodecError([{ path: "/", message: error instanceof Error ? error.message : "Invalid JSON" }]);
  }
  const result = checkPageDocument(value);
  if (!result.valid) throw new DocumentCodecError(result.issues);
  return result.document;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}
