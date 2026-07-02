import { useQuery } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import { fetchHarnessVersion } from "./harnessVersion.ts";

/**
 * Caches one repo's installed harness vintage under a per-repo key so TanStack
 * Query dedupes and reuses fetches, mirroring {@link useTriageMapping} and
 * sharing its cache key with the Shoreline's registry fetch (#115). Disabled
 * until a token is present, since the read is the Viewer's own credential
 * (ADR-0001).
 */
export function useHarnessVersion(token: string | null, repo: RepoRef) {
  return useQuery({
    queryKey: ["harness-version", repo.owner, repo.repo],
    queryFn: () => fetchHarnessVersion(token as string, repo),
    enabled: Boolean(token),
  });
}
