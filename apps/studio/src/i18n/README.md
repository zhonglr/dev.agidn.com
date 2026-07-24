# Studio internationalization

The Studio i18n boundary is split by responsibility:

- `en-US.ts` is the source catalog and defines the compile-time message shape.
- `zh-CN.ts` must satisfy the same catalog shape.
- `types.ts` owns typed message keys, descriptors and localized errors.
- `runtime.ts` owns locale validation, catalog lookup, fallback and interpolation.
- `structure-drag.ts` maps stable domain error codes to visible messages.
- `../i18n.tsx` only connects the runtime to React and resolves distribution configuration.

## Adding a message

1. Put the message in the relevant feature namespace in `en-US.ts`.
2. Add the same key and interpolation variables to every other locale.
3. Render it with `t("namespace.key")`; asynchronous errors should be stored as a `MessageDescriptor` and rendered with `format()`.
4. Run `pnpm test`. The i18n contract rejects missing keys, mismatched placeholders, raw English JSX labels and incomplete Foundation Catalog display metadata.

Component, property, slot and variant names are project metadata, not Studio chrome. Their translations belong in Component Registry `displayName` metadata, including each variant's own `displayName`. Theme/plugin names and document content remain external metadata and are not translated by Studio.
