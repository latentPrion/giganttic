import { frontendConfig } from "../../../config/frontend-config.js";

interface StorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

function resolveStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export const authTokenStorage = {
  clear(): void {
    resolveStorage()?.removeItem(frontendConfig.authTokenStorageKey);
  },

  read(): string | null {
    return resolveStorage()?.getItem(frontendConfig.authTokenStorageKey) ?? null;
  },

  write(token: string): void {
    resolveStorage()?.setItem(frontendConfig.authTokenStorageKey, token);
  },
};
