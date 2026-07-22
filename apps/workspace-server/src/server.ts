#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { createWorkspaceServerApplication } from "./composition-root.js";

export async function startWorkspaceServer(documentPath: string, port = 4178): Promise<void> {
  const application = await createWorkspaceServerApplication(documentPath);
  application.httpServer.listen(port, "127.0.0.1", () => {
    console.log(`Workspace Server listening on http://127.0.0.1:${port}`);
    console.log(`PageDocument: ${application.project.documentPath}`);
    console.log(`Revision Store: ${application.revisionStatePath}`);
    console.log(`Context Export: ${application.contextOutputDirectory}`);
  });
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const documentPath = process.argv[2];
  const port = process.argv[3] ? Number(process.argv[3]) : 4178;
  if (!documentPath || !Number.isInteger(port) || port < 1 || port > 65_535) {
    console.error("Usage: pnpm workspace-server <page.ui.json> [port]");
    process.exitCode = 2;
  } else {
    startWorkspaceServer(documentPath, port).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}
