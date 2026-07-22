import { defineComponent } from "@agidn/component-registry";
export const RowDefinition = defineComponent({
  name: "Row", version: "1.0.0", source: "@app/ui/Row", roles: ["horizontal-group"], props: {},
  slots: { content: { required: true, accepts: ["*"], minItems: 1 } }, variants: ["default"], states: ["default"]
});
