import { defineComponent } from "@agidn/component-registry";
export const CardDefinition = defineComponent({
  name: "Card", category: "content", version: "1.0.0", source: "@app/ui/Card", roles: ["content-card"], props: {},
  slots: { content: { required: true, accepts: ["*"], minItems: 1 } }, variants: ["default", "outlined", "elevated"], states: ["default", "loading"]
});
