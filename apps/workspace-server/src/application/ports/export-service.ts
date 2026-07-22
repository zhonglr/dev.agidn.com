import type { ExportContextRequest, ExportContextResponse } from "@agidn/api-protocol";

export interface ExportServicePort {
  exportContext(request: ExportContextRequest): Promise<ExportContextResponse>;
}
