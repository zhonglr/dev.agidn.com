import {
  InMemoryProjectRevisionStore,
  checkProjectRevisionStoreState
} from "@agidn/document-engine";
import { findNode } from "@agidn/document-schema";
import { loadFoundationProject } from "../helpers.js";

describe("Project Revision Store", () => {
  it("commits Document and Asset Commands as one atomic Revision", async () => {
    const project = await loadFoundationProject();
    const store = new InMemoryProjectRevisionStore(
      {
        document: project.document,
        assets: project.assets
      },
      {
        primitives: project.primitiveComponents,
        tokens: project.tokens,
        actions: project.actions
      }
    );
    const composite = structuredClone(
      project.assets.composites["project.foundation-callout"]!
    );
    composite.id = "project.transaction-callout";
    const result = store.commit({
      baseRevision: 0,
      commands: [
        {
          protocolVersion: "2.0.0",
          commandId: "asset_upsert_transaction_callout",
          type: "asset.composite.upsert",
          asset: composite
        },
        {
          protocolVersion: "2.0.0",
          commandId: "insert_transaction_callout",
          type: "node.insert",
          targetParentId: "stack_foundation",
          node: {
            id: "transaction_callout_instance",
            kind: "component",
            componentRef: composite.id,
            variant: "default",
            props: {
              title: "Transaction title",
              body: "Transaction body"
            }
          }
        }
      ]
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.revision.revision).toBe(1);
    expect(
      result.revision.project.assets.composites[composite.id]
    ).toBeDefined();
    expect(
      findNode(
        result.revision.project.document,
        "transaction_callout_instance"
      )
    ).toBeDefined();
    expect(result.patches.map(({ operations }) => operations[0]?.op)).toEqual([
      "asset.upsert",
      "node.insert"
    ]);
    expect(store.getHistory()[0]).toMatchObject({
      kind: "commit",
      revision: 1,
      commands: [
        { type: "asset.composite.upsert" },
        { type: "node.insert" }
      ]
    });
  });

  it("rolls back both sides when any command in the transaction fails", async () => {
    const project = await loadFoundationProject();
    const store = new InMemoryProjectRevisionStore(
      {
        document: project.document,
        assets: project.assets
      },
      {
        primitives: project.primitiveComponents,
        tokens: project.tokens,
        actions: project.actions
      }
    );
    const invalidPattern = structuredClone(
      project.assets.patterns["project.two-column-copy"]!
    );
    invalidPattern.id = "project.invalid-transaction";
    invalidPattern.nodes = [
      {
        id: "missing_component",
        kind: "component",
        componentRef: "Missing"
      }
    ];
    const result = store.commit({
      baseRevision: 0,
      commands: [
        {
          protocolVersion: "2.0.0",
          commandId: "rename_before_failure",
          type: "node.setName",
          nodeId: "heading_foundation",
          name: "Must roll back"
        },
        {
          protocolVersion: "2.0.0",
          commandId: "invalid_asset_after_document",
          type: "asset.pattern.upsert",
          asset: invalidPattern
        }
      ]
    });

    expect(result).toMatchObject({
      accepted: false,
      reason: "COMMAND_REJECTED",
      commandIndex: 1
    });
    expect(store.currentRevision).toBe(0);
    expect(
      findNode(store.getCurrent().project.document, "heading_foundation")
        ?.name
    ).toBeUndefined();
    expect(
      store.getCurrent().project.assets.patterns[
        "project.invalid-transaction"
      ]
    ).toBeUndefined();
  });

  it("undoes, redoes, restores and serializes whole project snapshots", async () => {
    const project = await loadFoundationProject();
    const context = {
      primitives: project.primitiveComponents,
      tokens: project.tokens,
      actions: project.actions
    };
    const store = new InMemoryProjectRevisionStore(
      {
        document: project.document,
        assets: project.assets
      },
      context,
      { clock: () => new Date("2026-07-24T04:00:00.000Z") }
    );
    const pattern = structuredClone(
      project.assets.patterns["project.two-column-copy"]!
    );
    pattern.id = "project.history-pattern";
    const committed = store.commit({
      baseRevision: 0,
      commands: [
        {
          protocolVersion: "2.0.0",
          commandId: "history_pattern_upsert",
          type: "asset.pattern.upsert",
          asset: pattern
        }
      ]
    });
    expect(committed.accepted).toBe(true);

    const undone = store.undo(1);
    expect(undone.accepted).toBe(true);
    if (!undone.accepted) return;
    expect(
      undone.revision.project.assets.patterns["project.history-pattern"]
    ).toBeUndefined();

    const redone = store.redo(2);
    expect(redone.accepted).toBe(true);
    if (!redone.accepted) return;
    expect(
      redone.revision.project.assets.patterns["project.history-pattern"]
    ).toBeDefined();

    const restored = store.restore(3, 0);
    expect(restored.accepted).toBe(true);
    if (!restored.accepted) return;
    expect(
      restored.revision.project.assets.patterns["project.history-pattern"]
    ).toBeUndefined();

    const state = store.exportState();
    expect(checkProjectRevisionStoreState(state).valid).toBe(true);
    expect(
      checkProjectRevisionStoreState({
        ...state,
        formatVersion: "2.0.0"
      }).valid
    ).toBe(false);
    const mismatchedCommit = structuredClone(state);
    const commit = mismatchedCommit.history.find(
      (entry) => entry.kind === "commit"
    );
    if (commit?.kind === "commit") {
      commit.patches.push(structuredClone(commit.patches[0]!));
    }
    expect(checkProjectRevisionStoreState(mismatchedCommit)).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          message:
            "Commit commands and patches must have equal lengths."
        })
      ]
    });
    const invalidCheckpoint = structuredClone(state);
    invalidCheckpoint.undoStack.push({
      project: structuredClone(state.revisions[0]!.project),
      originRevision: state.revisions.length
    });
    expect(checkProjectRevisionStoreState(invalidCheckpoint)).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          path: expect.stringContaining("/originRevision")
        })
      ]
    });
    const reloaded = InMemoryProjectRevisionStore.fromState(
      structuredClone(state),
      context
    );
    expect(reloaded.getCurrent()).toEqual(store.getCurrent());
    expect(reloaded.getHistory()).toEqual(store.getHistory());
  });

  it("rejects an Asset interface update that invalidates current instances", async () => {
    const project = await loadFoundationProject();
    const store = new InMemoryProjectRevisionStore(
      {
        document: project.document,
        assets: project.assets
      },
      {
        primitives: project.primitiveComponents,
        tokens: project.tokens,
        actions: project.actions
      }
    );
    const inserted = store.commit({
      baseRevision: 0,
      commands: [
        {
          protocolVersion: "2.0.0",
          commandId: "insert_existing_callout",
          type: "node.insert",
          targetParentId: "stack_foundation",
          node: {
            id: "existing_callout",
            kind: "component",
            componentRef: "project.foundation-callout",
            variant: "default",
            props: {
              title: "Existing title",
              body: "Existing body"
            }
          }
        }
      ]
    });
    expect(inserted.accepted).toBe(true);

    const incompatible = structuredClone(
      project.assets.composites["project.foundation-callout"]!
    );
    delete incompatible.publicProps.title;
    incompatible.version = 2;
    const update = store.commit({
      baseRevision: 1,
      commands: [
        {
          protocolVersion: "2.0.0",
          commandId: "breaking_callout_update",
          type: "asset.composite.upsert",
          asset: incompatible
        }
      ]
    });

    expect(update).toMatchObject({
      accepted: false,
      reason: "COMMAND_REJECTED",
      violations: [{ code: "UNKNOWN_PROP" }]
    });
    expect(store.currentRevision).toBe(1);
    expect(
      store.getCurrent().project.assets.composites[
        "project.foundation-callout"
      ]?.version
    ).toBe(1);
  });

  it("rejects stale and replayed commands without publishing state", async () => {
    const project = await loadFoundationProject();
    const store = new InMemoryProjectRevisionStore(
      { document: project.document, assets: project.assets },
      {
        primitives: project.primitiveComponents,
        tokens: project.tokens,
        actions: project.actions
      }
    );
    const command = {
      protocolVersion: "2.0.0",
      commandId: "project_identity_guard",
      type: "node.setName",
      nodeId: "heading_foundation",
      name: "Committed once"
    };
    expect(
      store.commit({ baseRevision: 0, commands: [command] })
    ).toMatchObject({ accepted: true });
    expect(
      store.commit({
        baseRevision: 0,
        commands: [{ ...command, commandId: "stale_project_command" }]
      })
    ).toEqual({
      accepted: false,
      reason: "REVISION_CONFLICT",
      currentRevision: 1
    });
    expect(
      store.commit({ baseRevision: 1, commands: [command] })
    ).toEqual({
      accepted: false,
      reason: "DUPLICATE_COMMAND",
      currentRevision: 1,
      commandId: command.commandId
    });
    expect(store.currentRevision).toBe(1);
  });

  it("returns detached whole-project snapshots", async () => {
    const project = await loadFoundationProject();
    const store = new InMemoryProjectRevisionStore(
      { document: project.document, assets: project.assets },
      {
        primitives: project.primitiveComponents,
        tokens: project.tokens,
        actions: project.actions
      }
    );
    const snapshot = store.getCurrent();
    snapshot.project.document.children.length = 0;
    delete snapshot.project.assets.patterns[
      "project.two-column-copy"
    ];

    expect(
      store.getCurrent().project.document.children.length
    ).toBeGreaterThan(0);
    expect(
      store.getCurrent().project.assets.patterns[
        "project.two-column-copy"
      ]
    ).toBeDefined();
  });
});
