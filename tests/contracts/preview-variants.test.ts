import { readFile } from "node:fs/promises";
import componentSource from "../../examples/golden-pricing/components.json" with { type: "json" };

const classNames: Record<string, string> = {
  Button: "button", Link: "link", Heading: "heading", Text: "text", Image: "image-frame",
  Icon: "icon", Badge: "badge", Card: "card", Navigation: "navigation", PricingCard: "pricing-card"
};

describe("Preview variant visual coverage", () => {
  it("defines a modifier selector for every user-selectable non-default variant", async () => {
    const css = await readFile(new URL("../../apps/preview-host/src/styles.css", import.meta.url), "utf8");
    const missing: string[] = [];
    for (const [componentName, definition] of Object.entries(componentSource.components)) {
      const className = classNames[componentName];
      if (!className) continue;
      for (const variant of definition.variants) {
        if (!css.includes(`.ui-${className}--${variant}`)) missing.push(`${componentName}.${variant}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
