import { tooltipDelay } from "@agidn/studio-workbench";

describe("Studio tooltip timing", () => {
  it("uses a predictable first-hover delay and a short grace-period delay", () => {
    expect(tooltipDelay(Number.NEGATIVE_INFINITY, 1000)).toBe(300);
    expect(tooltipDelay(700, 1000)).toBe(80);
    expect(tooltipDelay(499, 1000)).toBe(300);
  });
});
