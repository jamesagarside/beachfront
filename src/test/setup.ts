import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

// jsdom in this setup does not supply a working Storage — `localStorage` comes
// through as an empty object, so every `getItem`/`setItem`/`clear` call throws
// "not a function". Back it with a real in-memory implementation so the token
// cache (the Viewer's data-access gate, ADR-0001) behaves as it does in a
// browser. Reset between tests so cases stay isolated.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

vi.stubGlobal("localStorage", createMemoryStorage());
// sessionStorage is broken the same way; the OAuth login flow uses it to hold
// the CSRF `state` between the redirect and the callback (ADR-0001, #25).
vi.stubGlobal("sessionStorage", createMemoryStorage());

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
