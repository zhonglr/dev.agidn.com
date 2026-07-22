import { defineComponent } from "@agidn/component-registry";
export const StackDefinition = defineComponent({
  name: "Stack", category: "layout", version: "1.0.0", source: "@app/ui/Stack", roles: ["vertical-group"], props: {},
  slots: { content: { required: true, accepts: ["*"], minItems: 1 } }, variants: ["default"], states: ["default"]
});
