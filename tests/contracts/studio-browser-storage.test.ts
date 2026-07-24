import { createSafeStorage } from "../../apps/studio/src/browser-storage.js";

describe("Studio browser storage", () => {
  it("treats a sandboxed localStorage getter as unavailable", () => {
    const storage = createSafeStorage(() => {
      throw new DOMException(
        "The document is sandboxed and lacks the 'allow-same-origin' flag.",
        "SecurityError"
      );
    });

    expect(storage.getItem("key")).toBeNull();
    expect(storage.setItem("key", "value")).toBe(false);
    expect(storage.removeItem("key")).toBe(false);
  });

  it("contains storage method failures without interrupting the editor", () => {
    const storage = createSafeStorage(() => ({
      getItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      }
    }));

    expect(storage.getItem("key")).toBeNull();
    expect(storage.setItem("key", "value")).toBe(false);
    expect(storage.removeItem("key")).toBe(false);
  });

  it("uses an available storage implementation", () => {
    const values = new Map<string, string>();
    const storage = createSafeStorage(() => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      }
    }));

    expect(storage.setItem("key", "value")).toBe(true);
    expect(storage.getItem("key")).toBe("value");
    expect(storage.removeItem("key")).toBe(true);
    expect(storage.getItem("key")).toBeNull();
  });
});
