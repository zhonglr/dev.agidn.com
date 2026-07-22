import { TypeCompiler, type TypeCheck } from "@sinclair/typebox/compiler";
import type { TSchema } from "@sinclair/typebox";
import {
  CommitCommandsRequestSchema,
  CommitCommandsResponseSchema,
  GetDocumentResponseSchema,
  NavigationRequestSchema,
  NavigationResponseSchema,
  ProtocolErrorResponseSchema,
  TransportErrorResponseSchema
} from "./schemas/document.js";
import type { CommitCommandsRequest, NavigationRequest } from "./types.js";
import { GetHistoryResponseSchema } from "./schemas/history.js";
import { GetCatalogResponseSchema } from "./schemas/catalog.js";
import { ExportContextRequestSchema, ExportContextResponseSchema } from "./schemas/export.js";
import type { ExportContextRequest } from "./types.js";

export interface ProtocolIssue {
  path: string;
  message: string;
}

export type DecodeResult<T> = { valid: true; value: T } | { valid: false; issues: ProtocolIssue[] };

function decoder<T>(compiled: TypeCheck<TSchema>): (input: unknown) => DecodeResult<T> {
  return (input) => {
    if (compiled.Check(input)) return { valid: true, value: input as T };
    return {
      valid: false,
      issues: [...compiled.Errors(input)].map((error) => ({ path: error.path || "/", message: error.message }))
    };
  };
}

function checker(schema: TSchema): (input: unknown) => boolean {
  const compiled = TypeCompiler.Compile(schema);
  return (input) => compiled.Check(input);
}

export const decodeCommitCommandsRequest = decoder<CommitCommandsRequest>(TypeCompiler.Compile(CommitCommandsRequestSchema));
export const checkCommitCommandsResponse = checker(CommitCommandsResponseSchema);
export const checkGetDocumentResponse = checker(GetDocumentResponseSchema);
export const decodeNavigationRequest = decoder<NavigationRequest>(TypeCompiler.Compile(NavigationRequestSchema));
export const checkNavigationResponse = checker(NavigationResponseSchema);
export const checkProtocolErrorResponse = checker(ProtocolErrorResponseSchema);
export const checkTransportErrorResponse = checker(TransportErrorResponseSchema);
export const checkGetHistoryResponse = checker(GetHistoryResponseSchema);
export const checkGetCatalogResponse = checker(GetCatalogResponseSchema);
export const decodeExportContextRequest = decoder<ExportContextRequest>(TypeCompiler.Compile(ExportContextRequestSchema));
export const checkExportContextResponse = checker(ExportContextResponseSchema);
