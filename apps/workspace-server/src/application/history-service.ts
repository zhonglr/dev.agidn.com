import type { GetHistoryResponse } from "@agidn/api-protocol";
import type { HistoryServicePort } from "./ports/history-service.js";
import type { WorkspaceRevisionStorePort } from "./ports/revision-store.js";

export class HistoryService implements HistoryServicePort {
  constructor(private readonly store: WorkspaceRevisionStorePort) {}

  getHistory(): GetHistoryResponse {
    return {
      protocolVersion: "1.0.0",
      ok: true,
      currentRevision: this.store.currentRevision,
      canUndo: this.store.canUndo,
      canRedo: this.store.canRedo,
      entries: this.store.getHistory()
    };
  }
}
