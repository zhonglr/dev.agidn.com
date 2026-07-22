import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { TypeCompiler, type TypeCheck } from "@sinclair/typebox/compiler";
import { PageDocumentSchema } from "@agidn/document-schema";

export const PREVIEW_PROTOCOL_VERSION = "1.0.0" as const;

const identifier = Type.String({ minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" });
const revision = Type.Integer({ minimum: 0 });
const breakpoint = Type.Union([Type.Literal("mobile"), Type.Literal("tablet"), Type.Literal("desktop")]);
const rect = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
  width: Type.Number({ minimum: 0 }),
  height: Type.Number({ minimum: 0 })
}, { additionalProperties: false });

const studioBase = Type.Object({
  source: Type.Literal("agidn.studio"),
  protocolVersion: Type.Literal(PREVIEW_PROTOCOL_VERSION),
  requestId: identifier,
  documentRevision: revision
});

const previewBase = Type.Object({
  source: Type.Literal("agidn.preview"),
  protocolVersion: Type.Literal(PREVIEW_PROTOCOL_VERSION),
  requestId: identifier,
  documentRevision: revision
});

function message<TBase extends TSchema, TPayload extends TSchema>(base: TBase, payload: TPayload) {
  return Type.Composite([base, payload], { additionalProperties: false });
}

export const StudioToPreviewMessageSchema = Type.Union([
  message(studioBase, Type.Object({
    type: Type.Literal("preview.initialize"),
    document: PageDocumentSchema,
    breakpoint,
    selectedNodeId: Type.Optional(identifier)
  })),
  message(studioBase, Type.Object({ type: Type.Literal("preview.setDocument"), document: PageDocumentSchema })),
  message(studioBase, Type.Object({ type: Type.Literal("preview.setBreakpoint"), breakpoint })),
  message(studioBase, Type.Object({ type: Type.Literal("preview.setSelection"), nodeId: Type.Optional(identifier) })),
  message(studioBase, Type.Object({ type: Type.Literal("preview.hitTest"), x: Type.Number(), y: Type.Number() })),
  message(studioBase, Type.Object({ type: Type.Literal("preview.resolveDrop"), componentRef: identifier, x: Type.Number(), y: Type.Number() })),
  message(studioBase, Type.Object({ type: Type.Literal("preview.resolveMove"), sourceNodeId: identifier, x: Type.Number(), y: Type.Number() }))
]);

export const PreviewToStudioMessageSchema = Type.Union([
  message(previewBase, Type.Object({ type: Type.Literal("preview.ready") })),
  message(previewBase, Type.Object({
    type: Type.Literal("preview.nodePointerDown"),
    nodeId: identifier,
    nodeKind: Type.Union([Type.Literal("layout"), Type.Literal("component")]),
    componentRef: Type.Optional(identifier),
    rect
  })),
  message(previewBase, Type.Object({ type: Type.Literal("preview.nodeBounds"), nodeId: identifier, rect })),
  message(previewBase, Type.Object({
    type: Type.Literal("preview.dropIntent"),
    nodeId: identifier,
    nodeKind: Type.Union([Type.Literal("layout"), Type.Literal("component")]),
    rect
  })),
  message(previewBase, Type.Object({
    type: Type.Literal("preview.moveIntent"),
    sourceNodeId: identifier,
    nodeId: identifier,
    nodeKind: Type.Union([Type.Literal("layout"), Type.Literal("component")]),
    rect,
    pointerY: Type.Number()
  })),
  message(previewBase, Type.Object({ type: Type.Literal("preview.renderError"), message: Type.String({ minLength: 1 }), nodeId: Type.Optional(identifier) })),
  message(previewBase, Type.Object({
    type: Type.Literal("preview.contentOverflow"),
    horizontal: Type.Boolean(),
    vertical: Type.Boolean(),
    contentWidth: Type.Number({ minimum: 0 }),
    contentHeight: Type.Number({ minimum: 0 })
  }))
]);

export type StudioToPreviewMessage = Static<typeof StudioToPreviewMessageSchema>;
export type PreviewToStudioMessage = Static<typeof PreviewToStudioMessageSchema>;
export type PreviewRect = Static<typeof rect>;
export type PreviewBreakpoint = Static<typeof breakpoint>;

export interface PreviewProtocolIssue {
  path: string;
  message: string;
}

export type PreviewMessageResult<T> = { valid: true; message: T } | { valid: false; issues: PreviewProtocolIssue[] };

function decoder<T>(compiled: TypeCheck<TSchema>): (input: unknown) => PreviewMessageResult<T> {
  return (input) => {
    if (compiled.Check(input)) return { valid: true, message: input as T };
    return {
      valid: false,
      issues: [...compiled.Errors(input)].map((error) => ({ path: error.path || "/", message: error.message }))
    };
  };
}

export const decodeStudioToPreviewMessage = decoder<StudioToPreviewMessage>(TypeCompiler.Compile(StudioToPreviewMessageSchema));
export const decodePreviewToStudioMessage = decoder<PreviewToStudioMessage>(TypeCompiler.Compile(PreviewToStudioMessageSchema));
