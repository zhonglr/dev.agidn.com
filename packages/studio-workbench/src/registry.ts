import type { ReactNode } from "react";

export type PanelLocation = "primary" | "secondary" | "bottom" | "center";

export interface PanelContribution {
  id: string;
  title: string;
  icon?: ReactNode;
  presentation?: "editor" | "tool-window";
  defaultLocation: PanelLocation;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  canClose: boolean;
  canMove: boolean;
  canDock: boolean;
  renderHeader?: () => ReactNode;
  render: () => ReactNode;
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

export class ContributionRegistry {
  readonly panels = new PanelRegistry();
  readonly inspectors = new ContributionMap<InspectorContribution>();
  readonly routes = new ContributionMap<RouteContribution>();
  readonly statusItems = new ContributionMap<StatusItemContribution>();
}
