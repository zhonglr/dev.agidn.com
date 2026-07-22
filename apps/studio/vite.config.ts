import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: { port: 4173, strictPort: true, fs: { allow: [resolve(root, "../..")] } },
  build: { outDir: resolve(root, "../../dist/studio"), emptyOutDir: true }
});
