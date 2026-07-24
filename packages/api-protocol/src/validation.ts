import { TypeCompiler, type TypeCheck } from "@sinclair/typebox/compiler";
import type { TSchema } from "@sinclair/typebox";
import {
  NavigationRequestSchema,
  ProtocolErrorResponseSchema,
  RestoreRevisionRequestSchema,
  TransportErrorResponseSchema
} from "./schemas/transport.js";
import type {
  NavigationRequest,
  RestoreRevisionRequest
} from "./types.js";
import { GetCatalogResponseSchema } from "./schemas/catalog.js";
import { ExportContextRequestSchema, ExportContextResponseSchema } from "./schemas/export.js";
import type { ExportContextRequest } from "./types.js";
import {
  CommitProjectCommandsRequestSchema,
  CommitProjectCommandsResponseSchema,
  GetProjectHistoryResponseSchema,
  GetProjectResponseSchema,
  ProjectNavigationResponseSchema
} from "./schemas/project.js";
import type { CommitProjectCommandsRequest } from "./types.js";

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

export const decodeNavigationRequest = decoder<NavigationRequest>(TypeCompiler.Compile(NavigationRequestSchema));
export const decodeRestoreRevisionRequest = decoder<RestoreRevisionRequest>(TypeCompiler.Compile(RestoreRevisionRequestSchema));
export const checkProtocolErrorResponse = checker(ProtocolErrorResponseSchema);
export const checkTransportErrorResponse = checker(TransportErrorResponseSchema);
export const checkGetCatalogResponse = checker(GetCatalogResponseSchema);
export const decodeExportContextRequest = decoder<ExportContextRequest>(TypeCompiler.Compile(ExportContextRequestSchema));
export const checkExportContextResponse = checker(ExportContextResponseSchema);
export const decodeCommitProjectCommandsRequest =
  decoder<CommitProjectCommandsRequest>(
    TypeCompiler.Compile(CommitProjectCommandsRequestSchema)
  );
export const checkCommitProjectCommandsResponse = checker(
  CommitProjectCommandsResponseSchema
);
export const checkGetProjectResponse = checker(
  GetProjectResponseSchema
);
export const checkGetProjectHistoryResponse = checker(
  GetProjectHistoryResponseSchema
);
export const checkProjectNavigationResponse = checker(
  ProjectNavigationResponseSchema
);
