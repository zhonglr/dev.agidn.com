import { validateDocument } from "@agidn/rule-engine";
import { loadFoundationProject } from "../helpers.js";

describe("Foundation Page", () => {
  it("passes schema, component, token, layout and accessibility rules", async () => {
    const project = await loadFoundationProject();
    const result = validateDocument(project.document, project);

    expect(result).toEqual({ valid: true, violations: [] });
    expect(Object.keys(project.primitiveComponents.components)).toHaveLength(9);
  });

  it("rejects unknown actions and invalid action arguments", async () => {
    const project = await loadFoundationProject();
    const document = structuredClone(project.document);
    const source = JSON.stringify(document);
    const unknownAction = JSON.parse(source.replace("navigation.openPage", "navigation.missing")) as typeof document;
    expect(validateDocument(unknownAction, project).violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "UNKNOWN_ACTION" })])
    );
    const invalidArgument = JSON.parse(source.replace('"route":"/"', '"route":42')) as typeof document;
    expect(validateDocument(invalidArgument, project).violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "INVALID_ACTION_ARGUMENT" })])
    );
  });
});
