import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyCommand, type DocumentCommand } from "@agidn/command-engine";
import { findNode } from "@agidn/document-schema";
import { loadFoundationProject } from "../helpers.js";

describe("Command → Rule Engine → Patch", () => {
  it("accepts a legal insert and emits a node-based patch", async () => {
    const project = await loadFoundationProject();
    const command = JSON.parse(await readFile(resolve("examples/foundation/commands/insert-text.json"), "utf8")) as DocumentCommand;
    const result = applyCommand(project.document, command, project);

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.patch).toEqual({
      protocolVersion: "2.0.0",
      commandId: "insert_foundation_text",
      operations: [{ op: "node.insert", nodeId: "text_inserted", targetParentId: "stack_foundation" }]
    });
    expect(findNode(result.document, "text_inserted")).toBeDefined();
    expect(findNode(project.document, "text_inserted")).toBeUndefined();
  });
});
