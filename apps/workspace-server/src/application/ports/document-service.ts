import type {
  CommitCommandsRequest,
  CommitCommandsResponse,
  GetDocumentResponse,
  NavigationRequest,
  NavigationResponse
} from "@agidn/api-protocol";

export interface DocumentServicePort {
  getCurrent(): GetDocumentResponse;
  commit(request: CommitCommandsRequest): Promise<CommitCommandsResponse>;
  undo(request: NavigationRequest): Promise<NavigationResponse>;
  redo(request: NavigationRequest): Promise<NavigationResponse>;
}
