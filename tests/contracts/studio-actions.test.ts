import { ActionRegistry, formatKeybinding, parseKeybinding } from "@agidn/studio-workbench";

function keyEvent(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    key: init.key,
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    altKey: init.altKey ?? false,
    shiftKey: init.shiftKey ?? false
  } as KeyboardEvent;
}

describe("keybinding parsing", () => {
  it("parses canonical modifier form", () => {
    expect(parseKeybinding("Mod+Shift+P")).toEqual({ key: "p", mod: true, ctrl: false, alt: false, shift: true });
    expect(parseKeybinding("Ctrl+Alt+Delete")).toEqual({
      key: "delete",
      mod: false,
      ctrl: true,
      alt: true,
      shift: false
    });
  });

  it("parses legacy glyph form and normalizes keys", () => {
    expect(parseKeybinding("⇧⌘P")).toEqual({ key: "p", mod: true, ctrl: false, alt: false, shift: true });
    expect(parseKeybinding("⌘Z")).toEqual({ key: "z", mod: true, ctrl: false, alt: false, shift: false });
    expect(parseKeybinding("Shift+Escape")).toEqual({
      key: "escape",
      mod: false,
      ctrl: false,
      alt: false,
      shift: true
    });
    expect(parseKeybinding("F6")).toEqual({ key: "f6", mod: false, ctrl: false, alt: false, shift: false });
  });

  it("rejects invalid keybindings", () => {
    expect(() => parseKeybinding("Mod+Shift")).toThrow(/missing a key/);
    expect(() => parseKeybinding("A+B")).toThrow(/more than one key/);
  });
});

describe("keybinding formatting", () => {
  it("formats mac glyphs in platform order", () => {
    expect(formatKeybinding(parseKeybinding("Mod+Shift+P"), true)).toBe("⇧⌘P");
    expect(formatKeybinding(parseKeybinding("Mod+1"), true)).toBe("⌘1");
    expect(formatKeybinding(parseKeybinding("Shift+Escape"), true)).toBe("⇧esc");
  });

  it("formats verbose modifiers on other platforms", () => {
    expect(formatKeybinding(parseKeybinding("Mod+Shift+P"), false)).toBe("Ctrl+Shift+P");
    expect(formatKeybinding(parseKeybinding("F6"), false)).toBe("F6");
  });
});

describe("ActionRegistry", () => {
  it("rejects duplicate ids and normalized keybinding conflicts", () => {
    const registry = new ActionRegistry([
      { id: "a", title: "A", keybinding: "Mod+Shift+P", execute: () => undefined }
    ]);
    expect(() => registry.register({ id: "b", title: "B", keybinding: "⇧⌘P", execute: () => undefined })).toThrow(
      /conflicts/
    );
    expect(() => registry.register({ id: "a", title: "Duplicate", execute: () => undefined })).toThrow(
      /already registered/
    );
  });

  it("disposes registrations and frees keybindings", () => {
    const registry = new ActionRegistry();
    const dispose = registry.register({ id: "a", title: "A", keybinding: "Mod+1", execute: () => undefined });
    dispose();
    expect(registry.get("a")).toBeUndefined();
    expect(() =>
      registry.register({ id: "b", title: "B", keybinding: "⌘1", execute: () => undefined })
    ).not.toThrow();
  });

  it("dispatches by platform: Mod resolves to meta on macOS and ctrl elsewhere", () => {
    const registry = new ActionRegistry([
      { id: "palette", title: "Palette", keybinding: "Mod+Shift+P", execute: () => undefined }
    ]);
    const macEvent = keyEvent({ key: "P", metaKey: true, shiftKey: true });
    expect(registry.findByEvent(macEvent, true)?.id).toBe("palette");
    expect(registry.findByEvent(macEvent, false)).toBeUndefined();
    const windowsEvent = keyEvent({ key: "P", ctrlKey: true, shiftKey: true });
    expect(registry.findByEvent(windowsEvent, false)?.id).toBe("palette");
    expect(registry.findByEvent(windowsEvent, true)).toBeUndefined();
  });

  it("skips disabled actions and ignores extra modifiers", () => {
    let enabled = false;
    const registry = new ActionRegistry([
      { id: "undo", title: "Undo", keybinding: "Mod+Z", isEnabled: () => enabled, execute: () => undefined }
    ]);
    const event = keyEvent({ key: "z", metaKey: true });
    expect(registry.findByEvent(event, true)).toBeUndefined();
    enabled = true;
    expect(registry.findByEvent(event, true)?.id).toBe("undo");
    expect(registry.findByEvent(keyEvent({ key: "z", metaKey: true, altKey: true }), true)).toBeUndefined();
  });

  it("does not execute disabled actions", async () => {
    let ran = 0;
    const registry = new ActionRegistry([
      { id: "redo", title: "Redo", isEnabled: () => false, execute: () => void ran++ }
    ]);
    await registry.execute("redo");
    expect(ran).toBe(0);
  });

  it("formats registered keybindings for display", () => {
    const registry = new ActionRegistry([
      { id: "toggle", title: "Toggle", keybinding: "Mod+2", execute: () => undefined },
      { id: "plain", title: "Plain", execute: () => undefined }
    ]);
    expect(registry.formatKeybinding("toggle", true)).toBe("⌘2");
    expect(registry.formatKeybinding("plain", true)).toBeUndefined();
  });
});
