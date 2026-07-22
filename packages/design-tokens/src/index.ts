export type TokenType = "color" | "spacing" | "radius" | "typography" | "shadow" | "size";

export interface TokenDefinition {
  type: TokenType;
  value: string;
  description?: string;
}

export interface TokenRegistry {
  version: string;
  tokens: Record<string, TokenDefinition>;
}

export function isTokenReference(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(value);
}

export function hasToken(registry: TokenRegistry, reference: string, expectedType?: TokenType): boolean {
  const token = registry.tokens[reference];
  return token !== undefined && (expectedType === undefined || token.type === expectedType);
}

export function selectTokens(registry: TokenRegistry, references: Iterable<string>): TokenRegistry {
  const selected: Record<string, TokenDefinition> = {};
  for (const reference of [...new Set(references)].sort()) {
    const token = registry.tokens[reference];
    if (token) selected[reference] = token;
  }
  return { version: registry.version, tokens: selected };
}
