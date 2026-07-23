import { readFile } from "node:fs/promises";

describe("Preview layout drop targets", () => {
  it("keeps layout nodes tall enough to receive inserted children", async () => {
    const styles = await readFile("apps/preview-host/src/styles.css", "utf8");

    expect(styles).toMatch(/\.agidn-layout \{[\s\S]*?min-height: 72px;/);
    expect(styles).toContain(".ui-container,");
    expect(styles).toContain(".ui-grid:empty");
    expect(styles).toMatch(/\.agidn-layout:empty,[\s\S]*?min-height: 96px;/);
  });
});
