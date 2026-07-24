import { renderToStaticMarkup } from "react-dom/server";
import type { TokenRegistry } from "@agidn/design-tokens";
import { checkPageDocument, findNode, type PageDocument } from "@agidn/document-schema";
import type { ProjectAssetRegistry } from "@agidn/project-assets";
import { PageRenderer } from "@agidn/react-renderer";
import assetSource from "../../examples/foundation/assets.json" with { type: "json" };
import pageSource from "../../examples/foundation/page.ui.json" with { type: "json" };
import tokenSource from "../../examples/foundation/tokens.json" with { type: "json" };
import { canvasComponentRegistry } from "../../apps/studio/src/canvas/runtime-components.js";

describe("React Renderer", () => {
  it("renders the Foundation Page through registered React components", () => {
    const checked = checkPageDocument(pageSource);
    if (!checked.valid) throw new Error("Foundation Page must be valid.");

    const html = renderToStaticMarkup(
      <PageRenderer document={checked.document} tokens={tokenSource as TokenRegistry} components={canvasComponentRegistry} />
    );

    expect(html).toContain("Start with stable foundations");
    expect(html).toContain("Continue");
    expect(html).toContain('data-document-id="page_foundation"');
    expect(html).toContain('data-node-id="heading_foundation"');
    expect(html).toContain('data-component-ref="Heading"');
    expect(html).not.toContain("Missing component:");
  });

  it("renders public placement, visibility, role, accessibility and interaction metadata", () => {
    const checked = checkPageDocument(pageSource);
    if (!checked.valid) throw new Error("Foundation Page must be valid.");
    const document = structuredClone(checked.document);
    const card = findNode(document, "card_foundation");
    if (card?.kind !== "component") throw new Error("Card fixture is missing.");
    const action = card.slots?.content?.[0];
    if (action?.kind !== "component") throw new Error("Button fixture is missing.");
    action.role = "primary-action";
    action.placement = { width: "fill", grow: true };
    action.visibility = { mobile: false };
    action.accessibility = { label: "Continue to the home page" };

    const html = renderToStaticMarkup(
      <PageRenderer
        document={document}
        tokens={tokenSource as TokenRegistry}
        components={canvasComponentRegistry}
      />
    );

    expect(html).toContain('data-role="primary-action"');
    expect(html).toContain('data-visible-mobile="false"');
    expect(html).toContain('aria-label="Continue to the home page"');
    expect(html).toContain("width:100%");
    expect(html).toContain("flex-grow:1");
  });

  it("renders a Composite through its public props with one selectable instance boundary", () => {
    const document: PageDocument = {
      schemaVersion: "2.0.0",
      id: "page_composite",
      kind: "page",
      name: "Composite",
      role: "page",
      children: [
        {
          id: "callout_instance",
          kind: "component",
          componentRef: "project.foundation-callout",
          variant: "default",
          props: {
            title: "Bound title",
            body: "Bound body"
          }
        }
      ]
    };
    const assets = assetSource as ProjectAssetRegistry;
    const html = renderToStaticMarkup(
      <PageRenderer
        document={document}
        tokens={tokenSource as TokenRegistry}
        components={canvasComponentRegistry}
        composites={assets.composites}
      />
    );

    expect(html).toContain("Bound title");
    expect(html).toContain("Bound body");
    expect(html).toContain('data-node-id="callout_instance"');
    expect(html).toContain('data-component-ref="project.foundation-callout"');
    expect(html).not.toContain('data-node-id="callout_instance:callout_title"');
    expect(html).not.toContain("Missing component:");
  });
});
