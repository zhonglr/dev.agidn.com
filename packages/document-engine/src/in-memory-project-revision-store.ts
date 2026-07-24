import { applyCommand } from "@agidn/command-engine";
import {
  applyProjectAssetCommand,
  composeProjectComponentRegistry,
  validateProjectAssets,
  type ProjectAssetRegistry
} from "@agidn/project-assets";
import {
  validateDocument,
  type RuleContext
} from "@agidn/rule-engine";
import { InvalidRevisionStoreStateError } from "./errors.js";
import {
  cloneProjectRevision,
  type ProjectRevision,
  type ProjectRevisionCheckpoint,
  type ProjectSnapshot
} from "./project-revision.js";
import {
  checkProjectRevisionStoreState,
  PROJECT_REVISION_STORE_FORMAT_VERSION,
  type ProjectRevisionStoreState
} from "./project-revision-store-state.js";
import type {
  ProjectCommand,
  ProjectCommandViolation,
  ProjectCommitRequest,
  ProjectCommitResult,
  ProjectHistoryEntry,
  ProjectNavigationResult,
  ProjectPatch
} from "./project-transaction.js";
import type {
  ChangeSource,
  RevisionNumber,
  RevisionStoreOptions
} from "./revision.js";
import type { ComponentRegistry } from "@agidn/component-registry";
import type { TokenRegistry } from "@agidn/design-tokens";

export interface ProjectRevisionContext {
  primitives: ComponentRegistry;
  tokens: TokenRegistry;
  actions?: RuleContext["actions"];
  maxLayoutDepth?: number;
}

export class InvalidInitialProjectError extends Error {
  constructor(
    readonly violations: readonly ProjectCommandViolation[]
  ) {
    super(
      `Initial Project is invalid: ${violations
        .map(({ code, message }) => `${code}: ${message}`)
        .join("; ")}`
    );
    this.name = "InvalidInitialProjectError";
  }
}

function assetInput(input: unknown): boolean {
  return Boolean(
    input &&
      typeof input === "object" &&
      "type" in input &&
      typeof input.type === "string" &&
      input.type.startsWith("asset.")
  );
}

export class InMemoryProjectRevisionStore {
  readonly #context: ProjectRevisionContext;
  readonly #clock: () => Date;
  readonly #revisions = new Map<RevisionNumber, ProjectRevision>();
  readonly #history: ProjectHistoryEntry[] = [];
  readonly #seenCommandIds = new Set<string>();
  readonly #undoStack: ProjectRevisionCheckpoint[] = [];
  readonly #redoStack: ProjectRevisionCheckpoint[] = [];
  #current: ProjectRevision;

  constructor(
    initialProject: ProjectSnapshot,
    context: ProjectRevisionContext,
    options: RevisionStoreOptions = {}
  ) {
    const validation = this.#validateProject(initialProject, context);
    if (!validation.valid) {
      throw new InvalidInitialProjectError(validation.violations);
    }
    this.#context = context;
    this.#clock = options.clock ?? (() => new Date());
    this.#current = {
      revision: 0,
      project: structuredClone(validation.project),
      createdAt: this.#clock().toISOString()
    };
    this.#revisions.set(0, cloneProjectRevision(this.#current));
  }

  static fromState(
    input: unknown,
    context: ProjectRevisionContext,
    options: RevisionStoreOptions = {}
  ): InMemoryProjectRevisionStore {
    const checked = checkProjectRevisionStoreState(input);
    if (!checked.valid) {
      throw new InvalidRevisionStoreStateError(checked.issues);
    }
    const initial = checked.state.revisions[0];
    if (!initial) {
      throw new InvalidRevisionStoreStateError([
        { path: "/revisions", message: "Revision 0 is required." }
      ]);
    }
    const store = new InMemoryProjectRevisionStore(
      initial.project,
      context,
      options
    );
    for (const [index, revision] of checked.state.revisions.entries()) {
      const validation = store.#validateProject(
        revision.project,
        context
      );
      if (!validation.valid) {
        throw new InvalidRevisionStoreStateError(
          validation.violations.map(({ message }) => ({
            path: `/revisions/${index}/project`,
            message
          }))
        );
      }
    }
    for (const [stackName, checkpoints] of [
      ["undoStack", checked.state.undoStack],
      ["redoStack", checked.state.redoStack]
    ] as const) {
      for (const [index, checkpoint] of checkpoints.entries()) {
        const validation = store.#validateProject(
          checkpoint.project,
          context
        );
        if (!validation.valid) {
          throw new InvalidRevisionStoreStateError(
            validation.violations.map(({ message }) => ({
              path: `/${stackName}/${index}/project`,
              message
            }))
          );
        }
      }
    }

    store.#revisions.clear();
    checked.state.revisions.forEach((revision) =>
      store.#revisions.set(
        revision.revision,
        cloneProjectRevision(revision)
      )
    );
    store.#history.push(...structuredClone(checked.state.history));
    store.#undoStack.push(
      ...structuredClone(checked.state.undoStack)
    );
    store.#redoStack.push(
      ...structuredClone(checked.state.redoStack)
    );
    checked.state.history.forEach((entry) => {
      if (entry.kind === "commit") {
        entry.commands.forEach(({ commandId }) =>
          store.#seenCommandIds.add(commandId)
        );
      }
    });
    store.#current = cloneProjectRevision(
      checked.state.revisions.at(-1) ?? initial
    );
    return store;
  }

  get currentRevision(): RevisionNumber {
    return this.#current.revision;
  }

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  getCurrent(): ProjectRevision {
    return cloneProjectRevision(this.#current);
  }

  getRevision(
    revision: RevisionNumber
  ): ProjectRevision | undefined {
    const snapshot = this.#revisions.get(revision);
    return snapshot ? cloneProjectRevision(snapshot) : undefined;
  }

  getHistory(): ProjectHistoryEntry[] {
    return structuredClone(this.#history);
  }

  exportState(): ProjectRevisionStoreState {
    return {
      formatVersion: PROJECT_REVISION_STORE_FORMAT_VERSION,
      revisions: [...this.#revisions.values()].map(
        cloneProjectRevision
      ),
      history: structuredClone(this.#history),
      undoStack: structuredClone(this.#undoStack),
      redoStack: structuredClone(this.#redoStack)
    };
  }

  commit(request: ProjectCommitRequest): ProjectCommitResult {
    if (request.baseRevision !== this.#current.revision) {
      return {
        accepted: false,
        reason: "REVISION_CONFLICT",
        currentRevision: this.#current.revision
      };
    }
    if (request.commands.length === 0) {
      return {
        accepted: false,
        reason: "EMPTY_TRANSACTION",
        currentRevision: this.#current.revision
      };
    }

    const candidate = structuredClone(this.#current.project);
    const commands: ProjectCommand[] = [];
    const patches: ProjectPatch[] = [];
    const transactionCommandIds = new Set<string>();
    for (const [commandIndex, input] of request.commands.entries()) {
      const commandId = this.#readCommandId(input);
      if (
        commandId &&
        (
          this.#seenCommandIds.has(commandId) ||
          transactionCommandIds.has(commandId)
        )
      ) {
        return {
          accepted: false,
          reason: "DUPLICATE_COMMAND",
          currentRevision: this.#current.revision,
          commandId
        };
      }

      if (assetInput(input)) {
        const result = applyProjectAssetCommand(
          candidate.assets,
          input,
          {
            primitives: this.#context.primitives,
            document: candidate.document
          }
        );
        if (!result.accepted) {
          return {
            accepted: false,
            reason: "COMMAND_REJECTED",
            currentRevision: this.#current.revision,
            commandIndex,
            violations: result.violations
          };
        }
        candidate.assets = result.assets;
        const documentValidation = validateDocument(
          candidate.document,
          this.#rulesFor(candidate.assets)
        );
        if (!documentValidation.valid) {
          return {
            accepted: false,
            reason: "COMMAND_REJECTED",
            currentRevision: this.#current.revision,
            commandIndex,
            violations: documentValidation.violations
          };
        }
        commands.push(result.command);
        patches.push(result.patch);
        transactionCommandIds.add(result.command.commandId);
        continue;
      }

      const result = applyCommand(
        candidate.document,
        input,
        this.#rulesFor(candidate.assets)
      );
      if (!result.accepted) {
        return {
          accepted: false,
          reason: "COMMAND_REJECTED",
          currentRevision: this.#current.revision,
          commandIndex,
          violations: result.violations
        };
      }
      candidate.document = result.document;
      commands.push(result.command);
      patches.push(result.patch);
      transactionCommandIds.add(result.command.commandId);
    }

    const parentRevision = this.#current.revision;
    this.#undoStack.push({
      project: structuredClone(this.#current.project),
      originRevision: parentRevision
    });
    this.#redoStack.length = 0;
    const revision = this.#createRevision(candidate);
    commands.forEach(({ commandId }) =>
      this.#seenCommandIds.add(commandId)
    );
    this.#history.push({
      kind: "commit",
      revision: revision.revision,
      parentRevision,
      createdAt: revision.createdAt,
      source: request.source ?? "human",
      commands: structuredClone(commands),
      patches: structuredClone(patches)
    });
    return {
      accepted: true,
      revision: cloneProjectRevision(revision),
      patches: structuredClone(patches)
    };
  }

  undo(
    baseRevision: RevisionNumber,
    source: ChangeSource = "human"
  ): ProjectNavigationResult {
    return this.#navigate("undo", baseRevision, source);
  }

  redo(
    baseRevision: RevisionNumber,
    source: ChangeSource = "human"
  ): ProjectNavigationResult {
    return this.#navigate("redo", baseRevision, source);
  }

  restore(
    baseRevision: RevisionNumber,
    targetRevision: RevisionNumber,
    source: ChangeSource = "human"
  ): ProjectNavigationResult {
    if (baseRevision !== this.#current.revision) {
      return {
        accepted: false,
        reason: "REVISION_CONFLICT",
        currentRevision: this.#current.revision
      };
    }
    if (targetRevision === this.#current.revision) {
      return {
        accepted: false,
        reason: "ALREADY_CURRENT",
        currentRevision: this.#current.revision
      };
    }
    const target = this.#revisions.get(targetRevision);
    if (!target) {
      return {
        accepted: false,
        reason: "REVISION_NOT_FOUND",
        currentRevision: this.#current.revision
      };
    }
    const parentRevision = this.#current.revision;
    this.#undoStack.push({
      project: structuredClone(this.#current.project),
      originRevision: parentRevision
    });
    this.#redoStack.length = 0;
    const revision = this.#createRevision(target.project);
    this.#history.push({
      kind: "restore",
      revision: revision.revision,
      parentRevision,
      createdAt: revision.createdAt,
      source,
      targetRevision
    });
    return {
      accepted: true,
      revision: cloneProjectRevision(revision)
    };
  }

  #navigate(
    direction: "undo" | "redo",
    baseRevision: RevisionNumber,
    source: ChangeSource
  ): ProjectNavigationResult {
    if (baseRevision !== this.#current.revision) {
      return {
        accepted: false,
        reason: "REVISION_CONFLICT",
        currentRevision: this.#current.revision
      };
    }
    const from =
      direction === "undo" ? this.#undoStack : this.#redoStack;
    const to =
      direction === "undo" ? this.#redoStack : this.#undoStack;
    const checkpoint = from.pop();
    if (!checkpoint) {
      return {
        accepted: false,
        reason:
          direction === "undo"
            ? "NOTHING_TO_UNDO"
            : "NOTHING_TO_REDO",
        currentRevision: this.#current.revision
      };
    }
    const parentRevision = this.#current.revision;
    to.push({
      project: structuredClone(this.#current.project),
      originRevision: parentRevision
    });
    const revision = this.#createRevision(checkpoint.project);
    this.#history.push({
      kind: direction,
      revision: revision.revision,
      parentRevision,
      createdAt: revision.createdAt,
      source,
      targetRevision: checkpoint.originRevision
    });
    return {
      accepted: true,
      revision: cloneProjectRevision(revision)
    };
  }

  #rulesFor(assets: ProjectAssetRegistry): RuleContext {
    return {
      components: composeProjectComponentRegistry(
        this.#context.primitives,
        assets
      ),
      tokens: this.#context.tokens,
      ...(this.#context.actions
        ? { actions: this.#context.actions }
        : {}),
      ...(this.#context.maxLayoutDepth !== undefined
        ? { maxLayoutDepth: this.#context.maxLayoutDepth }
        : {})
    };
  }

  #validateProject(
    project: ProjectSnapshot,
    context: ProjectRevisionContext
  ):
    | { valid: true; project: ProjectSnapshot }
    | {
        valid: false;
        violations: ProjectCommandViolation[];
      } {
    const assetValidation = validateProjectAssets(
      project.assets,
      context.primitives
    );
    if (!assetValidation.valid) {
      return {
        valid: false,
        violations: assetValidation.issues
      };
    }
    const documentValidation = validateDocument(project.document, {
      components: composeProjectComponentRegistry(
        context.primitives,
        assetValidation.assets
      ),
      tokens: context.tokens,
      ...(context.actions ? { actions: context.actions } : {}),
      ...(context.maxLayoutDepth !== undefined
        ? { maxLayoutDepth: context.maxLayoutDepth }
        : {})
    });
    return documentValidation.valid
      ? {
          valid: true,
          project: {
            document: structuredClone(project.document),
            assets: assetValidation.assets
          }
        }
      : {
          valid: false,
          violations: documentValidation.violations
        };
  }

  #readCommandId(input: unknown): string | undefined {
    return input !== null &&
      typeof input === "object" &&
      typeof (input as { commandId?: unknown }).commandId === "string"
      ? (input as { commandId: string }).commandId
      : undefined;
  }

  #createRevision(project: ProjectSnapshot): ProjectRevision {
    const revision: ProjectRevision = {
      revision: this.#current.revision + 1,
      project: structuredClone(project),
      createdAt: this.#clock().toISOString()
    };
    this.#current = revision;
    this.#revisions.set(
      revision.revision,
      cloneProjectRevision(revision)
    );
    return revision;
  }
}
