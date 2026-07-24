import type { ComponentRegistry } from "@agidn/component-registry";
import {
  visitNodes,
  type ComponentNode,
  type PageDocument
} from "@agidn/document-schema";
import {
  checkProjectAssetCommand,
  type ProjectAssetCommand,
  type ProjectAssetPatch
} from "./command-schema.js";
import {
  validateProjectAssets,
  type ProjectAssetIssue,
  type ProjectAssetRegistry
} from "./index.js";

export interface ProjectAssetCommandContext {
  primitives: ComponentRegistry;
  document: PageDocument;
}

export interface ProjectAssetCommandViolation {
  code:
    | "COMMAND_INVALID"
    | "ASSET_NOT_FOUND"
    | "ASSET_IN_USE"
    | ProjectAssetIssue["code"];
  path: string;
  message: string;
}

export type ProjectAssetCommandResult =
  | {
      accepted: true;
      assets: ProjectAssetRegistry;
      command: ProjectAssetCommand;
      patch: ProjectAssetPatch;
    }
  | {
      accepted: false;
      assets: ProjectAssetRegistry;
      violations: ProjectAssetCommandViolation[];
    };

function reject(
  assets: ProjectAssetRegistry,
  violation: ProjectAssetCommandViolation
): ProjectAssetCommandResult {
  return {
    accepted: false,
    assets,
    violations: [violation]
  };
}

function documentUsesComposite(
  document: PageDocument,
  compositeId: string
): boolean {
  let used = false;
  visitNodes(document, (node) => {
    if (
      node.kind === "component" &&
      (node as ComponentNode).componentRef === compositeId
    ) {
      used = true;
    }
  });
  return used;
}

export function applyProjectAssetCommand(
  assets: ProjectAssetRegistry,
  input: unknown,
  context: ProjectAssetCommandContext
): ProjectAssetCommandResult {
  const decoded = checkProjectAssetCommand(input);
  if (!decoded.valid) {
    const issue = decoded.issues[0];
    return reject(assets, {
      code: "COMMAND_INVALID",
      path: issue?.path ?? "/",
      message: issue?.message ?? "Invalid Project Asset Command."
    });
  }

  const command = decoded.command;
  const candidate = structuredClone(assets);
  let patch: ProjectAssetPatch;
  if (command.type === "asset.composite.upsert") {
    candidate.composites[command.asset.id] = structuredClone(command.asset);
    patch = {
      protocolVersion: "2.0.0",
      commandId: command.commandId,
      operations: [
        {
          op: "asset.upsert",
          assetType: "composite",
          assetId: command.asset.id,
          version: command.asset.version
        }
      ]
    };
  } else if (command.type === "asset.pattern.upsert") {
    candidate.patterns[command.asset.id] = structuredClone(command.asset);
    patch = {
      protocolVersion: "2.0.0",
      commandId: command.commandId,
      operations: [
        {
          op: "asset.upsert",
          assetType: "pattern",
          assetId: command.asset.id,
          version: command.asset.version
        }
      ]
    };
  } else {
    const collection =
      command.assetType === "composite"
        ? candidate.composites
        : candidate.patterns;
    if (!collection[command.assetId]) {
      return reject(assets, {
        code: "ASSET_NOT_FOUND",
        path: `/${command.assetType}s/${command.assetId}`,
        message: `${command.assetType} '${command.assetId}' does not exist.`
      });
    }
    if (
      command.assetType === "composite" &&
      documentUsesComposite(context.document, command.assetId)
    ) {
      return reject(assets, {
        code: "ASSET_IN_USE",
        path: `/composites/${command.assetId}`,
        message: `Composite '${command.assetId}' is referenced by the current PageDocument.`
      });
    }
    delete collection[command.assetId];
    patch = {
      protocolVersion: "2.0.0",
      commandId: command.commandId,
      operations: [
        {
          op: "asset.remove",
          assetType: command.assetType,
          assetId: command.assetId
        }
      ]
    };
  }

  const validation = validateProjectAssets(candidate, context.primitives);
  if (!validation.valid) {
    return {
      accepted: false,
      assets,
      violations: validation.issues
    };
  }
  return {
    accepted: true,
    assets: validation.assets,
    command,
    patch
  };
}
