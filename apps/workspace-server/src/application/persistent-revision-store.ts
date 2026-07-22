import type { PageDocument } from "@agidn/document-schema";
import {
  InMemoryRevisionStore,
  type ChangeSource,
  type CommitRequest,
  type CommitResult,
  type DocumentRevision,
  type HistoryEntry,
  type NavigationResult,
  type RevisionNumber,
  type RevisionStoreOptions
} from "@agidn/document-engine";
import type { RuleContext } from "@agidn/rule-engine";
import type { RevisionStatePersistencePort } from "./ports/revision-state-persistence.js";
import type { WorkspaceRevisionStorePort } from "./ports/revision-store.js";

export class PersistentRevisionStore implements WorkspaceRevisionStorePort {
  #store: InMemoryRevisionStore;
  #mutationTail: Promise<void> = Promise.resolve();

  private constructor(
    store: InMemoryRevisionStore,
    private readonly context: RuleContext,
    private readonly persistence: RevisionStatePersistencePort,
    private readonly options: RevisionStoreOptions
  ) {
    this.#store = store;
  }

  static async create(
    initialDocument: PageDocument,
    context: RuleContext,
    persistence: RevisionStatePersistencePort,
    options: RevisionStoreOptions = {}
  ): Promise<PersistentRevisionStore> {
    const persisted = await persistence.load();
    const store = persisted === undefined
      ? new InMemoryRevisionStore(initialDocument, context, options)
      : InMemoryRevisionStore.fromState(persisted, context, options);
    if (store.getRevision(0)?.document.id !== initialDocument.id) {
      throw new Error("Revision Store state belongs to a different PageDocument.");
    }
    if (persisted === undefined) await persistence.save(store.exportState());
    return new PersistentRevisionStore(store, context, persistence, options);
  }

  getCurrent(): DocumentRevision {
    return this.#store.getCurrent();
  }

  get currentRevision(): RevisionNumber {
    return this.#store.currentRevision;
  }

  get canUndo(): boolean {
    return this.#store.canUndo;
  }

  get canRedo(): boolean {
    return this.#store.canRedo;
  }

  getRevision(revision: RevisionNumber): DocumentRevision | undefined {
    return this.#store.getRevision(revision);
  }

  getHistory(): HistoryEntry[] {
    return this.#store.getHistory();
  }

  commit(request: CommitRequest): Promise<CommitResult> {
    return this.#mutate((candidate) => candidate.commit(request));
  }

  undo(baseRevision: RevisionNumber, source: ChangeSource = "human"): Promise<NavigationResult> {
    return this.#mutate((candidate) => candidate.undo(baseRevision, source));
  }

  redo(baseRevision: RevisionNumber, source: ChangeSource = "human"): Promise<NavigationResult> {
    return this.#mutate((candidate) => candidate.redo(baseRevision, source));
  }

  #mutate<Result extends CommitResult | NavigationResult>(operation: (candidate: InMemoryRevisionStore) => Result): Promise<Result> {
    const mutation = this.#mutationTail.then(async () => {
      const candidate = InMemoryRevisionStore.fromState(this.#store.exportState(), this.context, this.options);
      const result = operation(candidate);
      if (result.accepted) {
        await this.persistence.save(candidate.exportState());
        this.#store = candidate;
      }
      return result;
    });
    this.#mutationTail = mutation.then(() => undefined, () => undefined);
    return mutation;
  }
}
