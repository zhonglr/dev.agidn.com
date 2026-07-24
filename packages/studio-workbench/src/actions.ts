import { useEffect, useRef } from "react";

export interface KeyStroke {
  /** Normalized key: single character lowercased, or a named key such as "escape", "f6", "arrowdown". */
  key: string;
  /** Platform primary modifier: Command on macOS, Control elsewhere. */
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export interface ActionContribution {
  id: string;
  title: string;
  category?: string;
  /** Canonical form such as "Mod+Shift+P". */
  keybinding?: string;
  isEnabled?: () => boolean;
  execute: () => void | Promise<void>;
}

export interface RegisteredAction extends ActionContribution {
  readonly stroke?: KeyStroke;
}

const MODIFIER_ALIASES: Readonly<Record<string, "mod" | "ctrl" | "alt" | "shift">> = {
  mod: "mod",
  ctrl: "ctrl",
  alt: "alt",
  shift: "shift"
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/^key([a-z0-9])$/, "$1").replace(/^digit([0-9])$/, "$1");
}

export function parseKeybinding(input: string): KeyStroke {
  const stroke: KeyStroke = { key: "", mod: false, ctrl: false, alt: false, shift: false };
  const assignKey = (key: string): void => {
    if (stroke.key) throw new Error(`Keybinding '${input}' declares more than one key.`);
    stroke.key = normalizeKey(key);
    if (!stroke.key) throw new Error(`Keybinding '${input}' is missing a key.`);
    if (!/^[a-z0-9 ]+$/.test(stroke.key)) {
      throw new Error(`Keybinding '${input}' is not in canonical form.`);
    }
  };

  for (const part of input.split("+").map((token) => token.trim()).filter(Boolean)) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier) stroke[modifier] = true;
    else assignKey(part);
  }
  if (!stroke.key) throw new Error(`Keybinding '${input}' is missing a key.`);
  return stroke;
}

function strokeIdentity(stroke: KeyStroke): string {
  return [stroke.key, stroke.mod, stroke.ctrl, stroke.alt, stroke.shift].join("|");
}

interface ResolvedStroke {
  key: string;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

function resolveStroke(stroke: KeyStroke, isMac: boolean): ResolvedStroke {
  return {
    key: stroke.key,
    meta: stroke.mod ? isMac : false,
    ctrl: stroke.mod ? !isMac : stroke.ctrl,
    alt: stroke.alt,
    shift: stroke.shift
  };
}

function eventMatches(resolved: ResolvedStroke, event: KeyboardEvent): boolean {
  return (
    normalizeKey(event.key) === resolved.key &&
    event.metaKey === resolved.meta &&
    event.ctrlKey === resolved.ctrl &&
    event.altKey === resolved.alt &&
    event.shiftKey === resolved.shift
  );
}

const MAC_NAMED_KEYS: Readonly<Record<string, string>> = {
  escape: "esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  backspace: "⌫",
  delete: "⌦",
  enter: "↩",
  tab: "⇥",
  " ": "Space"
};

function displayKey(key: string, isMac: boolean): string {
  if (key.length === 1) return key.toUpperCase();
  if (isMac && MAC_NAMED_KEYS[key]) return MAC_NAMED_KEYS[key]!;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function formatKeybinding(stroke: KeyStroke, isMac: boolean): string {
  const key = displayKey(stroke.key, isMac);
  if (isMac) {
    return `${stroke.ctrl ? "⌃" : ""}${stroke.alt ? "⌥" : ""}${stroke.shift ? "⇧" : ""}${stroke.mod ? "⌘" : ""}${key}`;
  }
  const parts = [
    stroke.mod || stroke.ctrl ? "Ctrl" : undefined,
    stroke.alt ? "Alt" : undefined,
    stroke.shift ? "Shift" : undefined,
    key
  ].filter(Boolean);
  return parts.join("+");
}

export function detectMacPlatform(): boolean {
  const platform = globalThis.navigator?.platform ?? globalThis.navigator?.userAgent ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export class ActionRegistry {
  readonly #actions = new Map<string, RegisteredAction>();
  readonly #strokeOwners = new Map<string, string>();

  constructor(contributions: readonly ActionContribution[] = []) {
    contributions.forEach((contribution) => this.register(contribution));
  }

  register(action: ActionContribution): () => void {
    if (this.#actions.has(action.id)) throw new Error(`Action '${action.id}' is already registered.`);
    let stroke: KeyStroke | undefined;
    let strokeId: string | undefined;
    if (action.keybinding) {
      stroke = parseKeybinding(action.keybinding);
      strokeId = strokeIdentity(stroke);
      const owner = this.#strokeOwners.get(strokeId);
      if (owner) throw new Error(`Keybinding '${action.keybinding}' conflicts with action '${owner}'.`);
    }
    const registered: RegisteredAction = stroke ? { ...action, stroke } : { ...action };
    this.#actions.set(action.id, registered);
    if (strokeId) this.#strokeOwners.set(strokeId, action.id);
    return () => {
      this.#actions.delete(action.id);
      if (strokeId) this.#strokeOwners.delete(strokeId);
    };
  }

  get(id: string): RegisteredAction | undefined {
    return this.#actions.get(id);
  }

  list(): RegisteredAction[] {
    return [...this.#actions.values()];
  }

  isEnabled(id: string): boolean {
    const action = this.#actions.get(id);
    return Boolean(action && (action.isEnabled?.() ?? true));
  }

  async execute(id: string): Promise<void> {
    const action = this.#actions.get(id);
    if (!action) throw new Error(`Action '${id}' is not registered.`);
    if (!this.isEnabled(id)) return;
    await action.execute();
  }

  findByEvent(event: KeyboardEvent, isMac: boolean): RegisteredAction | undefined {
    for (const action of this.#actions.values()) {
      if (!action.stroke) continue;
      if (action.isEnabled && !action.isEnabled()) continue;
      if (eventMatches(resolveStroke(action.stroke, isMac), event)) return action;
    }
    return undefined;
  }

  formatKeybinding(id: string, isMac: boolean): string | undefined {
    const action = this.#actions.get(id);
    return action?.stroke ? formatKeybinding(action.stroke, isMac) : undefined;
  }
}

export interface ActionKeybindingOptions {
  /** When true, global dispatch is suspended while overlays such as dialogs own the keyboard. */
  suspended?: boolean;
  isMac?: boolean;
}

export function useActionKeybindings(
  registry: ActionRegistry | undefined,
  options: ActionKeybindingOptions = {}
): void {
  const { suspended = false, isMac = detectMacPlatform() } = options;
  const registryRef = useRef(registry);
  registryRef.current = registry;
  useEffect(() => {
    if (suspended) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = registryRef.current?.findByEvent(event, isMac);
      if (!action) return;
      event.preventDefault();
      void action.execute();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [suspended, isMac]);
}
