import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { findNode } from "@agidn/document-schema";
import type { RevisionStoreState } from "@agidn/document-engine";
import { PersistentRevisionStore } from "../../apps/workspace-server/src/application/persistent-revision-store.js";
import type { RevisionStatePersistencePort } from "../../apps/workspace-server/src/application/ports/revision-state-persistence.js";
import { createWorkspaceServerApplication } from "../../apps/workspace-server/src/composition-root.js";
import { loadGoldenProject } from "../helpers.js";

const roleCommand = {
  commandId: "cmd_persisted_role",
  protocolVersion: "1.0.0",
  type: "node.setRole",
  nodeId: "text_hero",
  role: "persisted-summary"
} as const;

describe("Revision Store persistence", () => {
  it("restores revisions, history, command identities and navigation after restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agidn-revision-store-"));
    const statePath = join(directory, "pricing.revisions.json");
    const documentPath = resolve("examples/golden-pricing/page.ui.json");

    try {
      const first = await createWorkspaceServerApplication(documentPath, {
        revisionStatePath: statePath,
        clock: () => new Date("2026-07-22T01:00:00.000Z")
      });
      const committed = await first.documentService.commit({
        protocolVersion: "1.0.0",
        baseRevision: 0,
        commands: [roleCommand]
      });
      expect(committed).toMatchObject({ ok: true, revision: { revision: 1 } });

      const undone = await first.documentService.undo({ protocolVersion: "1.0.0", baseRevision: 1 });
      expect(undone).toMatchObject({ ok: true, revision: { revision: 2 } });

      const second = await createWorkspaceServerApplication(documentPath, { revisionStatePath: statePath });
      expect(second.documentService.getCurrent()).toMatchObject({ ok: true, revision: { revision: 2 } });

      const redone = await second.documentService.redo({ protocolVersion: "1.0.0", baseRevision: 2 });
      expect(redone).toMatchObject({ ok: true, revision: { revision: 3 } });
      if (!redone.ok) return;
      expect(findNode(redone.revision.document, "text_hero")).toMatchObject({ role: "persisted-summary" });

      const replayed = await second.documentService.commit({
        protocolVersion: "1.0.0",
        baseRevision: 3,
        commands: [roleCommand]
      });
      expect(replayed).toMatchObject({ ok: false, error: "DUPLICATE_COMMAND", currentRevision: 3 });

      const restored = await second.documentService.restore({ protocolVersion: "1.0.0", baseRevision: 3, targetRevision: 0 });
      expect(restored).toMatchObject({ ok: true, revision: { revision: 4 } });
      if (!restored.ok) return;
      expect(findNode(restored.revision.document, "text_hero")).not.toMatchObject({ role: "persisted-summary" });

      const third = await createWorkspaceServerApplication(documentPath, { revisionStatePath: statePath });
      expect(third.documentService.getCurrent()).toMatchObject({ ok: true, revision: { revision: 4 } });
      expect(third.historyService.getHistory().entries.at(-1)).toMatchObject({ kind: "restore", targetRevision: 0 });

      const persisted = JSON.parse(await readFile(statePath, "utf8")) as { formatVersion?: unknown; revisions?: unknown[]; history?: unknown[] };
      expect(persisted).toMatchObject({ formatVersion: "1.0.0" });
      expect(persisted.revisions).toHaveLength(5);
      expect(persisted.history).toHaveLength(4);
      expect((await readdir(directory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not publish a candidate revision when persistence fails", async () => {
    const project = await loadGoldenProject();
    let rejectSaves = false;
    const persistence: RevisionStatePersistencePort = {
      load: async () => undefined,
      save: async () => {
        if (rejectSaves) throw new Error("simulated disk failure");
      }
    };
    const store = await PersistentRevisionStore.create(project.document, project, persistence);
    rejectSaves = true;

    await expect(store.commit({ baseRevision: 0, commands: [roleCommand] })).rejects.toThrow("simulated disk failure");
    expect(store.getCurrent().revision).toBe(0);
    expect(findNode(store.getCurrent().document, "text_hero")).not.toMatchObject({ role: "persisted-summary" });
  });

  it("serializes concurrent writes before checking baseRevision", async () => {
    const project = await loadGoldenProject();
    let saved: RevisionStoreState | undefined;
    const persistence: RevisionStatePersistencePort = {
      load: async () => undefined,
      save: async (state) => {
        await Promise.resolve();
        saved = structuredClone(state);
      }
    };
    const store = await PersistentRevisionStore.create(project.document, project, persistence);

    const [first, second] = await Promise.all([
      store.commit({ baseRevision: 0, commands: [roleCommand] }),
      store.commit({
        baseRevision: 0,
        commands: [{ ...roleCommand, commandId: "cmd_concurrent_role", role: "concurrent-summary" }]
      })
    ]);

    expect(first).toMatchObject({ accepted: true, revision: { revision: 1 } });
    expect(second).toEqual({ accepted: false, reason: "REVISION_CONFLICT", currentRevision: 1 });
    expect(store.getCurrent().revision).toBe(1);
    expect(saved?.revisions).toHaveLength(2);
  });
});
