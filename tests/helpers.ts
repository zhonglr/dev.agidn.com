import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ComponentRegistry } from "@agidn/component-registry";
import type { ActionRegistry } from "@agidn/context-exporter";
import type { TokenRegistry } from "@agidn/design-tokens";
import { parseDocument } from "@agidn/document-codec";
import {
  composeProjectComponentRegistry,
  type ProjectAssetRegistry
} from "@agidn/project-assets";

const foundationDirectory = resolve("examples/foundation");

async function json<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(resolve(foundationDirectory, file), "utf8")) as T;
}

export async function loadFoundationProject() {
  const [documentSource, components, tokens, policies, actions, constraints, assets] = await Promise.all([
    readFile(resolve(foundationDirectory, "page.ui.json"), "utf8"),
    json<ComponentRegistry>("components.json"),
    json<TokenRegistry>("tokens.json"),
    json<unknown>("policies.json"),
    json<ActionRegistry>("interactions.json"),
    json<unknown>("constraints.json"),
    json<ProjectAssetRegistry>("assets.json")
  ]);
  return {
    document: parseDocument(documentSource),
    primitiveComponents: components,
    components: composeProjectComponentRegistry(components, assets),
    tokens,
    policies,
    actions,
    constraints,
    assets
  };
}
