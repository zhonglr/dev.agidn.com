import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ComponentRegistry } from "@agidn/component-registry";
import type { ActionRegistry } from "@agidn/context-exporter";
import type { TokenRegistry } from "@agidn/design-tokens";
import { parseDocument } from "@agidn/document-codec";

const goldenDirectory = resolve("examples/golden-pricing");

async function json<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(resolve(goldenDirectory, file), "utf8")) as T;
}

export async function loadGoldenProject() {
  const [documentSource, components, tokens, policies, actions, constraints] = await Promise.all([
    readFile(resolve(goldenDirectory, "page.ui.json"), "utf8"),
    json<ComponentRegistry>("components.json"),
    json<TokenRegistry>("tokens.json"),
    json<unknown>("policies.json"),
    json<ActionRegistry>("interactions.json"),
    json<unknown>("constraints.json")
  ]);
  return { document: parseDocument(documentSource), components, tokens, policies, actions, constraints };
}
