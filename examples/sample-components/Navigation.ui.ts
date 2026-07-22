import { defineComponent } from "@agidn/component-registry";
export const NavigationDefinition = defineComponent({
  name: "Navigation", category: "navigation", version: "1.0.0", source: "@app/ui/Navigation", roles: ["primary-navigation"], props: { label: { type: "string", required: true } },
  slots: { items: { required: true, accepts: ["Link"], minItems: 1 } }, variants: ["header", "footer"], states: ["default", "collapsed"]
});
