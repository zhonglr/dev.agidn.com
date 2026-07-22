import { Type, type Static } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

export const SCHEMA_VERSION = "1.0.0" as const;

const IdentifierSchema = Type.String({ minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" });
const TokenReferenceSchema = Type.String({
  minLength: 3,
  pattern: "^[a-z][a-z0-9-]*(?:\\.[a-z][a-z0-9-]*)+$"
});

export const ResponsiveColumnsSchema = Type.Object(
  {
    mobile: Type.Optional(Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3), Type.Literal(4), Type.Literal(6), Type.Literal(12)])),
    tablet: Type.Optional(Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3), Type.Literal(4), Type.Literal(6), Type.Literal(12)])),
    desktop: Type.Optional(Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3), Type.Literal(4), Type.Literal(6), Type.Literal(12)]))
  },
  { additionalProperties: false }
);

const AccessibilitySchema = Type.Object(
  {
    label: Type.Optional(Type.String({ minLength: 1 })),
    describedBy: Type.Optional(IdentifierSchema),
    decorative: Type.Optional(Type.Boolean())
  },
  { additionalProperties: false }
);

const InteractionSchema = Type.Object(
  {
    event: Type.Union([Type.Literal("press"), Type.Literal("change"), Type.Literal("submit"), Type.Literal("open"), Type.Literal("close")]),
    actionRef: IdentifierSchema,
    arguments: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
  },
  { additionalProperties: false }
);

export const PageNodeSchema = Type.Recursive(
  (Node) =>
    Type.Union([
      Type.Object(
        {
          id: IdentifierSchema,
          kind: Type.Literal("layout"),
          role: Type.Optional(IdentifierSchema),
          name: Type.Optional(Type.String({ minLength: 1 })),
          layout: Type.Union([
            Type.Literal("section"),
            Type.Literal("container"),
            Type.Literal("stack"),
            Type.Literal("row"),
            Type.Literal("grid"),
            Type.Literal("overlay")
          ]),
          width: Type.Optional(Type.Union([Type.Literal("sm"), Type.Literal("md"), Type.Literal("lg"), Type.Literal("full")])),
          gapToken: Type.Optional(TokenReferenceSchema),
          align: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("center"), Type.Literal("end"), Type.Literal("stretch")])),
          columns: Type.Optional(ResponsiveColumnsSchema),
          overlay: Type.Optional(
            Type.Object(
              {
                purpose: Type.Union([Type.Literal("badge"), Type.Literal("decoration"), Type.Literal("content-overlay")]),
                anchor: Type.Union([
                  Type.Literal("top-start"), Type.Literal("top-end"), Type.Literal("bottom-start"), Type.Literal("bottom-end"), Type.Literal("center")
                ]),
                boundary: Type.Union([Type.Literal("parent"), Type.Literal("viewport")]),
                offsetToken: TokenReferenceSchema,
                collision: Type.Optional(Type.Union([Type.Literal("flip"), Type.Literal("shift"), Type.Literal("hide"), Type.Literal("none")]))
              },
              { additionalProperties: false }
            )
          ),
          children: Type.Array(Node)
        },
        { additionalProperties: false }
      ),
      Type.Object(
        {
          id: IdentifierSchema,
          kind: Type.Literal("component"),
          role: Type.Optional(IdentifierSchema),
          name: Type.Optional(Type.String({ minLength: 1 })),
          componentRef: IdentifierSchema,
          variant: Type.Optional(IdentifierSchema),
          state: Type.Optional(IdentifierSchema),
          props: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
          tokens: Type.Optional(Type.Record(Type.String(), TokenReferenceSchema)),
          slots: Type.Optional(Type.Record(Type.String(), Type.Array(Node))),
          interactions: Type.Optional(Type.Array(InteractionSchema)),
          accessibility: Type.Optional(AccessibilitySchema)
        },
        { additionalProperties: false }
      )
    ]),
  { $id: "PageNode" }
);

export const PageDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(SCHEMA_VERSION),
    id: IdentifierSchema,
    kind: Type.Literal("page"),
    role: IdentifierSchema,
    name: Type.Optional(Type.String({ minLength: 1 })),
    children: Type.Array(PageNodeSchema, { minItems: 1 })
  },
  { $id: "PageDocument", additionalProperties: false }
);

export type PageDocument = Static<typeof PageDocumentSchema>;
export type PageNode = Static<typeof PageNodeSchema>;
export type LayoutNode = Extract<PageNode, { kind: "layout" }>;
export type ComponentNode = Extract<PageNode, { kind: "component" }>;
export type NodeId = string;
export type TokenReference = string;

const compiledPageDocument = TypeCompiler.Compile(PageDocumentSchema);

export interface SchemaIssue {
  path: string;
  message: string;
}

export function checkPageDocument(value: unknown): { valid: true; document: PageDocument } | { valid: false; issues: SchemaIssue[] } {
  if (compiledPageDocument.Check(value)) {
    return { valid: true, document: value };
  }

  return {
    valid: false,
    issues: [...compiledPageDocument.Errors(value)].map((error) => ({
      path: error.path || "/",
      message: error.message
    }))
  };
}

export function visitNodes(document: PageDocument, visitor: (node: PageNode, parent?: PageNode) => void): void {
  const visit = (node: PageNode, parent?: PageNode): void => {
    visitor(node, parent);
    if (node.kind === "layout") {
      node.children.forEach((child) => visit(child, node));
    } else {
      Object.values(node.slots ?? {}).flat().forEach((child) => visit(child, node));
    }
  };
  document.children.forEach((node) => visit(node));
}

export function findNode(document: PageDocument, nodeId: NodeId): PageNode | undefined {
  let found: PageNode | undefined;
  visitNodes(document, (node) => {
    if (node.id === nodeId) found = node;
  });
  return found;
}
