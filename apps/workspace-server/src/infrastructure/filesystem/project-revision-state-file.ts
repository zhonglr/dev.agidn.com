import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink
} from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  join,
  resolve
} from "node:path";
import { stableJson } from "@agidn/document-codec";
import type { ProjectRevisionStoreState } from "@agidn/document-engine";
import type { ProjectRevisionStatePersistencePort } from "../../application/ports/project-revision-state-persistence.js";

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function defaultProjectRevisionStatePath(
  documentPath: string
): string {
  const absoluteDocumentPath = resolve(documentPath);
  const extension = extname(absoluteDocumentPath);
  const documentName = basename(absoluteDocumentPath, extension);
  return join(
    dirname(absoluteDocumentPath),
    ".revision-store",
    `${documentName}.project-revisions.json`
  );
}

export class AtomicJsonProjectRevisionStateFile
  implements ProjectRevisionStatePersistencePort
{
  readonly path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  async load(): Promise<unknown | undefined> {
    try {
      return JSON.parse(
        await readFile(this.path, "utf8")
      ) as unknown;
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
  }

  async save(state: ProjectRevisionStoreState): Promise<void> {
    const directory = dirname(this.path);
    await mkdir(directory, { recursive: true });
    const temporaryPath = join(
      directory,
      `.${basename(this.path)}.${process.pid}.${randomUUID()}.tmp`
    );
    let handle: FileHandle | undefined = await open(
      temporaryPath,
      "wx",
      0o600
    );
    try {
      await handle.writeFile(stableJson(state), "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporaryPath, this.path);
      const directoryHandle = await open(directory, "r");
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
    } finally {
      if (handle) await handle.close().catch(() => undefined);
      await unlink(temporaryPath).catch((error: unknown) => {
        if (!isMissingFile(error)) throw error;
      });
    }
  }
}
