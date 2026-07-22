import type { Static } from "@sinclair/typebox";
import type {
  CommitCommandsRequestSchema,
  CommitCommandsResponseSchema,
  GetDocumentResponseSchema,
  NavigationRequestSchema,
  NavigationResponseSchema,
  ProtocolErrorResponseSchema,
  TransportErrorResponseSchema
} from "./schemas/document.js";

export type CommitCommandsRequest = Static<typeof CommitCommandsRequestSchema>;
export type CommitCommandsResponse = Static<typeof CommitCommandsResponseSchema>;
export type GetDocumentResponse = Static<typeof GetDocumentResponseSchema>;
export type NavigationRequest = Static<typeof NavigationRequestSchema>;
export type NavigationResponse = Static<typeof NavigationResponseSchema>;
export type ProtocolErrorResponse = Static<typeof ProtocolErrorResponseSchema>;
export type TransportErrorResponse = Static<typeof TransportErrorResponseSchema>;
