import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    port: 4174,
    strictPort: true,
    // The preview runs in a script-only sandbox, so its document has an opaque
    // origin and module requests are sent with `Origin: null`.
    cors: { origin: "null" },
    fs: { allow: [resolve(root, "../..")] }
  },
  build: { outDir: resolve(root, "../../dist/preview-host"), emptyOutDir: true }
});
