import { readFile } from "node:fs/promises";

describe("Studio UI loading boundaries", () => {
  it("keeps low-frequency surfaces behind dynamic imports and mounts the application provider", async () => {
    const source = await readFile("apps/studio/src/App.tsx", "utf8");

    expect(source).toContain('const loadCommandPalette = () => import("./CommandPalette.js")');
    expect(source).toContain('const loadExportDialog = () => import("./components/studio/export-dialog.js")');
    expect(source).toContain('const loadSettingsDialog = () => import("./components/studio/settings-dialog.js")');
    expect(source).toContain("lazy(loadCommandPalette)");
    expect(source).toContain("onHoverStart={() => void loadSettingsDialog()}");
    expect(source).toContain("<StudioUiProvider");
    expect(source).not.toMatch(/from ["']\.\/CommandPalette\.js["']/);
  });

  it("provides Spectrum context inside every lazy UI surface", async () => {
    const files = [
      "apps/studio/src/CommandPalette.tsx",
      "apps/studio/src/components/studio/export-dialog.tsx",
      "apps/studio/src/components/studio/settings-dialog.tsx"
    ];
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));

    for (const source of sources) {
      expect(source).toContain("<StudioUiProvider");
      expect(source).toContain('boundary="overlay"');
    }
  });
});
