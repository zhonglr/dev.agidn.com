import type { ExportContextRequest, ExportContextResponse } from "@agidn/api-protocol";
import { createContextPackage } from "@agidn/context-exporter";
import type { WorkspaceCatalog } from "./catalog-service.js";
import type { ContextPackageWriterPort } from "./ports/context-package-writer.js";
import type { ExportServicePort } from "./ports/export-service.js";
import type { WorkspaceProjectRevisionStorePort } from "./ports/project-revision-store.js";
import { composeProjectComponentRegistry } from "@agidn/project-assets";

export class ExportService implements ExportServicePort {
  constructor(
    private readonly store: WorkspaceProjectRevisionStorePort,
    private readonly catalog: WorkspaceCatalog,
    private readonly writer: ContextPackageWriterPort
  ) {}

  async exportContext(request: ExportContextRequest): Promise<ExportContextResponse> {
    const requestedRevision = request.revision ?? this.store.currentRevision;
    const revision = this.store.getRevision(requestedRevision);
    if (!revision) {
      return {
        protocolVersion: "2.0.0",
        ok: false,
        error: "REVISION_NOT_FOUND",
        requestedRevision,
        currentRevision: this.store.currentRevision
      };
    }

    const contextPackage = createContextPackage({
      document: revision.project.document,
      components: composeProjectComponentRegistry(
        this.catalog.primitiveComponents,
        revision.project.assets
      ),
      tokens: this.catalog.tokens,
      policies: this.catalog.policies,
      actions: this.catalog.actions,
      constraints: this.catalog.constraints,
      assets: revision.project.assets
    });
    const outputDirectory = await this.writer.write(contextPackage);
    return {
      protocolVersion: "2.0.0",
      ok: true,
      revision: revision.revision,
      outputDirectory,
      manifest: contextPackage.manifest
    };
  }
}
