import type {
  CommitCommandsRequest,
  CommitCommandsResponse,
  GetDocumentResponse,
  NavigationRequest,
  NavigationResponse,
  RestoreRevisionRequest
} from "@agidn/api-protocol";

export interface DocumentServicePort {
  getCurrent(): GetDocumentResponse;
  commit(request: CommitCommandsRequest): Promise<CommitCommandsResponse>;
  undo(request: NavigationRequest): Promise<NavigationResponse>;
  redo(request: NavigationRequest): Promise<NavigationResponse>;
  restore(request: RestoreRevisionRequest): Promise<NavigationResponse>;
}
