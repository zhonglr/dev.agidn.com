import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { selectComponents, type ComponentRegistry } from "@agidn/component-registry";
import { selectTokens, type TokenRegistry } from "@agidn/design-tokens";
import { stableJson } from "@agidn/document-codec";
import type { PageDocument } from "@agidn/document-schema";
import type { ProjectAssetRegistry } from "@agidn/project-assets";
import { collectDocumentReferences, validateDocument, type RuleContext } from "@agidn/rule-engine";

export interface ActionDefinition {
  name: string;
  description: string;
  arguments?: Record<string, "string" | "number" | "boolean">;
}

export interface ActionRegistry {
  version: string;
  actions: Record<string, ActionDefinition>;
  dataSources?: Record<string, unknown>;
}

export interface ExportInput {
  document: PageDocument;
  components: ComponentRegistry;
  tokens: TokenRegistry;
  policies: unknown;
  actions: ActionRegistry;
  constraints: unknown;
  assets: ProjectAssetRegistry;
}

export interface ContextManifest {
  protocolVersion: "2.0.0";
  documentId: string;
  schemaVersion: string;
  hashAlgorithm: "sha256";
  files: Record<string, string>;
  contentHash: string;
}

export interface ContextPackage {
  files: Record<string, string>;
  manifest: ContextManifest;
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function createContextPackage(input: ExportInput): ContextPackage {
  const context: RuleContext = { components: input.components, tokens: input.tokens, actions: input.actions };
  const validation = validateDocument(input.document, context);
  if (!validation.valid) {
    throw new Error(`Cannot export invalid PageDocument: ${validation.violations.map(({ code, message }) => `${code}: ${message}`).join("; ")}`);
  }
  const references = collectDocumentReferences(input.document);
  const selectedActions = Object.fromEntries(
    [...references.actions].sort().flatMap((reference) => {
      const action = input.actions.actions[reference];
      return action ? [[reference, action]] : [];
    })
  );
  const payloads: Record<string, unknown> = {
    "document.json": input.document,
    "components.json": selectComponents(input.components, references.components),
    "tokens.json": selectTokens(input.tokens, references.tokens),
    "policies.json": input.policies,
    "actions.json": { version: input.actions.version, actions: selectedActions, dataSources: input.actions.dataSources ?? {} },
    "constraints.json": input.constraints,
    "assets.json": input.assets
  };
  const files = Object.fromEntries(Object.entries(payloads).map(([name, payload]) => [name, stableJson(payload)]));
  const fileHashes = Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)).map(([name, content]) => [name, hash(content)]));
  const contentHash = hash(Object.entries(fileHashes).map(([name, digest]) => `${name}:${digest}`).join("\n"));
  const manifest: ContextManifest = {
    protocolVersion: "2.0.0",
    documentId: input.document.id,
    schemaVersion: input.document.schemaVersion,
    hashAlgorithm: "sha256",
    files: fileHashes,
    contentHash
  };
  files["manifest.json"] = stableJson(manifest);
  return { files, manifest };
}

export async function writeContextPackage(contextPackage: ContextPackage, outputDirectory: string): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(Object.entries(contextPackage.files).map(([name, content]) => writeFile(join(outputDirectory, name), content, "utf8")));
}
