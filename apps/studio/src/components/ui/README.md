# Studio UI facade

This directory is the only place in Studio allowed to import `@react-spectrum/s2` or `react-aria-components`.

Rules:

- Export AGIDN-owned semantic props; never extend or re-export toolkit props and types.
- Prefer an existing component from the current UI toolkit for every generic control. Add an AGIDN semantic facade adapter
  instead of rebuilding buttons, menus, dialogs, disclosures, fields, pickers, tooltips, or
  collections with native elements.
- Keep theme, locale, accessibility, form, focus and ref behavior in the public contract.
- Do not add an outer element only to accept `className`.
- Keep StudioSession, PageDocument, commands, panels and canvas state outside this directory.
- Import public controls through this directory's `index.ts`; do not import implementation files directly from features.
- Low-frequency toolkit surfaces should own an overlay `StudioUiProvider` inside their lazy boundary; they must receive locale and color scheme from application state rather than creating another source of truth.
- Context menus render Spectrum Menu, Section and Submenu primitives in this facade. Their contribution registry stays outside the facade, and feature surfaces provide target capabilities that execute existing commands rather than handing session state to the menu.
- Native right click, the Context Menu key and `Shift+F10` must resolve the same target-aware menu. Closing restores focus to the trigger, and every essential action needs a non-context-menu path.
- Replace one backend implementation at a time and delete the obsolete adapter after its contract tests pass.
- Studio features use `ProductIcon` semantic names and catalog surfaces use `CatalogIcon`; only this facade may import exact `@react-spectrum/s2/icons/*` modules. Never persist Spectrum icon names in PageDocument or Project Assets.

The governing design is [Studio UI 系统架构](../../../../../docs/architecture/studio-ui-system.md), [统一图标系统](../../../../../docs/architecture/icon-system.md), and [ADR-0004](../../../../../docs/adr/0004-studio-ui-facade-and-spectrum-to-rac.md).
