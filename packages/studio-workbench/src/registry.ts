import type { ReactNode } from "react";

export type PanelLocation = "primary" | "secondary" | "bottom" | "center";

export interface PanelContribution {
  id: string;
  title: string;
  icon?: ReactNode;
  defaultLocation: PanelLocation;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  canClose: boolean;
  canMove: boolean;
  canDock: boolean;
  render: () => ReactNode;
}

export interface CommandContribution {
  id: string;
  title: string;
  category?: string;
  keybinding?: string;
  execute: () => void | Promise<void>;
}

export interface InspectorContribution {
  id: string;
  title: string;
  render: () => ReactNode;
}

export interface RouteContribution {
  id: string;
  title: string;
  path: string;
  render: () => ReactNode;
}

export interface StatusItemContribution {
  id: string;
  alignment: "left" | "right";
  priority?: number;
  render: () => ReactNode;
}

class ContributionMap<Value extends { id: string }> {
  readonly #items = new Map<string, Value>();

  register(item: Value): () => void {
    if (this.#items.has(item.id)) throw new Error(`Contribution '${item.id}' is already registered.`);
    this.#items.set(item.id, item);
    return () => this.#items.delete(item.id);
  }

  get(id: string): Value | undefined {
    return this.#items.get(id);
  }

  list(): Value[] {
    return [...this.#items.values()];
  }
}

export class PanelRegistry extends ContributionMap<PanelContribution> {
  constructor(contributions: readonly PanelContribution[] = []) {
    super();
    contributions.forEach((contribution) => this.register(contribution));
  }
}

export class CommandRegistry extends ContributionMap<CommandContribution> {
  constructor(contributions: readonly CommandContribution[] = []) {
    super();
    contributions.forEach((contribution) => this.register(contribution));
  }

  override register(command: CommandContribution): () => void {
    const normalizedKeybinding = command.keybinding?.toLowerCase();
    if (normalizedKeybinding) {
      const conflict = this.list().find((candidate) => candidate.keybinding?.toLowerCase() === normalizedKeybinding);
      if (conflict) throw new Error(`Keybinding '${command.keybinding}' conflicts with command '${conflict.id}'.`);
    }
    return super.register(command);
  }

  async execute(id: string): Promise<void> {
    const command = this.get(id);
    if (!command) throw new Error(`Command '${id}' is not registered.`);
    await command.execute();
  }
}

export class ContributionRegistry {
  readonly panels = new PanelRegistry();
  readonly commands = new CommandRegistry();
  readonly inspectors = new ContributionMap<InspectorContribution>();
  readonly routes = new ContributionMap<RouteContribution>();
  readonly statusItems = new ContributionMap<StatusItemContribution>();
}
