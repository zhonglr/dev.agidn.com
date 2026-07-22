import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findNode } from "@agidn/document-schema";
import { InMemoryRevisionStore, InvalidRevisionStoreStateError } from "@agidn/document-engine";
import { loadGoldenProject } from "../helpers.js";

async function addCardCommand() {
  return JSON.parse(await readFile(resolve("examples/golden-pricing/commands/add-card.json"), "utf8"));
}

describe("InMemoryRevisionStore", () => {
  it("commits an atomic transaction and records a monotonic revision", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project, {
      clock: () => new Date("2026-07-22T00:00:00.000Z")
    });
    const result = store.commit({ baseRevision: 0, commands: [await addCardCommand()], source: "human" });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.revision.revision).toBe(1);
    expect(findNode(result.revision.document, "pricing_card_enterprise")).toBeDefined();
    expect(findNode(project.document, "pricing_card_enterprise")).toBeUndefined();
    expect(result.patches).toHaveLength(1);
    expect(store.getHistory()).toMatchObject([
      { kind: "commit", revision: 1, parentRevision: 0, source: "human" }
    ]);
  });

  it("rejects a stale baseRevision without changing current state", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    expect(store.commit({ baseRevision: 0, commands: [await addCardCommand()] }).accepted).toBe(true);

    const stale = store.commit({
      baseRevision: 0,
      commands: [{
        commandId: "cmd_stale_variant",
        protocolVersion: "1.0.0",
        type: "node.setVariant",
        nodeId: "pricing_card_pro",
        variant: "default"
      }]
    });

    expect(stale).toEqual({ accepted: false, reason: "REVISION_CONFLICT", currentRevision: 1 });
    expect(store.currentRevision).toBe(1);
  });

  it("rolls back the whole transaction when a later command is rejected", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    const result = store.commit({
      baseRevision: 0,
      commands: [
        {
          commandId: "cmd_valid_first",
          protocolVersion: "1.0.0",
          type: "node.setVariant",
          nodeId: "pricing_card_pro",
          variant: "default"
        },
        {
          commandId: "cmd_invalid_second",
          protocolVersion: "1.0.0",
          type: "node.setLayoutProperty",
          nodeId: "grid_plans",
          property: "top",
          value: 12
        }
      ]
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe("COMMAND_REJECTED");
    if (result.reason !== "COMMAND_REJECTED") return;
    expect(result.commandIndex).toBe(1);
    expect(result.violations.map(({ code }) => code)).toContain("ABSOLUTE_POSITION_FORBIDDEN");
    expect(store.currentRevision).toBe(0);
    expect(store.getHistory()).toEqual([]);
    expect(findNode(store.getCurrent().document, "pricing_card_pro")).toMatchObject({ variant: "featured" });
  });

  it("rejects replayed command identities", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    const command = await addCardCommand();
    expect(store.commit({ baseRevision: 0, commands: [command] }).accepted).toBe(true);

    expect(store.commit({ baseRevision: 1, commands: [command] })).toEqual({
      accepted: false,
      reason: "DUPLICATE_COMMAND",
      currentRevision: 1,
      commandId: "cmd_add_enterprise_card"
    });
  });

  it("creates new revisions for undo and redo", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    expect(store.commit({ baseRevision: 0, commands: [await addCardCommand()] }).accepted).toBe(true);

    const undone = store.undo(1);
    expect(undone.accepted).toBe(true);
    if (!undone.accepted) return;
    expect(undone.revision.revision).toBe(2);
    expect(findNode(undone.revision.document, "pricing_card_enterprise")).toBeUndefined();
    expect(store.canRedo).toBe(true);

    const redone = store.redo(2);
    expect(redone.accepted).toBe(true);
    if (!redone.accepted) return;
    expect(redone.revision.revision).toBe(3);
    expect(findNode(redone.revision.document, "pricing_card_enterprise")).toBeDefined();
    expect(store.getHistory().map(({ kind }) => kind)).toEqual(["commit", "undo", "redo"]);
  });

  it("restores an historical snapshot as a new undoable revision", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    expect(store.commit({ baseRevision: 0, commands: [await addCardCommand()] }).accepted).toBe(true);

    const restored = store.restore(1, 0);
    expect(restored.accepted).toBe(true);
    if (!restored.accepted) return;
    expect(restored.revision.revision).toBe(2);
    expect(findNode(restored.revision.document, "pricing_card_enterprise")).toBeUndefined();
    expect(store.getHistory().at(-1)).toMatchObject({ kind: "restore", revision: 2, parentRevision: 1, targetRevision: 0 });

    const undone = store.undo(2);
    expect(undone.accepted).toBe(true);
    if (undone.accepted) expect(findNode(undone.revision.document, "pricing_card_enterprise")).toBeDefined();
    expect(store.restore(3, 99)).toEqual({ accepted: false, reason: "REVISION_NOT_FOUND", currentRevision: 3 });
  });

  it("returns detached snapshots that callers cannot mutate", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    const snapshot = store.getCurrent();
    snapshot.document.children.length = 0;

    expect(store.getCurrent().document.children.length).toBeGreaterThan(0);
    expect(store.getRevision(0)?.document.children.length).toBeGreaterThan(0);
  });

  it("rejects structurally valid state with a broken revision sequence", async () => {
    const project = await loadGoldenProject();
    const store = new InMemoryRevisionStore(project.document, project);
    const state = store.exportState();
    state.revisions[0]!.revision = 2;

    expect(() => InMemoryRevisionStore.fromState(state, project)).toThrow(InvalidRevisionStoreStateError);
  });
});
