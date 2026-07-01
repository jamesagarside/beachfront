import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearStoredToken, getStoredToken, storeToken } from "./token.ts";
import { fetchViewer, type Viewer } from "./identity.ts";
import { seedDemoCache } from "../demo/demo.ts";

export type AuthStatus =
  | "anonymous"
  | "checking"
  | "authenticated"
  | "error";

export interface Auth {
  token: string | null;
  viewer: Viewer | null;
  status: AuthStatus;
  error: string | null;
  signIn: (token: string) => void;
  signOut: () => void;
}

/**
 * Owns the Viewer's session: the cached token, the confirmed identity, and the
 * status of the identity check. Whenever the token changes it re-confirms
 * identity against the GitHub API.
 */
export function useAuth(): Auth {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    getStoredToken() ? "checking" : "anonymous",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("anonymous");
      setViewer(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus("checking");
    setError(null);
    fetchViewer(token)
      .then((v) => {
        if (cancelled) return;
        setViewer(v);
        setStatus("authenticated");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setViewer(null);
        setError(e instanceof Error ? e.message : "Unknown error.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Session boundaries reset the query cache: signing in drops the demo
  // snapshot so live fetches start clean; signing out drops the live data (it
  // was read as the departing Viewer's token) and re-seeds the demo snapshot so
  // demo mode's disabled queries have something to resolve from.
  const signIn = useCallback(
    (next: string) => {
      queryClient.clear();
      storeToken(next);
      setToken(next);
    },
    [queryClient],
  );

  const signOut = useCallback(() => {
    clearStoredToken();
    queryClient.clear();
    seedDemoCache(queryClient);
    setToken(null);
    setViewer(null);
    setError(null);
  }, [queryClient]);

  return { token, viewer, status, error, signIn, signOut };
}
