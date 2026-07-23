import { readFile } from "node:fs/promises";

describe("Studio development runtime", () => {
  it("restarts the workspace server when HTTP routes change", async () => {
    const packageJson = JSON.parse(await readFile("apps/workspace-server/package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.dev).toContain("tsx watch src/server.ts");
  });
});
