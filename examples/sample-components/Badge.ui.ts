import { defineComponent } from "@agidn/component-registry";
export const BadgeDefinition = defineComponent({
  name: "Badge", category: "content", version: "1.0.0", source: "@app/ui/Badge", roles: ["label", "plan-highlight"],
  props: { label: { type: "string", required: true } }, slots: {}, variants: ["default", "accent", "success"], states: ["default"]
});
