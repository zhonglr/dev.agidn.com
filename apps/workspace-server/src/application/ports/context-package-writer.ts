import type { ContextPackage } from "@agidn/context-exporter";

export interface ContextPackageWriterPort {
  write(contextPackage: ContextPackage): Promise<string>;
}
