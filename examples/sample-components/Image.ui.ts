import { defineComponent } from "@agidn/component-registry";
export const ImageDefinition = defineComponent({
  name: "Image", category: "media", version: "1.0.0", source: "@app/ui/Image", roles: ["hero-media", "content-media"],
  props: { src: { type: "string", required: true }, alt: { type: "string", required: true } }, slots: {}, variants: ["default", "rounded"], states: ["default", "loading", "error"]
});
