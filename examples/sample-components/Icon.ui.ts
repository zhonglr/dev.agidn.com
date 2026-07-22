import { defineComponent } from "@agidn/component-registry";
export const IconDefinition = defineComponent({
  name: "Icon", category: "media", version: "1.0.0", source: "@app/ui/Icon", roles: ["decoration", "status-icon"],
  props: { name: { type: "string", required: true }, decorative: { type: "boolean" } }, slots: {}, variants: ["default", "success", "danger"], states: ["default"]
});
