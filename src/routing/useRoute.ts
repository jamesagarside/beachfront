import { useSyncExternalStore } from "react";
import { parseRoute, type Route } from "./route.ts";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHash(): string {
  return window.location.hash;
}

/**
 * Subscribes the component tree to the current hash route. `useSyncExternalStore`
 * keeps every consumer in step with `location.hash` as the Viewer navigates
 * (clicking a nav link or editing the URL both fire `hashchange`). The server
 * snapshot is an empty hash, which {@link parseRoute} resolves to the Shoreline.
 */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => "");
  return parseRoute(hash);
}
