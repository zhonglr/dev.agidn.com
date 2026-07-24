import type { ProjectRevisionStoreState } from "@agidn/document-engine";

export interface ProjectRevisionStatePersistencePort {
  load(): Promise<unknown | undefined>;
  save(state: ProjectRevisionStoreState): Promise<void>;
}
