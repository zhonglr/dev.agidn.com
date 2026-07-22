import type { IncomingMessage } from "node:http";

export class PayloadTooLargeError extends Error {}
export class InvalidJsonError extends Error {}

export async function readJsonBody(request: IncomingMessage, maximumBytes = 1_048_576): Promise<unknown> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    receivedBytes += buffer.byteLength;
    if (receivedBytes > maximumBytes) throw new PayloadTooLargeError(`Request body exceeds ${maximumBytes} bytes.`);
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InvalidJsonError("Request body is not valid JSON.");
  }
}
