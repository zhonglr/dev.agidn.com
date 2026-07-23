import type { ReactNode } from "react";

export interface ContextMenuCapability {
  execute: () => unknown | Promise<unknown>;
  isDisabled?: boolean;
}

export interface ContextMenuTarget {
  type: string;
  id?: string;
  label?: string;
  capabilities?: Readonly<Record<string, ContextMenuCapability | undefined>>;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ContextMenuItemDescriptor {
  id: string;
  label: string;
  description?: string;
  keyboard?: string;
  icon?: ReactNode;
  isDisabled?: boolean;
  execute?: () => unknown | Promise<unknown>;
  children?: readonly ContextMenuItemDescriptor[];
}

export interface ContextMenuSectionDescriptor {
  id: string;
  label: string;
  order: number;
  items: readonly ContextMenuItemDescriptor[];
}

export interface ContextMenuContribution {
  id: string;
  targetTypes: "*" | readonly string[];
  section: { id: string; label: string; order?: number };
  order?: number;
  when?: (target: ContextMenuTarget) => boolean;
  build: (target: ContextMenuTarget) => ContextMenuItemDescriptor | undefined;
}

function supportsTarget(contribution: ContextMenuContribution, target: ContextMenuTarget): boolean {
  return contribution.targetTypes === "*" || contribution.targetTypes.includes(target.type);
}

export class ContextMenuRegistry {
  readonly #contributions = new Map<string, ContextMenuContribution>();

  constructor(contributions: readonly ContextMenuContribution[] = []) {
    for (const contribution of contributions) this.register(contribution);
  }

  register(contribution: ContextMenuContribution): () => void {
    if (this.#contributions.has(contribution.id)) {
      throw new Error(`Context menu contribution already registered: ${contribution.id}`);
    }
    this.#contributions.set(contribution.id, contribution);
    return () => this.#contributions.delete(contribution.id);
  }

  resolve(target: ContextMenuTarget): ContextMenuSectionDescriptor[] {
    const sections = new Map<string, ContextMenuSectionDescriptor>();
    const contributions = [...this.#contributions.values()]
      .filter((contribution) => supportsTarget(contribution, target) && (contribution.when?.(target) ?? true))
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));

    for (const contribution of contributions) {
      const item = contribution.build(target);
      if (!item) continue;
      const current = sections.get(contribution.section.id);
      if (current) {
        sections.set(contribution.section.id, { ...current, items: [...current.items, item] });
      } else {
        sections.set(contribution.section.id, {
          id: contribution.section.id,
          label: contribution.section.label,
          order: contribution.section.order ?? 0,
          items: [item]
        });
      }
    }

    return [...sections.values()].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id)
    );
  }
}

export function capability(
  target: ContextMenuTarget,
  name: string
): ContextMenuCapability | undefined {
  return target.capabilities?.[name];
}
