import { defineComponent } from "@agidn/component-registry";
export const GridDefinition = defineComponent({
  name: "Grid", category: "layout", version: "1.0.0", source: "@app/ui/Grid", roles: ["responsive-grid"], props: {},
  slots: { content: { required: true, accepts: ["*"], minItems: 1 } }, variants: ["default"], states: ["default"]
});
