import { rankItems, scoreMatch } from "../../apps/studio/src/palette-ranking.js";

interface Item {
  id: string;
  title: string;
  category?: string;
}

const items: Item[] = [
  { id: "palette", title: "Show Command Palette", category: "Workbench" },
  { id: "export", title: "Export Current Revision", category: "Document" },
  { id: "reset", title: "Reset Workbench Layout", category: "Workbench" },
  { id: "theme", title: "Color Theme: Dark", category: "Preferences" }
];

describe("scoreMatch", () => {
  it("returns undefined when the query is not a subsequence", () => {
    expect(scoreMatch("xyz", "Show Command Palette")).toBeUndefined();
  });

  it("prefers substring over scattered subsequence matches", () => {
    const substring = scoreMatch("palette", "Show Command Palette")!;
    const scattered = scoreMatch("palette", "P a l e t t e scattered")!;
    expect(substring).toBeGreaterThan(scattered);
  });

  it("prefers matches at word boundaries and earlier positions", () => {
    expect(scoreMatch("command", "Show Command Palette")).toBeGreaterThan(
      scoreMatch("command", "Recommanded Settings")!
    );
  });
});

describe("rankItems", () => {
  it("ranks relevant items first and filters non-matches", () => {
    const ranked = rankItems(items, "palette");
    expect(ranked[0]?.id).toBe("palette");
    expect(ranked.map(({ id }) => id)).not.toContain("theme");
  });

  it("matches against category and title combined", () => {
    const ranked = rankItems(items, "workbench layout");
    expect(ranked[0]?.id).toBe("reset");
  });

  it("boosts recently used items", () => {
    const ranked = rankItems(items, "workbench", ["palette"]);
    expect(ranked[0]?.id).toBe("palette");
  });

  it("keeps everything for an empty query", () => {
    expect(rankItems(items, "")).toHaveLength(items.length);
  });
});
