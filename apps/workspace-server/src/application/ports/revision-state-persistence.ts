import type { RevisionStoreState } from "@agidn/document-engine";

export interface RevisionStatePersistencePort {
  load(): Promise<unknown | undefined>;
  save(state: RevisionStoreState): Promise<void>;
}
