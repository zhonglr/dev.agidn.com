import { defineComponent } from "@agidn/component-registry";
export const HeadingDefinition = defineComponent({
  name: "Heading", category: "typography", version: "1.0.0", source: "@app/ui/Heading", roles: ["primary-title", "section-title", "card-title"],
  props: { text: { type: "string", required: true }, level: { type: "enum", required: true, values: [1, 2, 3, 4, 5, 6] } },
  slots: {}, variants: ["display", "title", "section"], states: ["default"]
});
