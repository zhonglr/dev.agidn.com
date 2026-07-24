import {
  mkdtemp,
  readFile,
  readdir,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  InvalidRevisionStoreStateError,
  type ProjectRevisionStoreState
} from "@agidn/document-engine";
import { PersistentProjectRevisionStore } from "../../apps/workspace-server/src/application/persistent-project-revision-store.js";
import type { ProjectRevisionStatePersistencePort } from "../../apps/workspace-server/src/application/ports/project-revision-state-persistence.js";
import { AtomicJsonProjectRevisionStateFile } from "../../apps/workspace-server/src/infrastructure/filesystem/project-revision-state-file.js";
import { loadFoundationProject } from "../helpers.js";

function contextFor(
  project: Awaited<ReturnType<typeof loadFoundationProject>>
) {
  return {
    primitives: project.primitiveComponents,
    tokens: project.tokens,
    actions: project.actions
  };
}

describe("Project Revision Store persistence", () => {
  it("atomically restores assets, document, history and navigation", async () => {
    const project = await loadFoundationProject();
    const directory = await mkdtemp(
      join(tmpdir(), "agidn-project-revision-store-")
    );
    const statePath = join(
      directory,
      "foundation.project-revisions.json"
    );
    const persistence = new AtomicJsonProjectRevisionStateFile(
      statePath
    );
    const composite = structuredClone(
      project.assets.composites["project.foundation-callout"]!
    );
    composite.id = "project.persisted-callout";

    try {
      const first = await PersistentProjectRevisionStore.create(
        { document: project.document, assets: project.assets },
        contextFor(project),
        persistence,
        { clock: () => new Date("2026-07-24T05:00:00.000Z") }
      );
      const committed = await first.commit({
        baseRevision: 0,
        commands: [
          {
            protocolVersion: "2.0.0",
            commandId: "persist_project_asset",
            type: "asset.composite.upsert",
            asset: composite
          },
          {
            protocolVersion: "2.0.0",
            commandId: "persist_project_instance",
            type: "node.insert",
            targetParentId: "stack_foundation",
            node: {
              id: "persisted_callout_instance",
              kind: "component",
              componentRef: composite.id,
              props: {
                title: "Persisted",
                body: "One project revision"
              }
            }
          }
        ]
      });
      expect(committed).toMatchObject({
        accepted: true,
        revision: { revision: 1 }
      });
      const undone = await first.undo(1);
      expect(undone).toMatchObject({
        accepted: true,
        revision: { revision: 2 }
      });

      const second = await PersistentProjectRevisionStore.create(
        { document: project.document, assets: project.assets },
        contextFor(project),
        persistence
      );
      expect(second.getCurrent()).toEqual(first.getCurrent());
      expect(second.getHistory()).toEqual(first.getHistory());
      const redone = await second.redo(2);
      expect(redone).toMatchObject({
        accepted: true,
        revision: {
          revision: 3,
          project: {
            assets: {
              composites: {
                [composite.id]: { id: composite.id }
              }
            }
          }
        }
      });

      const state = JSON.parse(
        await readFile(statePath, "utf8")
      ) as ProjectRevisionStoreState;
      expect(state.formatVersion).toBe("3.0.0");
      expect(state.revisions).toHaveLength(4);
      expect(state.history).toHaveLength(3);
      expect(
        (await readdir(directory)).filter((name) =>
          name.endsWith(".tmp")
        )
      ).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not publish a project candidate when persistence fails", async () => {
    const project = await loadFoundationProject();
    let rejectSaves = false;
    const persistence: ProjectRevisionStatePersistencePort = {
      load: async () => undefined,
      save: async () => {
        if (rejectSaves) throw new Error("simulated disk failure");
      }
    };
    const store = await PersistentProjectRevisionStore.create(
      { document: project.document, assets: project.assets },
      contextFor(project),
      persistence
    );
    rejectSaves = true;

    await expect(
      store.commit({
        baseRevision: 0,
        commands: [
          {
            protocolVersion: "2.0.0",
            commandId: "asset_fails_to_persist",
            type: "asset.remove",
            assetType: "pattern",
            assetId: "project.two-column-copy"
          }
        ]
      })
    ).rejects.toThrow("simulated disk failure");
    expect(store.currentRevision).toBe(0);
    expect(
      store.getCurrent().project.assets.patterns[
        "project.two-column-copy"
      ]
    ).toBeDefined();
  });

  it("serializes concurrent project writes before conflict checks", async () => {
    const project = await loadFoundationProject();
    let saved: ProjectRevisionStoreState | undefined;
    const persistence: ProjectRevisionStatePersistencePort = {
      load: async () => undefined,
      save: async (state) => {
        await Promise.resolve();
        saved = structuredClone(state);
      }
    };
    const store = await PersistentProjectRevisionStore.create(
      { document: project.document, assets: project.assets },
      contextFor(project),
      persistence
    );
    const commands = ["First", "Second"].map((name, index) => ({
      baseRevision: 0,
      commands: [
        {
          protocolVersion: "2.0.0",
          commandId: `concurrent_project_${index}`,
          type: "node.setName",
          nodeId: "heading_foundation",
          name
        }
      ]
    }));

    const [first, second] = await Promise.all([
      store.commit(commands[0]!),
      store.commit(commands[1]!)
    ]);
    expect(first).toMatchObject({ accepted: true });
    expect(second).toEqual({
      accepted: false,
      reason: "REVISION_CONFLICT",
      currentRevision: 1
    });
    expect(saved?.revisions).toHaveLength(2);
  });

  it("rejects legacy document-only state instead of migrating it", async () => {
    const project = await loadFoundationProject();
    const persistence: ProjectRevisionStatePersistencePort = {
      load: async () => ({
        formatVersion: "2.0.0",
        revisions: [],
        history: [],
        undoStack: [],
        redoStack: []
      }),
      save: async () => undefined
    };
    await expect(
      PersistentProjectRevisionStore.create(
        { document: project.document, assets: project.assets },
        contextFor(project),
        persistence
      )
    ).rejects.toBeInstanceOf(InvalidRevisionStoreStateError);
  });
});
