import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { InvalidWorkspaceConfigError, loadWorkspaceProject } from "../../apps/workspace-server/src/infrastructure/filesystem/project-loader.js";

const goldenDirectory = resolve("examples/golden-pricing");

describe("Workspace project loader", () => {
  it("loads a fully validated workspace project", async () => {
    const project = await loadWorkspaceProject(join(goldenDirectory, "page.ui.json"));
    expect(project.document.id).toBe("page_pricing");
    expect(Object.keys(project.components.components)).toHaveLength(15);
  });

  it.each([
    ["components.json", (value: Record<string, unknown>) => ({ ...value, unexpected: true })],
    ["tokens.json", (value: Record<string, unknown>) => ({ ...value, tokens: { broken: { type: "pixels", value: 16 } } })],
    ["interactions.json", (value: Record<string, unknown>) => ({ ...value, actions: { broken: { name: "Broken", description: "", arguments: { id: "object" } } } })],
    ["policies.json", (value: Record<string, unknown>) => ({ ...value, maxLayoutDepth: 0 })],
    ["constraints.json", (value: Record<string, unknown>) => ({ ...value, constraints: [{ code: "TEST", description: "Test" }] })]
  ])("rejects malformed %s before creating the workspace", async (fileName, mutate) => {
    const directory = await mkdtemp(join(tmpdir(), "agidn-project-loader-"));
    try {
      await cp(goldenDirectory, directory, { recursive: true });
      const path = join(directory, fileName);
      const original = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      await writeFile(path, JSON.stringify(mutate(original)), "utf8");
      await expect(loadWorkspaceProject(join(directory, "page.ui.json"))).rejects.toBeInstanceOf(InvalidWorkspaceConfigError);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
