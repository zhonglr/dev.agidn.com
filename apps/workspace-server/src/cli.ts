#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { applyCommand, type DocumentCommand } from "@agidn/command-engine";
import { createContextPackage, writeContextPackage } from "@agidn/context-exporter";
import { serializeDocument } from "@agidn/document-codec";
import { validateDocument } from "@agidn/rule-engine";
import { loadWorkspaceProject } from "./infrastructure/filesystem/project-loader.js";

function printViolations(violations: readonly { code: string; nodeId?: string | undefined; message: string }[]): void {
  for (const issue of violations) console.error(`${issue.code}${issue.nodeId ? ` [${issue.nodeId}]` : ""}: ${issue.message}`);
}

async function main(): Promise<void> {
  const [command, fileArgument, extraArgument] = process.argv.slice(2);
  if (!command || !fileArgument || !["validate", "apply", "export"].includes(command)) {
    console.error("Usage: pnpm ui <validate|apply|export> <page.ui.json> [command.json|output-directory]");
    process.exitCode = 2;
    return;
  }
  const documentPath = resolve(fileArgument);
  const project = await loadWorkspaceProject(documentPath);
  const context = { components: project.components, tokens: project.tokens, actions: project.actions };

  if (command === "validate") {
    const result = validateDocument(project.document, context);
    if (!result.valid) {
      printViolations(result.violations);
      process.exitCode = 1;
      return;
    }
    console.log(`Valid PageDocument ${project.document.id} (${project.document.schemaVersion})`);
    return;
  }

  if (command === "apply") {
    if (!extraArgument) throw new Error("apply requires a command JSON path");
    const documentCommand = JSON.parse(await readFile(resolve(extraArgument), "utf8")) as DocumentCommand;
    const result = applyCommand(project.document, documentCommand, context);
    if (!result.accepted) {
      printViolations(result.violations);
      process.exitCode = 1;
      return;
    }
    console.log(serializeDocument(result.document));
    console.error(`Applied ${result.patch.commandId}: ${result.patch.operations.length} patch operation(s)`);
    return;
  }

  const outputDirectory = resolve(extraArgument ?? join(dirname(documentPath), ".ui-context"));
  const contextPackage = createContextPackage(project);
  await writeContextPackage(contextPackage, outputDirectory);
  console.log(`Exported ${Object.keys(contextPackage.files).length} files to ${outputDirectory}`);
  console.log(`Content hash: ${contextPackage.manifest.contentHash}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
