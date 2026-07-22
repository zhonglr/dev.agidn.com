import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyCommand, checkDocumentCommand } from "@agidn/command-engine";
import { loadGoldenProject } from "../helpers.js";

describe("Command runtime protocol", () => {
  it("accepts a known, strictly shaped command", async () => {
    const command = JSON.parse(await readFile(resolve("examples/golden-pricing/commands/add-card.json"), "utf8"));
    const result = checkDocumentCommand(command);

    expect(result.valid).toBe(true);
  });

  it.each([
    {
      commandId: "cmd_unknown_type",
      protocolVersion: "1.0.0",
      type: "node.setCss",
      nodeId: "grid_plans",
      value: "position:absolute"
    },
    {
      commandId: "cmd_extra_field",
      protocolVersion: "1.0.0",
      type: "node.setVariant",
      nodeId: "pricing_card_pro",
      variant: "default",
      directWrite: true
    },
    {
      commandId: "cmd_missing_field",
      protocolVersion: "1.0.0",
      type: "node.setProp",
      nodeId: "button_pro",
      property: "disabled"
    }
  ])("rejects unknown operations, extra fields and missing fields", (command) => {
    expect(checkDocumentCommand(command).valid).toBe(false);
  });

  it("returns a domain rejection without modifying the document", async () => {
    const project = await loadGoldenProject();
    const command = {
      commandId: "cmd_extra_runtime",
      protocolVersion: "1.0.0",
      type: "node.setVariant",
      nodeId: "pricing_card_pro",
      variant: "default",
      directWrite: true
    };

    const result = applyCommand(project.document, command, project);
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.violations[0]?.code).toBe("COMMAND_INVALID");
    expect(result.document).toEqual(project.document);
  });
});
