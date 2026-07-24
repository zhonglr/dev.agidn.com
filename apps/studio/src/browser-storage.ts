export interface SafeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => boolean;
  removeItem: (key: string) => boolean;
}

type StorageResolver = () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined;

export function createSafeStorage(resolveStorage: StorageResolver): SafeStorage {
  return {
    getItem(key) {
      try {
        return resolveStorage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        const storage = resolveStorage();
        if (!storage) return false;
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    removeItem(key) {
      try {
        const storage = resolveStorage();
        if (!storage) return false;
        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    }
  };
}

export const studioStorage = createSafeStorage(() => globalThis.localStorage);
