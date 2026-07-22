import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ComponentRegistry } from "@agidn/component-registry";
import type { ActionRegistry } from "@agidn/context-exporter";
import type { TokenRegistry } from "@agidn/design-tokens";
import { parseDocument } from "@agidn/document-codec";
import type { PageDocument } from "@agidn/document-schema";
import {
  ActionRegistrySchema,
  checkProjectConfig,
  ComponentRegistrySchema,
  ConstraintRegistrySchema,
  PolicyRegistrySchema,
  TokenRegistrySchema,
  type ProjectConfigIssue
} from "./project-config-schema.js";

export interface WorkspaceProject {
  documentPath: string;
  document: PageDocument;
  components: ComponentRegistry;
  tokens: TokenRegistry;
  policies: unknown;
  actions: ActionRegistry;
  constraints: unknown;
}

export class InvalidWorkspaceConfigError extends Error {
  constructor(readonly path: string, readonly issues: ProjectConfigIssue[]) {
    super(`Invalid workspace config '${path}': ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
  }
}

async function readJson<T>(path: string, schema: Parameters<typeof checkProjectConfig>[0]): Promise<T> {
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  const issues = checkProjectConfig(schema, value);
  if (issues.length > 0) throw new InvalidWorkspaceConfigError(path, issues);
  return value as T;
}

export async function loadWorkspaceProject(documentPath: string): Promise<WorkspaceProject> {
  const absoluteDocumentPath = resolve(documentPath);
  const directory = dirname(absoluteDocumentPath);
  const [documentSource, components, tokens, policies, actions, constraints] = await Promise.all([
    readFile(absoluteDocumentPath, "utf8"),
    readJson<ComponentRegistry>(join(directory, "components.json"), ComponentRegistrySchema),
    readJson<TokenRegistry>(join(directory, "tokens.json"), TokenRegistrySchema),
    readJson<unknown>(join(directory, "policies.json"), PolicyRegistrySchema),
    readJson<ActionRegistry>(join(directory, "interactions.json"), ActionRegistrySchema),
    readJson<unknown>(join(directory, "constraints.json"), ConstraintRegistrySchema)
  ]);
  return {
    documentPath: absoluteDocumentPath,
    document: parseDocument(documentSource),
    components,
    tokens,
    policies,
    actions,
    constraints
  };
}
