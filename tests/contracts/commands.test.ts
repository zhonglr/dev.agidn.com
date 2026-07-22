import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyCommand, type DocumentCommand } from "@agidn/command-engine";
import { findNode } from "@agidn/document-schema";
import { loadGoldenProject } from "../helpers.js";

describe("Command → Rule Engine → Patch", () => {
  it("accepts a legal insert and emits a node-based patch", async () => {
    const project = await loadGoldenProject();
    const command = JSON.parse(await readFile(resolve("examples/golden-pricing/commands/add-card.json"), "utf8")) as DocumentCommand;
    const result = applyCommand(project.document, command, project);

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.patch).toEqual({
      protocolVersion: "1.0.0",
      commandId: "cmd_add_enterprise_card",
      operations: [{ op: "node.insert", nodeId: "pricing_card_enterprise", targetParentId: "grid_plans" }]
    });
    expect(findNode(result.document, "pricing_card_enterprise")).toBeDefined();
    expect(findNode(project.document, "pricing_card_enterprise")).toBeUndefined();
  });
});
