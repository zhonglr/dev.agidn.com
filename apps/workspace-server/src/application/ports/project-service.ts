import type {
  CommitProjectCommandsRequest,
  CommitProjectCommandsResponse,
  GetProjectHistoryResponse,
  GetProjectResponse,
  NavigationRequest,
  ProjectNavigationResponse,
  RestoreRevisionRequest
} from "@agidn/api-protocol";

export interface ProjectServicePort {
  getCurrent(): GetProjectResponse;
  getHistory(): GetProjectHistoryResponse;
  commit(
    request: CommitProjectCommandsRequest
  ): Promise<CommitProjectCommandsResponse>;
  undo(request: NavigationRequest): Promise<ProjectNavigationResponse>;
  redo(request: NavigationRequest): Promise<ProjectNavigationResponse>;
  restore(
    request: RestoreRevisionRequest
  ): Promise<ProjectNavigationResponse>;
}
