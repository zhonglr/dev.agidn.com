import {
  decodePreviewToStudioMessage,
  decodeStudioToPreviewMessage,
  PREVIEW_PROTOCOL_VERSION
} from "@agidn/preview-protocol";
import { loadGoldenProject } from "../helpers.js";

describe("Preview postMessage protocol", () => {
  it("validates Studio messages with document revision and explicit source", async () => {
    const project = await loadGoldenProject();
    const message = {
      source: "agidn.studio",
      protocolVersion: PREVIEW_PROTOCOL_VERSION,
      requestId: "initialize_1",
      documentRevision: 3,
      type: "preview.initialize",
      document: project.document,
      breakpoint: "desktop"
    };
    expect(decodeStudioToPreviewMessage(message)).toEqual({ valid: true, message });
    expect(decodeStudioToPreviewMessage({ ...message, source: "unknown" }).valid).toBe(false);
    expect(decodeStudioToPreviewMessage({ ...message, protocolVersion: "2.0.0" }).valid).toBe(false);
    expect(decodeStudioToPreviewMessage({ ...message, directWrite: true }).valid).toBe(false);
  });

  it("validates node intent and rejects malformed bounds", () => {
    const message = {
      source: "agidn.preview",
      protocolVersion: PREVIEW_PROTOCOL_VERSION,
      requestId: "hit_2",
      documentRevision: 4,
      type: "preview.nodePointerDown",
      nodeId: "heading_hero",
      nodeKind: "component",
      componentRef: "Heading",
      rect: { x: 20, y: 40, width: 300, height: 64 }
    };
    expect(decodePreviewToStudioMessage(message)).toEqual({ valid: true, message });
    expect(decodePreviewToStudioMessage({ ...message, rect: { ...message.rect, width: -1 } }).valid).toBe(false);
    expect(decodePreviewToStudioMessage({ ...message, documentRevision: -1 }).valid).toBe(false);
  });

  it("requires measured content dimensions in overflow reports", () => {
    const report = {
      source: "agidn.preview",
      protocolVersion: PREVIEW_PROTOCOL_VERSION,
      requestId: "overflow_3",
      documentRevision: 4,
      type: "preview.contentOverflow",
      horizontal: false,
      vertical: true,
      contentWidth: 1200,
      contentHeight: 1860
    };
    expect(decodePreviewToStudioMessage(report).valid).toBe(true);
    const { contentHeight: _missing, ...incomplete } = report;
    expect(decodePreviewToStudioMessage(incomplete).valid).toBe(false);
  });
});
