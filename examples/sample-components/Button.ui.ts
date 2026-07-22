import { defineComponent } from "@agidn/component-registry";

export const ButtonDefinition = defineComponent({
  name: "Button", displayName: { "en-US": "Button", "zh-CN": "按钮" }, category: "actions", version: "1.0.0", source: "@app/ui/Button", roles: ["primary-action", "secondary-action"],
  props: { label: { type: "string", required: true }, iconOnly: { type: "boolean" }, disabled: { type: "boolean" } },
  slots: {
    leading: { displayName: "Leading icon", accepts: ["Icon"], maxItems: 1 },
    content: { displayName: "Content", accepts: ["Text"], maxItems: 1 },
    trailing: { displayName: "Trailing icon", accepts: ["Icon"], maxItems: 1 }
  }, variants: ["primary", "secondary", "danger", "ghost"], states: ["default", "disabled", "loading"],
  accessibleName: "when-icon-only"
});
