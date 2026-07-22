import { defineComponent } from "@agidn/component-registry";
export const ContainerDefinition = defineComponent({
  name: "Container", category: "layout", version: "1.0.0", source: "@app/ui/Container", roles: ["content-boundary"],
  props: { width: { type: "enum", values: ["sm", "md", "lg", "full"] } }, slots: { content: { required: true, accepts: ["*"], minItems: 1 } },
  variants: ["default"], states: ["default"]
});
