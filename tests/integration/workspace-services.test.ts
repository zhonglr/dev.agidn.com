import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createWorkspaceServerApplication } from "../../apps/workspace-server/src/composition-root.js";

describe("Workspace application services", () => {
  it("exports a requested formal Revision reproducibly to the configured directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agidn-workspace-services-"));
    const revisionStatePath = join(directory, "revision-state.json");
    const contextOutputDirectory = join(directory, "context");

    try {
      const application = await createWorkspaceServerApplication(resolve("examples/golden-pricing/page.ui.json"), {
        revisionStatePath,
        contextOutputDirectory,
        clock: () => new Date("2026-07-22T02:00:00.000Z")
      });
      await application.documentService.commit({
        protocolVersion: "1.0.0",
        baseRevision: 0,
        commands: [{
          commandId: "cmd_export_revision",
          protocolVersion: "1.0.0",
          type: "node.setRole",
          nodeId: "text_hero",
          role: "exported-summary"
        }]
      });

      const initialExport = await application.exportService.exportContext({ protocolVersion: "1.0.0", revision: 0 });
      expect(initialExport).toMatchObject({ ok: true, revision: 0, outputDirectory: contextOutputDirectory });
      expect(await readFile(join(contextOutputDirectory, "document.json"), "utf8")).not.toContain("exported-summary");

      const currentExport = await application.exportService.exportContext({ protocolVersion: "1.0.0", revision: 1 });
      expect(currentExport).toMatchObject({ ok: true, revision: 1, outputDirectory: contextOutputDirectory });
      expect(await readFile(join(contextOutputDirectory, "document.json"), "utf8")).toContain("exported-summary");

      const repeatedExport = await application.exportService.exportContext({ protocolVersion: "1.0.0", revision: 1 });
      expect(repeatedExport).toMatchObject({
        ok: true,
        revision: 1,
        manifest: { contentHash: currentExport.ok ? currentExport.manifest.contentHash : "unreachable" }
      });

      await Promise.all([
        application.exportService.exportContext({ protocolVersion: "1.0.0", revision: 0 }),
        application.exportService.exportContext({ protocolVersion: "1.0.0", revision: 1 })
      ]);
      expect(await readFile(join(contextOutputDirectory, "document.json"), "utf8")).toContain("exported-summary");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
