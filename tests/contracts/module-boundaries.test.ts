import { readFile, readdir } from "node:fs/promises";
import { resolve, sep } from "node:path";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(resolve(directory), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

describe("module dependency boundaries", () => {
  it("keeps Studio UI toolkit imports behind the UI facade", async () => {
    const facadeDirectory = `${resolve("apps/studio/src/components/ui")}${sep}`;
    const toolkitImport = /(?:from\s+|import\s*(?:\(\s*)?)["'](?:@react-spectrum\/s2(?:\/[^"']*)?|react-aria-components)["']/;
    const legacySpectrumImport = /(?:from\s+|import\s*(?:\(\s*)?)["']@adobe\/react-spectrum(?:\/[^"']*)?["']/;
    const studioFiles = await sourceFiles("apps/studio/src");
    const workbenchFiles = await sourceFiles("packages/studio-workbench/src");
    const studioViolations = (await Promise.all(studioFiles.map(async (file) => ({
      file,
      source: await readFile(file, "utf8")
    })))).filter(({ file, source }) => legacySpectrumImport.test(source) || (!file.startsWith(facadeDirectory) && toolkitImport.test(source)));
    const workbenchViolations = (await Promise.all(workbenchFiles.map(async (file) => ({
      file,
      source: await readFile(file, "utf8")
    })))).filter(({ source }) => toolkitImport.test(source) || legacySpectrumImport.test(source));

    expect([...studioViolations, ...workbenchViolations].map(({ file }) => file)).toEqual([]);
  });

  it("keeps document-schema free of internal business dependencies", async () => {
    const files = await sourceFiles("packages/document-schema/src");
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    expect(sources.join("\n")).not.toMatch(/from ["']@agidn\//);
  });

  it("keeps command handlers independent of persistence and concrete registries", async () => {
    const files = await sourceFiles("packages/command-engine/src/handlers");
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const combined = sources.join("\n");
    expect(combined).not.toMatch(/@agidn\/document-engine/);
    expect(combined).not.toMatch(/@agidn\/component-registry/);
    expect(combined).not.toMatch(/@agidn\/design-tokens/);
    expect(combined).not.toMatch(/apps\/workspace-server/);
  });

  it("keeps document-engine independent of transport and filesystem code", async () => {
    const files = await sourceFiles("packages/document-engine/src");
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const combined = sources.join("\n");
    expect(combined).not.toMatch(/node:fs|node:http|node:net/);
    expect(combined).not.toMatch(/apps\/workspace-server/);
  });

  it("keeps HTTP transport dependent on the application port, not domain engines", async () => {
    const files = await sourceFiles("apps/workspace-server/src/transport");
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const combined = sources.join("\n");
    expect(combined).not.toMatch(/@agidn\/document-engine/);
    expect(combined).not.toMatch(/@agidn\/rule-engine/);
    expect(combined).not.toMatch(/infrastructure\/filesystem/);
  });

  it("keeps the application layer independent of HTTP and filesystem adapters", async () => {
    const files = await sourceFiles("apps/workspace-server/src/application");
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const combined = sources.join("\n");
    expect(combined).not.toMatch(/node:http|node:fs/);
    expect(combined).not.toMatch(/transport\/|infrastructure\//);
  });
});
