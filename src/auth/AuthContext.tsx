import { createContext, useContext, type ReactNode } from "react";
import { useAuth, type Auth } from "./useAuth.ts";

/**
 * Shares the single Viewer session across the app: the AuthPanel renders and
 * mutates it, while panes like the issue list read the token from it. Without
 * this, each consumer's own `useAuth` would be an independent session.
 */
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): Auth {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider.");
  }
  return ctx;
}
