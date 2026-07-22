import { defineComponent } from "@agidn/component-registry";
export const LinkDefinition = defineComponent({
  name: "Link", category: "actions", version: "1.0.0", source: "@app/ui/Link", roles: ["navigation-link", "footer-link"],
  props: { label: { type: "string", required: true }, href: { type: "string", required: true }, external: { type: "boolean" } },
  slots: {}, variants: ["default", "muted"], states: ["default", "disabled"]
});
