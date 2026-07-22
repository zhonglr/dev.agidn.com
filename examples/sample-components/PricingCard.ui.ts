import { defineComponent } from "@agidn/component-registry";
export const PricingCardDefinition = defineComponent({
  name: "PricingCard", category: "commerce", version: "1.0.0", source: "@app/billing/PricingCard", roles: ["pricing-plan"],
  props: {
    planName: { type: "string", required: true }, price: { type: "string", required: true }, featured: { type: "boolean" }
  },
  slots: {
    description: { required: true, accepts: ["Text"], minItems: 1, maxItems: 1 },
    features: { required: true, accepts: ["Text"], minItems: 1 },
    action: { required: true, accepts: ["Button", "Link"], minItems: 1, maxItems: 1 },
    badge: { accepts: ["Badge"], maxItems: 1 }
  },
  variants: ["default", "featured"], states: ["default", "loading", "disabled"]
});
