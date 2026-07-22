import { defineComponent } from "@agidn/component-registry";

export const ButtonDefinition = defineComponent({
  name: "Button", version: "1.0.0", source: "@app/ui/Button", roles: ["primary-action", "secondary-action"],
  props: { label: { type: "string", required: true }, iconOnly: { type: "boolean" }, disabled: { type: "boolean" } },
  slots: {}, variants: ["primary", "secondary", "danger", "ghost"], states: ["default", "disabled", "loading"],
  accessibleName: "when-icon-only"
});
