import { resolve } from "node:path";
import { writeContextPackage, type ContextPackage } from "@agidn/context-exporter";
import type { ContextPackageWriterPort } from "../../application/ports/context-package-writer.js";

export class ContextPackageDirectoryWriter implements ContextPackageWriterPort {
  readonly outputDirectory: string;
  #writeTail: Promise<void> = Promise.resolve();

  constructor(outputDirectory: string) {
    this.outputDirectory = resolve(outputDirectory);
  }

  async write(contextPackage: ContextPackage): Promise<string> {
    const write = this.#writeTail.then(() => writeContextPackage(contextPackage, this.outputDirectory));
    this.#writeTail = write.then(() => undefined, () => undefined);
    await write;
    return this.outputDirectory;
  }
}
