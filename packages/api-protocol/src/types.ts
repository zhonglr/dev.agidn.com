import type { Static } from "@sinclair/typebox";
import type {
  CommitCommandsRequestSchema,
  CommitCommandsResponseSchema,
  GetDocumentResponseSchema,
  NavigationRequestSchema,
  NavigationResponseSchema,
  RestoreRevisionRequestSchema,
  ProtocolErrorResponseSchema,
  TransportErrorResponseSchema
} from "./schemas/document.js";
import type { GetHistoryResponseSchema } from "./schemas/history.js";
import type { GetCatalogResponseSchema } from "./schemas/catalog.js";
import type { ExportContextRequestSchema, ExportContextResponseSchema } from "./schemas/export.js";

export type CommitCommandsRequest = Static<typeof CommitCommandsRequestSchema>;
export type CommitCommandsResponse = Static<typeof CommitCommandsResponseSchema>;
export type GetDocumentResponse = Static<typeof GetDocumentResponseSchema>;
export type NavigationRequest = Static<typeof NavigationRequestSchema>;
export type NavigationResponse = Static<typeof NavigationResponseSchema>;
export type RestoreRevisionRequest = Static<typeof RestoreRevisionRequestSchema>;
export type ProtocolErrorResponse = Static<typeof ProtocolErrorResponseSchema>;
export type TransportErrorResponse = Static<typeof TransportErrorResponseSchema>;
export type GetHistoryResponse = Static<typeof GetHistoryResponseSchema>;
export type GetCatalogResponse = Static<typeof GetCatalogResponseSchema>;
export type ExportContextRequest = Static<typeof ExportContextRequestSchema>;
export type ExportContextResponse = Static<typeof ExportContextResponseSchema>;
