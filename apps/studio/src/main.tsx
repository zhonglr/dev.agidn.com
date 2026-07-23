import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { initializeStudioTheme } from "./themes/index.js";
import "./styles.css";

initializeStudioTheme();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
