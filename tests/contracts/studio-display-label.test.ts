import { displayLabel, humanizeIdentifier } from "../../apps/studio/src/display-label.js";

describe("Studio display labels", () => {
  it("never exposes camel-case parameter identifiers as the visible fallback", () => {
    expect(humanizeIdentifier("iconOnly")).toBe("Icon Only");
    expect(humanizeIdentifier("surfaceColor")).toBe("Surface Color");
  });

  it("selects configured localized labels with a stable English fallback", () => {
    const label = { "en-US": "Leading icon", "zh-CN": "前置图标" };
    expect(displayLabel(label, "leading", "zh-CN")).toBe("前置图标");
    expect(displayLabel(label, "leading", "en-US")).toBe("Leading icon");
    expect(displayLabel(undefined, "planName", "en-US")).toBe("Plan Name");
  });
});
