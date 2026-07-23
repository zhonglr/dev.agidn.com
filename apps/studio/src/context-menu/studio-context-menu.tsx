import { ProductIcon } from "../components/ui/product-icon.js";
import type { Translate } from "../i18n/types.js";
import {
  capability,
  ContextMenuRegistry,
  type ContextMenuContribution,
  type ContextMenuItemDescriptor,
  type ContextMenuTarget
} from "./registry.js";

function capabilityItem(
  target: ContextMenuTarget,
  name: string,
  item: Omit<ContextMenuItemDescriptor, "execute" | "isDisabled">
): ContextMenuItemDescriptor | undefined {
  const action = capability(target, name);
  return action
    ? { ...item, execute: action.execute, ...(action.isDisabled === undefined ? {} : { isDisabled: action.isDisabled }) }
    : undefined;
}

export function createStudioContextMenuRegistry(
  t: Translate,
  keybindingFor?: (actionId: string) => string | undefined
): ContextMenuRegistry {
  const editSection = { id: "edit", label: t("contextMenu.edit"), order: 10 };
  const navigationSection = { id: "navigation", label: t("contextMenu.navigation"), order: 20 };
  const viewSection = { id: "view", label: t("contextMenu.view"), order: 30 };
  const destructiveSection = { id: "destructive", label: t("contextMenu.destructive"), order: 90 };

  const contributions: ContextMenuContribution[] = [
    {
      id: "studio.context.activate",
      targetTypes: ["page"],
      section: navigationSection,
      order: 10,
      build: (target) =>
        capabilityItem(target, "activate", {
          id: "activate",
          label: t("contextMenu.openPage"),
          icon: <ProductIcon name="canvas" />
        })
    },
    {
      id: "studio.context.newPage",
      targetTypes: ["page", "canvas"],
      section: navigationSection,
      order: 20,
      build: (target) =>
        capabilityItem(target, "createPage", {
          id: "create-page",
          label: t("contextMenu.newPage"),
          icon: <ProductIcon name="add" />
        })
    },
    {
      id: "studio.context.selectNode",
      targetTypes: ["node"],
      section: editSection,
      order: 10,
      build: (target) =>
        capabilityItem(target, "select", {
          id: "select-node",
          label: t("contextMenu.selectNode"),
          icon: <ProductIcon name="outline" />
        })
    },
    {
      id: "studio.context.editComponent",
      targetTypes: ["custom-component"],
      section: editSection,
      order: 10,
      build: (target) =>
        capabilityItem(target, "edit", {
          id: "edit-component",
          label: t("contextMenu.editComponent"),
          icon: <ProductIcon name="settings" />
        })
    },
    {
      id: "studio.context.copyIdentifier",
      targetTypes: "*",
      section: editSection,
      order: 50,
      when: (target) => Boolean(target.id),
      build: (target) => ({
        id: "copy-identifier",
        label: t("contextMenu.copyIdentifier"),
        description: target.id!,
        icon: <ProductIcon name="commands" />,
        execute: () => navigator.clipboard.writeText(target.id!)
      })
    },
    {
      id: "studio.context.history",
      targetTypes: ["canvas"],
      section: editSection,
      order: 20,
      build: (target) => {
        const undoKeyboard = keybindingFor?.("document.undo");
        const redoKeyboard = keybindingFor?.("document.redo");
        const undo = capabilityItem(target, "undo", {
          id: "undo",
          label: t("actions.undo"),
          ...(undoKeyboard ? { keyboard: undoKeyboard } : {}),
          icon: <ProductIcon name="undo" />
        });
        const redo = capabilityItem(target, "redo", {
          id: "redo",
          label: t("actions.redo"),
          ...(redoKeyboard ? { keyboard: redoKeyboard } : {}),
          icon: <ProductIcon name="redo" />
        });
        const children = [undo, redo].filter((item): item is ContextMenuItemDescriptor => Boolean(item));
        return children.length
          ? {
              id: "history",
              label: t("contextMenu.history"),
              icon: <ProductIcon name="history" />,
              children
            }
          : undefined;
      }
    },
    {
      id: "studio.context.view",
      targetTypes: ["canvas", "node"],
      section: viewSection,
      order: 10,
      build: (target) => {
        const fitPage = capabilityItem(target, "fitPage", {
          id: "fit-page",
          label: t("canvas.fitPage"),
          icon: <ProductIcon name="canvas" />
        });
        const fitSelection = capabilityItem(target, "fitSelection", {
          id: "fit-selection",
          label: t("canvas.fitSelection"),
          icon: <ProductIcon name="outline" />
        });
        const children = [fitPage, fitSelection].filter(
          (item): item is ContextMenuItemDescriptor => Boolean(item)
        );
        return children.length
          ? {
              id: "view-actions",
              label: t("contextMenu.view"),
              icon: <ProductIcon name="canvas" />,
              children
            }
          : undefined;
      }
    },
    {
      id: "studio.context.closePage",
      targetTypes: ["page"],
      section: destructiveSection,
      order: 10,
      build: (target) =>
        capabilityItem(target, "close", {
          id: "close-page",
          label: t("contextMenu.closePage"),
          icon: <ProductIcon name="close" />
        })
    },
    {
      id: "studio.context.remove",
      targetTypes: ["node", "custom-component", "saved-component"],
      section: destructiveSection,
      order: 20,
      build: (target) =>
        capabilityItem(target, "remove", {
          id: "remove",
          label: t("contextMenu.remove"),
          icon: <ProductIcon name="close" />
        })
    }
  ];

  return new ContextMenuRegistry(contributions);
}
