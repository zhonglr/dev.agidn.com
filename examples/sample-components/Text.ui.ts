import { defineComponent } from "@agidn/component-registry";
export const TextDefinition = defineComponent({
  name: "Text", version: "1.0.0", source: "@app/ui/Text", roles: ["body", "description", "feature"],
  props: { text: { type: "string", required: true } }, slots: {}, variants: ["body", "muted", "emphasis"], states: ["default"]
});
