import type {
  CommitCommandsRequest,
  CommitCommandsResponse,
  GetDocumentResponse,
  NavigationRequest,
  NavigationResponse
} from "@agidn/api-protocol";

export interface DocumentServicePort {
  getCurrent(): GetDocumentResponse;
  commit(request: CommitCommandsRequest): CommitCommandsResponse;
  undo(request: NavigationRequest): NavigationResponse;
  redo(request: NavigationRequest): NavigationResponse;
}
