import { validateDocument } from "@agidn/rule-engine";
import { loadGoldenProject } from "../helpers.js";

describe("Golden Pricing Page", () => {
  it("passes schema, component, token, layout and accessibility rules", async () => {
    const project = await loadGoldenProject();
    const result = validateDocument(project.document, project);

    expect(result).toEqual({ valid: true, violations: [] });
    expect(Object.keys(project.components.components)).toHaveLength(15);
  });
});
