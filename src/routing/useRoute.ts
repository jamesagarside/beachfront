import { useSyncExternalStore } from "react";
import { hashFor, parseHash, type Route } from "./route.ts";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getSnapshot(): string {
  return window.location.hash;
}

/**
 * The current {@link Route}, kept in sync with the URL hash. Uses
 * `useSyncExternalStore` so every view re-renders together on a `hashchange`,
 * whether the change came from a nav click or the browser's back/forward.
 * Reading from `window.location.hash` (not local state) keeps the URL the single
 * source of truth, so a deep-link or a manual edit resolves the same way.
 */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return parseHash(hash);
}

/** Navigate to a route by setting the hash — `hashchange` does the rest. */
export function navigate(route: Route): void {
  window.location.hash = hashFor(route);
}
