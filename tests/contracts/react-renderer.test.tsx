import { renderToStaticMarkup } from "react-dom/server";
import type { TokenRegistry } from "@agidn/design-tokens";
import { checkPageDocument } from "@agidn/document-schema";
import { PageRenderer } from "@agidn/react-renderer";
import pageSource from "../../examples/golden-pricing/page.ui.json" with { type: "json" };
import tokenSource from "../../examples/golden-pricing/tokens.json" with { type: "json" };
import { previewComponentRegistry } from "../../apps/preview-host/src/components.js";

describe("React Renderer", () => {
  it("renders the Golden Pricing Page through registered React components", () => {
    const checked = checkPageDocument(pageSource);
    if (!checked.valid) throw new Error("Golden Page must be valid.");

    const html = renderToStaticMarkup(
      <PageRenderer document={checked.document} tokens={tokenSource as TokenRegistry} components={previewComponentRegistry} />
    );

    expect(html).toContain("Simple pricing that scales with you");
    expect(html).toContain("Choose Pro");
    expect(html).toContain('data-document-id="page_pricing"');
    expect(html).not.toContain("Missing component:");
  });
});
