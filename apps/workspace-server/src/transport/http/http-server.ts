import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  checkCommitCommandsResponse,
  checkGetDocumentResponse,
  checkNavigationResponse,
  decodeCommitCommandsRequest,
  decodeNavigationRequest,
  type ProtocolErrorResponse,
  type TransportErrorResponse
} from "@agidn/api-protocol";
import type { DocumentServicePort } from "../../application/ports/document-service.js";
import { InvalidJsonError, PayloadTooLargeError, readJsonBody } from "./json-body.js";

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload)}\n`);
}

function transportError(error: TransportErrorResponse["error"], message: string): TransportErrorResponse {
  return { protocolVersion: "1.0.0", ok: false, error, message };
}

function protocolError(issues: ProtocolErrorResponse["issues"]): ProtocolErrorResponse {
  return { protocolVersion: "1.0.0", ok: false, error: "PROTOCOL_INVALID", issues };
}

function statusForApplicationResponse(response: { ok: boolean; error?: string }): number {
  if (response.ok) return 200;
  if (response.error === "REVISION_CONFLICT") return 409;
  return 422;
}

async function route(request: IncomingMessage, response: ServerResponse, service: DocumentServicePort): Promise<void> {
  const path = new URL(request.url ?? "/", "http://workspace.local").pathname;
  if (path === "/v1/document" && request.method === "GET") {
    const payload = service.getCurrent();
    if (!checkGetDocumentResponse(payload)) throw new Error("DocumentService returned an invalid GetDocument response.");
    sendJson(response, 200, payload);
    return;
  }

  if (path === "/v1/commands" && request.method === "POST") {
    const decoded = decodeCommitCommandsRequest(await readJsonBody(request));
    if (!decoded.valid) {
      sendJson(response, 400, protocolError(decoded.issues));
      return;
    }
    const payload = await service.commit(decoded.value);
    if (!checkCommitCommandsResponse(payload)) throw new Error("DocumentService returned an invalid Commit response.");
    sendJson(response, statusForApplicationResponse(payload), payload);
    return;
  }

  if ((path === "/v1/undo" || path === "/v1/redo") && request.method === "POST") {
    const decoded = decodeNavigationRequest(await readJsonBody(request));
    if (!decoded.valid) {
      sendJson(response, 400, protocolError(decoded.issues));
      return;
    }
    const payload = await (path === "/v1/undo" ? service.undo(decoded.value) : service.redo(decoded.value));
    if (!checkNavigationResponse(payload)) throw new Error("DocumentService returned an invalid Navigation response.");
    sendJson(response, statusForApplicationResponse(payload), payload);
    return;
  }

  const knownPath = ["/v1/document", "/v1/commands", "/v1/undo", "/v1/redo"].includes(path);
  sendJson(
    response,
    knownPath ? 405 : 404,
    transportError(knownPath ? "METHOD_NOT_ALLOWED" : "NOT_FOUND", knownPath ? "Method is not allowed for this endpoint." : "Endpoint was not found.")
  );
}

export function createWorkspaceHttpServer(service: DocumentServicePort): Server {
  return createServer((request, response) => {
    route(request, response, service).catch((error: unknown) => {
      if (error instanceof PayloadTooLargeError) {
        sendJson(response, 413, transportError("PAYLOAD_TOO_LARGE", error.message));
      } else if (error instanceof InvalidJsonError) {
        sendJson(response, 400, transportError("INVALID_JSON", error.message));
      } else {
        sendJson(response, 500, transportError("INTERNAL_ERROR", "Workspace Server failed to process the request."));
      }
    });
  });
}
