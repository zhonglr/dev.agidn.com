import { readFile } from "node:fs/promises";

describe("Canvas layout drop targets", () => {
  it("keeps layout nodes tall enough to receive inserted children", async () => {
    const styles = await readFile("apps/studio/src/canvas/canvas-content.css", "utf8");

    expect(styles).toMatch(/\.agidn-layout \{[\s\S]*?min-height: 72px;/);
    expect(styles).toMatch(/\.agidn-layout:empty \{[\s\S]*?min-height: 96px;/);
  });
});
