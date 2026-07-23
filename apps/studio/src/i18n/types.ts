import type { enUS } from "./en-US.js";

type WidenStrings<Value> = Value extends string
  ? string
  : Value extends Readonly<Record<string, unknown>>
    ? { readonly [Key in keyof Value]: WidenStrings<Value[Key]> }
    : never;

type LeafKeys<Value> = {
  [Key in keyof Value & string]: Value[Key] extends string
    ? Key
    : Value[Key] extends Readonly<Record<string, unknown>>
      ? `${Key}.${LeafKeys<Value[Key]>}`
      : never
}[keyof Value & string];

export type MessageCatalog = WidenStrings<typeof enUS>;
export type MessageKey = LeafKeys<MessageCatalog>;
export type MessageVariables = Readonly<Record<string, string | number>>;

export interface MessageDescriptor {
  key: MessageKey;
  variables?: MessageVariables;
}

export type Translate = (key: MessageKey, variables?: MessageVariables) => string;

export function message(key: MessageKey, variables?: MessageVariables): MessageDescriptor {
  return { key, ...(variables ? { variables } : {}) };
}

export class LocalizedMessageError extends Error {
  constructor(readonly descriptor: MessageDescriptor) {
    super(descriptor.key);
  }
}

export function messageError(key: MessageKey, variables?: MessageVariables): LocalizedMessageError {
  return new LocalizedMessageError(message(key, variables));
}

export function messageFromError(error: unknown, fallback: MessageKey): MessageDescriptor {
  return error instanceof LocalizedMessageError ? error.descriptor : message(fallback);
}
