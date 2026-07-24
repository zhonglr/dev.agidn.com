import {
  InMemoryProjectRevisionStore,
  type ChangeSource,
  type ProjectCommitRequest,
  type ProjectCommitResult,
  type ProjectHistoryEntry,
  type ProjectNavigationResult,
  type ProjectRevision,
  type ProjectRevisionContext,
  type ProjectSnapshot,
  type RevisionNumber,
  type RevisionStoreOptions
} from "@agidn/document-engine";
import type { ProjectRevisionStatePersistencePort } from "./ports/project-revision-state-persistence.js";
import type { WorkspaceProjectRevisionStorePort } from "./ports/project-revision-store.js";

export class PersistentProjectRevisionStore
  implements WorkspaceProjectRevisionStorePort
{
  #store: InMemoryProjectRevisionStore;
  #mutationTail: Promise<void> = Promise.resolve();

  private constructor(
    store: InMemoryProjectRevisionStore,
    private readonly context: ProjectRevisionContext,
    private readonly persistence: ProjectRevisionStatePersistencePort,
    private readonly options: RevisionStoreOptions
  ) {
    this.#store = store;
  }

  static async create(
    initialProject: ProjectSnapshot,
    context: ProjectRevisionContext,
    persistence: ProjectRevisionStatePersistencePort,
    options: RevisionStoreOptions = {}
  ): Promise<PersistentProjectRevisionStore> {
    const persisted = await persistence.load();
    const store =
      persisted === undefined
        ? new InMemoryProjectRevisionStore(
            initialProject,
            context,
            options
          )
        : InMemoryProjectRevisionStore.fromState(
            persisted,
            context,
            options
          );
    if (
      store.getRevision(0)?.project.document.id !==
      initialProject.document.id
    ) {
      throw new Error(
        "Project Revision Store state belongs to a different project."
      );
    }
    if (persisted === undefined) {
      await persistence.save(store.exportState());
    }
    return new PersistentProjectRevisionStore(
      store,
      context,
      persistence,
      options
    );
  }

  getCurrent(): ProjectRevision {
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

  getRevision(
    revision: RevisionNumber
  ): ProjectRevision | undefined {
    return this.#store.getRevision(revision);
  }

  getHistory(): ProjectHistoryEntry[] {
    return this.#store.getHistory();
  }

  commit(request: ProjectCommitRequest): Promise<ProjectCommitResult> {
    return this.#mutate((candidate) => candidate.commit(request));
  }

  undo(
    baseRevision: RevisionNumber,
    source: ChangeSource = "human"
  ): Promise<ProjectNavigationResult> {
    return this.#mutate((candidate) =>
      candidate.undo(baseRevision, source)
    );
  }

  redo(
    baseRevision: RevisionNumber,
    source: ChangeSource = "human"
  ): Promise<ProjectNavigationResult> {
    return this.#mutate((candidate) =>
      candidate.redo(baseRevision, source)
    );
  }

  restore(
    baseRevision: RevisionNumber,
    targetRevision: RevisionNumber,
    source: ChangeSource = "human"
  ): Promise<ProjectNavigationResult> {
    return this.#mutate((candidate) =>
      candidate.restore(baseRevision, targetRevision, source)
    );
  }

  #mutate<
    Result extends ProjectCommitResult | ProjectNavigationResult
  >(
    operation: (candidate: InMemoryProjectRevisionStore) => Result
  ): Promise<Result> {
    const mutation = this.#mutationTail.then(async () => {
      const candidate = InMemoryProjectRevisionStore.fromState(
        this.#store.exportState(),
        this.context,
        this.options
      );
      const result = operation(candidate);
      if (result.accepted) {
        await this.persistence.save(candidate.exportState());
        this.#store = candidate;
      }
      return result;
    });
    this.#mutationTail = mutation.then(
      () => undefined,
      () => undefined
    );
    return mutation;
  }
}
