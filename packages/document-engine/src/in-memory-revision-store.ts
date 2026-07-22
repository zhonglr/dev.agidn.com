import { applyCommand, type DocumentCommand, type DocumentPatch } from "@agidn/command-engine";
import type { PageDocument } from "@agidn/document-schema";
import { validateDocument, type RuleContext } from "@agidn/rule-engine";
import { InvalidInitialDocumentError } from "./errors.js";
import type { HistoryEntry } from "./history.js";
import type { NavigationResult } from "./navigation.js";
import { cloneRevision, type ChangeSource, type DocumentRevision, type RevisionNumber, type RevisionStoreOptions } from "./revision.js";
import type { CommitRequest, CommitResult } from "./transaction.js";

interface Checkpoint {
  document: PageDocument;
  originRevision: RevisionNumber;
}

export class InMemoryRevisionStore {
  readonly #context: RuleContext;
  readonly #clock: () => Date;
  readonly #revisions = new Map<RevisionNumber, DocumentRevision>();
  readonly #history: HistoryEntry[] = [];
  readonly #seenCommandIds = new Set<string>();
  readonly #undoStack: Checkpoint[] = [];
  readonly #redoStack: Checkpoint[] = [];
  #current: DocumentRevision;

  constructor(initialDocument: PageDocument, context: RuleContext, options: RevisionStoreOptions = {}) {
    const validation = validateDocument(initialDocument, context);
    if (!validation.valid) throw new InvalidInitialDocumentError(validation.violations);
    this.#context = context;
    this.#clock = options.clock ?? (() => new Date());
    this.#current = {
      revision: 0,
      document: structuredClone(initialDocument),
      createdAt: this.#clock().toISOString()
    };
    this.#revisions.set(0, cloneRevision(this.#current));
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

  getCurrent(): DocumentRevision {
    return cloneRevision(this.#current);
  }

  getRevision(revision: RevisionNumber): DocumentRevision | undefined {
    const snapshot = this.#revisions.get(revision);
    return snapshot ? cloneRevision(snapshot) : undefined;
  }

  getHistory(): HistoryEntry[] {
    return structuredClone(this.#history);
  }

  commit(request: CommitRequest): CommitResult {
    if (request.baseRevision !== this.#current.revision) {
      return { accepted: false, reason: "REVISION_CONFLICT", currentRevision: this.#current.revision };
    }
    if (request.commands.length === 0) {
      return { accepted: false, reason: "EMPTY_TRANSACTION", currentRevision: this.#current.revision };
    }

    let candidate = structuredClone(this.#current.document);
    const commands: DocumentCommand[] = [];
    const patches: DocumentPatch[] = [];
    const transactionCommandIds = new Set<string>();
    for (const [commandIndex, input] of request.commands.entries()) {
      const commandId = this.#readCommandId(input);
      if (commandId && (this.#seenCommandIds.has(commandId) || transactionCommandIds.has(commandId))) {
        return { accepted: false, reason: "DUPLICATE_COMMAND", currentRevision: this.#current.revision, commandId };
      }
      const result = applyCommand(candidate, input, this.#context);
      if (!result.accepted) {
        return {
          accepted: false,
          reason: "COMMAND_REJECTED",
          currentRevision: this.#current.revision,
          commandIndex,
          violations: result.violations
        };
      }
      candidate = result.document;
      commands.push(result.command);
      patches.push(result.patch);
      transactionCommandIds.add(result.command.commandId);
    }

    const parentRevision = this.#current.revision;
    this.#undoStack.push({ document: structuredClone(this.#current.document), originRevision: parentRevision });
    this.#redoStack.length = 0;
    const revision = this.#createRevision(candidate);
    commands.forEach(({ commandId }) => this.#seenCommandIds.add(commandId));
    this.#history.push({
      kind: "commit",
      revision: revision.revision,
      parentRevision,
      createdAt: revision.createdAt,
      source: request.source ?? "human",
      commands: structuredClone(commands),
      patches: structuredClone(patches)
    });
    return { accepted: true, revision: cloneRevision(revision), patches: structuredClone(patches) };
  }

  undo(baseRevision: RevisionNumber, source: ChangeSource = "human"): NavigationResult {
    if (baseRevision !== this.#current.revision) {
      return { accepted: false, reason: "REVISION_CONFLICT", currentRevision: this.#current.revision };
    }
    const checkpoint = this.#undoStack.pop();
    if (!checkpoint) return { accepted: false, reason: "NOTHING_TO_UNDO", currentRevision: this.#current.revision };
    const parentRevision = this.#current.revision;
    this.#redoStack.push({ document: structuredClone(this.#current.document), originRevision: parentRevision });
    const revision = this.#createRevision(checkpoint.document);
    this.#history.push({
      kind: "undo",
      revision: revision.revision,
      parentRevision,
      createdAt: revision.createdAt,
      source,
      targetRevision: checkpoint.originRevision
    });
    return { accepted: true, revision: cloneRevision(revision) };
  }

  redo(baseRevision: RevisionNumber, source: ChangeSource = "human"): NavigationResult {
    if (baseRevision !== this.#current.revision) {
      return { accepted: false, reason: "REVISION_CONFLICT", currentRevision: this.#current.revision };
    }
    const checkpoint = this.#redoStack.pop();
    if (!checkpoint) return { accepted: false, reason: "NOTHING_TO_REDO", currentRevision: this.#current.revision };
    const parentRevision = this.#current.revision;
    this.#undoStack.push({ document: structuredClone(this.#current.document), originRevision: parentRevision });
    const revision = this.#createRevision(checkpoint.document);
    this.#history.push({
      kind: "redo",
      revision: revision.revision,
      parentRevision,
      createdAt: revision.createdAt,
      source,
      targetRevision: checkpoint.originRevision
    });
    return { accepted: true, revision: cloneRevision(revision) };
  }

  #readCommandId(input: unknown): string | undefined {
    return input !== null && typeof input === "object" && typeof (input as { commandId?: unknown }).commandId === "string"
      ? (input as { commandId: string }).commandId
      : undefined;
  }

  #createRevision(document: PageDocument): DocumentRevision {
    const revision: DocumentRevision = {
      revision: this.#current.revision + 1,
      document: structuredClone(document),
      createdAt: this.#clock().toISOString()
    };
    this.#current = revision;
    this.#revisions.set(revision.revision, cloneRevision(revision));
    return revision;
  }
}
