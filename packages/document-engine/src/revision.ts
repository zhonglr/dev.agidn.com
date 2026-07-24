export type RevisionNumber = number;
export type ChangeSource = "human" | "system" | "mcp";

export interface RevisionStoreOptions {
  clock?: () => Date;
}
