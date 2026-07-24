import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseDocument, serializeDocument } from "@agidn/document-codec";
import { checkPageDocument } from "@agidn/document-schema";

describe("PageDocument contract", () => {
  it("round-trips the Foundation Page deterministically", async () => {
    const source = await readFile(resolve("examples/foundation/page.ui.json"), "utf8");
    const first = parseDocument(source);
    const serialized = serializeDocument(first);
    const second = parseDocument(serialized);

    expect(second).toEqual(first);
    expect(serializeDocument(second)).toBe(serialized);
  });

  it("does not express arbitrary fields in the schema", async () => {
    const source = await readFile(resolve("examples/foundation/page.ui.json"), "utf8");
    const document = JSON.parse(source) as Record<string, unknown>;
    document.style = { position: "absolute" };

    const result = checkPageDocument(document);
    expect(result.valid).toBe(false);
  });

  it("rejects V1 documents and removed component fields", async () => {
    const source = await readFile(resolve("examples/foundation/page.ui.json"), "utf8");
    const document = JSON.parse(source) as Record<string, unknown> & { schemaVersion: string };
    document.schemaVersion = "1.0.0";
    expect(checkPageDocument(document).valid).toBe(false);

    document.schemaVersion = "2.0.0";
    const findComponent = (value: unknown): Record<string, unknown> | undefined => {
      if (!value || typeof value !== "object") return undefined;
      const object = value as Record<string, unknown>;
      if (object.kind === "component") return object;
      for (const entry of Object.values(object)) {
        const found = Array.isArray(entry)
          ? entry.map(findComponent).find(Boolean)
          : findComponent(entry);
        if (found) return found;
      }
      return undefined;
    };
    const component = findComponent(document);
    if (!component) throw new Error("Foundation component is missing.");
    component.state = "default";
    component.tokens = { textColor: "color.text.default" };
    expect(checkPageDocument(document).valid).toBe(false);
  });
});
