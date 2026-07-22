import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { type TokenRegistry } from "@agidn/design-tokens";
import { checkPageDocument } from "@agidn/document-schema";
import { PageRenderer } from "@agidn/react-renderer";
import pageSource from "../../../examples/golden-pricing/page.ui.json" with { type: "json" };
import tokenSource from "../../../examples/golden-pricing/tokens.json" with { type: "json" };
import { previewComponentRegistry } from "./components.js";
import "./styles.css";

const checked = checkPageDocument(pageSource);
if (!checked.valid) throw new Error(`Invalid preview document: ${checked.issues.map(({ message }) => message).join("; ")}`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PageRenderer
      document={checked.document}
      tokens={tokenSource as TokenRegistry}
      components={previewComponentRegistry}
      onAction={(actionRef, argumentsValue) => console.info("Preview action", actionRef, argumentsValue)}
    />
  </StrictMode>
);
