import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createWorkspaceServerApplication } from "../../apps/workspace-server/src/composition-root.js";

describe("Workspace application services", () => {
  it("exports requested Project Revisions reproducibly", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "agidn-workspace-services-")
    );
    const projectRevisionStatePath = join(
      directory,
      "project-revision-state.json"
    );
    const contextOutputDirectory = join(directory, "context");

    try {
      const application = await createWorkspaceServerApplication(
        resolve("examples/foundation/page.ui.json"),
        {
          projectRevisionStatePath,
          contextOutputDirectory,
          clock: () => new Date("2026-07-24T02:00:00.000Z")
        }
      );
      await application.projectService.commit({
        protocolVersion: "2.0.0",
        baseRevision: 0,
        commands: [
          {
            commandId: "cmd_export_project_revision",
            protocolVersion: "2.0.0",
            type: "node.setRole",
            nodeId: "text_foundation",
            role: "description"
          }
        ]
      });

      const initialExport =
        await application.exportService.exportContext({
          protocolVersion: "2.0.0",
          revision: 0
        });
      expect(initialExport).toMatchObject({
        ok: true,
        revision: 0,
        outputDirectory: contextOutputDirectory
      });
      expect(
        await readFile(
          join(contextOutputDirectory, "document.json"),
          "utf8"
        )
      ).not.toContain("\"role\": \"description\"");

      const currentExport =
        await application.exportService.exportContext({
          protocolVersion: "2.0.0",
          revision: 1
        });
      expect(currentExport).toMatchObject({
        ok: true,
        revision: 1,
        outputDirectory: contextOutputDirectory
      });
      expect(
        await readFile(
          join(contextOutputDirectory, "document.json"),
          "utf8"
        )
      ).toContain("\"role\": \"description\"");

      const repeatedExport =
        await application.exportService.exportContext({
          protocolVersion: "2.0.0",
          revision: 1
        });
      expect(repeatedExport).toMatchObject({
        ok: true,
        revision: 1,
        manifest: {
          contentHash: currentExport.ok
            ? currentExport.manifest.contentHash
            : "unreachable"
        }
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
