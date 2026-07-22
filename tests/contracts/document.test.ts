import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseDocument, serializeDocument } from "@agidn/document-codec";
import { checkPageDocument } from "@agidn/document-schema";

describe("PageDocument contract", () => {
  it("round-trips the Golden Pricing Page deterministically", async () => {
    const source = await readFile(resolve("examples/golden-pricing/page.ui.json"), "utf8");
    const first = parseDocument(source);
    const serialized = serializeDocument(first);
    const second = parseDocument(serialized);

    expect(second).toEqual(first);
    expect(serializeDocument(second)).toBe(serialized);
  });

  it("does not express arbitrary fields in the schema", async () => {
    const source = await readFile(resolve("examples/golden-pricing/page.ui.json"), "utf8");
    const document = JSON.parse(source) as Record<string, unknown>;
    document.style = { position: "absolute" };

    const result = checkPageDocument(document);
    expect(result.valid).toBe(false);
  });
});
