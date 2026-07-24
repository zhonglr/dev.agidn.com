import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { InvalidWorkspaceConfigError, loadWorkspaceProject } from "../../apps/workspace-server/src/infrastructure/filesystem/project-loader.js";

const foundationDirectory = resolve("examples/foundation");

describe("Workspace project loader", () => {
  it("loads a fully validated workspace project", async () => {
    const project = await loadWorkspaceProject(join(foundationDirectory, "page.ui.json"));
    expect(project.document.id).toBe("page_foundation");
    expect(Object.keys(project.primitiveComponents.components)).toHaveLength(9);
    expect(Object.keys(project.components.components)).toHaveLength(10);
    expect(project.components.components["project.foundation-callout"]).toMatchObject({
      category: "composite",
      source: "project:project.foundation-callout"
    });
    expect(Object.keys(project.assets.composites)).toEqual(["project.foundation-callout"]);
    expect(Object.keys(project.assets.patterns)).toEqual(["project.two-column-copy"]);
  });

  it.each([
    ["components.json", (value: Record<string, unknown>) => ({ ...value, schemaVersion: "1.0.0" })],
    ["components.json", (value: Record<string, unknown>) => ({ ...value, unexpected: true })],
    ["tokens.json", (value: Record<string, unknown>) => ({ ...value, tokens: { broken: { type: "pixels", value: 16 } } })],
    ["interactions.json", (value: Record<string, unknown>) => ({ ...value, actions: { broken: { name: "Broken", description: "", arguments: { id: "object" } } } })],
    ["policies.json", (value: Record<string, unknown>) => ({ ...value, maxLayoutDepth: 0 })],
    ["constraints.json", (value: Record<string, unknown>) => ({ ...value, constraints: [{ code: "TEST", description: "Test" }] })],
    ["assets.json", (value: Record<string, unknown>) => ({ ...value, schemaVersion: "1.0.0" })]
  ])("rejects malformed %s before creating the workspace", async (fileName, mutate) => {
    const directory = await mkdtemp(join(tmpdir(), "agidn-project-loader-"));
    try {
      await cp(foundationDirectory, directory, { recursive: true });
      const path = join(directory, fileName);
      const original = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      await writeFile(path, JSON.stringify(mutate(original)), "utf8");
      await expect(loadWorkspaceProject(join(directory, "page.ui.json"))).rejects.toBeInstanceOf(InvalidWorkspaceConfigError);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
