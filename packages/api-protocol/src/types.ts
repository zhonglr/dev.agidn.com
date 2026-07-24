import type { Static } from "@sinclair/typebox";
import type {
  NavigationRequestSchema,
  ProtocolErrorResponseSchema,
  RestoreRevisionRequestSchema,
  TransportErrorResponseSchema
} from "./schemas/transport.js";
import type { GetCatalogResponseSchema } from "./schemas/catalog.js";
import type { ExportContextRequestSchema, ExportContextResponseSchema } from "./schemas/export.js";
import type {
  CommitProjectCommandsRequestSchema,
  CommitProjectCommandsResponseSchema,
  GetProjectHistoryResponseSchema,
  GetProjectResponseSchema,
  ProjectNavigationResponseSchema
} from "./schemas/project.js";

export type NavigationRequest = Static<typeof NavigationRequestSchema>;
export type RestoreRevisionRequest = Static<typeof RestoreRevisionRequestSchema>;
export type ProtocolErrorResponse = Static<typeof ProtocolErrorResponseSchema>;
export type TransportErrorResponse = Static<typeof TransportErrorResponseSchema>;
export type GetCatalogResponse = Static<typeof GetCatalogResponseSchema>;
export type ExportContextRequest = Static<typeof ExportContextRequestSchema>;
export type ExportContextResponse = Static<typeof ExportContextResponseSchema>;
export type CommitProjectCommandsRequest = Static<
  typeof CommitProjectCommandsRequestSchema
>;
export type CommitProjectCommandsResponse = Static<
  typeof CommitProjectCommandsResponseSchema
>;
export type GetProjectResponse = Static<typeof GetProjectResponseSchema>;
export type GetProjectHistoryResponse = Static<
  typeof GetProjectHistoryResponseSchema
>;
export type ProjectNavigationResponse = Static<
  typeof ProjectNavigationResponseSchema
>;
