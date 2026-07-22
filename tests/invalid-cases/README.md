# Illegal operation matrix

All entries are blocking errors (`severity: error`) with no manual approval path. The JSON fixtures carry the expected stable error code and the command that must be rejected; the rule result supplies the message and machine-readable suggestions.

| Fixture | Error code | Rejection message | Legal replacement | Approval |
| --- | --- | --- | --- | --- |
| `raw-color.json` | `RAW_COLOR_FORBIDDEN` | Raw colors cannot enter component props. | Use a registered color token. | Never |
| `raw-spacing.json` | `RAW_SPACING_FORBIDDEN` | Raw spacing cannot enter layout properties. | Use a registered spacing token. | Never |
| `absolute-position.json` | `ABSOLUTE_POSITION_FORBIDDEN` | Normal nodes cannot use coordinates. | Use a controlled Overlay. | Never |
| `unknown-component.json` | `UNKNOWN_COMPONENT` | The component is absent from the registry. | Select a registered component. | Never |
| `unknown-prop.json` | `UNKNOWN_PROP` | The prop is absent from the component definition. | Use a registered prop or extend the definition in code. | Never |
| `invalid-slot.json` | `INVALID_SLOT` | The target slot is absent from the component definition. | Insert into a registered compatible slot. | Never |
| `missing-responsive-rule.json` | `MISSING_RESPONSIVE_RULE` | Grid omits a semantic responsive mode. | Declare mobile, tablet and desktop columns. | Never |
| `invalid-overlay.json` | `INVALID_OVERLAY` | Overlay metadata is incomplete. | Declare purpose, anchor, boundary and token offset. | Never |
| `missing-aria-label.json` | `ACCESSIBLE_NAME_REQUIRED` | An icon-only control has no accessible name. | Set `accessibility.label`. | Never |
| `unknown-variant.json` | `UNKNOWN_VARIANT` | The variant is absent from the component definition. | Select a registered variant. | Never |
