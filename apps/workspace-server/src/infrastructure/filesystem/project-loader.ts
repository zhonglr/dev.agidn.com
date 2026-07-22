import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ComponentRegistry } from "@agidn/component-registry";
import type { ActionRegistry } from "@agidn/context-exporter";
import type { TokenRegistry } from "@agidn/design-tokens";
import { parseDocument } from "@agidn/document-codec";
import type { PageDocument } from "@agidn/document-schema";

export interface WorkspaceProject {
  documentPath: string;
  document: PageDocument;
  components: ComponentRegistry;
  tokens: TokenRegistry;
  policies: unknown;
  actions: ActionRegistry;
  constraints: unknown;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function loadWorkspaceProject(documentPath: string): Promise<WorkspaceProject> {
  const absoluteDocumentPath = resolve(documentPath);
  const directory = dirname(absoluteDocumentPath);
  const [documentSource, components, tokens, policies, actions, constraints] = await Promise.all([
    readFile(absoluteDocumentPath, "utf8"),
    readJson<ComponentRegistry>(join(directory, "components.json")),
    readJson<TokenRegistry>(join(directory, "tokens.json")),
    readJson<unknown>(join(directory, "policies.json")),
    readJson<ActionRegistry>(join(directory, "interactions.json")),
    readJson<unknown>(join(directory, "constraints.json"))
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
