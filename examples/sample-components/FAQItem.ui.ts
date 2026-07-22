import { defineComponent } from "@agidn/component-registry";
export const FAQItemDefinition = defineComponent({
  name: "FAQItem", version: "1.0.0", source: "@app/marketing/FAQItem", roles: ["faq-item"],
  props: { question: { type: "string", required: true }, answer: { type: "string", required: true } }, slots: {}, variants: ["default"], states: ["closed", "open"]
});
