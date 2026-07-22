import { validateDocument } from "@agidn/rule-engine";
import { loadGoldenProject } from "../helpers.js";

describe("Golden Pricing Page", () => {
  it("passes schema, component, token, layout and accessibility rules", async () => {
    const project = await loadGoldenProject();
    const result = validateDocument(project.document, project);

    expect(result).toEqual({ valid: true, violations: [] });
    expect(Object.keys(project.components.components)).toHaveLength(15);
  });

  it("rejects unknown actions and invalid action arguments", async () => {
    const project = await loadGoldenProject();
    const document = structuredClone(project.document);
    const pricingSection = document.children[2];
    if (pricingSection?.kind !== "layout") throw new Error("Golden pricing section is missing.");
    const source = JSON.stringify(pricingSection);

    const unknownAction = JSON.parse(source.replace("billing.selectPlan", "billing.missing")) as typeof pricingSection;
    document.children[2] = unknownAction;
    expect(validateDocument(document, project).violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "UNKNOWN_ACTION" })])
    );

    const invalidArgument = JSON.parse(source.replace('"planId":"starter"', '"planId":42')) as typeof pricingSection;
    document.children[2] = invalidArgument;
    expect(validateDocument(document, project).violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "INVALID_ACTION_ARGUMENT" })])
    );
  });
});
