import { useCallback, useEffect, useRef, useState } from "react";
import { oauthConfig } from "../config.ts";
import * as nav from "./browserNav.ts";
import {
  STATE_KEY,
  buildAuthorizeUrl,
  exchangeCode,
  parseCallback,
} from "./oauthLogin.ts";

export type OAuthStatus = "idle" | "exchanging" | "error";

export interface OAuthLogin {
  /** True when a Worker + Client ID are configured (otherwise only PAT mode). */
  enabled: boolean;
  status: OAuthStatus;
  error: string | null;
  /** Begin the flow: stash a CSRF state and redirect to GitHub. */
  startLogin: () => void;
}

/** The redirect target — current page, without any query/hash. */
function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Drives the browser side of "Login with GitHub" (ADR-0001, #25). When OAuth is
 * configured it offers `startLogin`, and on a callback load it verifies the CSRF
 * state, exchanges the `code` for a token via the Worker, and hands the token to
 * `onToken` (which stores it exactly as a pasted PAT). When unconfigured it is
 * inert and `enabled` is false, so callers fall back to PAT mode.
 */
export function useOAuthLogin(onToken: (token: string) => void): OAuthLogin {
  const config = oauthConfig();
  const [status, setStatus] = useState<OAuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // A callback load must be processed exactly once, even under StrictMode's
  // double-invoke; the `code` is single-use so a second exchange would fail.
  const handled = useRef(false);

  useEffect(() => {
    if (!config || handled.current) return;
    const callback = parseCallback(window.location.search);
    if (!callback) return;
    handled.current = true;

    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    // Strip the `?code`/`&state` from the address bar regardless of outcome, so
    // a refresh doesn't re-trigger the (now spent) exchange.
    nav.replaceUrl(redirectUri());

    if (!expected || expected !== callback.state) {
      setStatus("error");
      setError("Login could not be verified — please try again.");
      return;
    }

    setStatus("exchanging");
    exchangeCode(config.workerUrl, callback.code, redirectUri())
      .then((token) => {
        setStatus("idle");
        onToken(token);
      })
      .catch((e: unknown) => {
        setStatus("error");
        setError(e instanceof Error ? e.message : "GitHub login failed.");
      });
  }, [config, onToken]);

  const startLogin = useCallback(() => {
    if (!config) return;
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    nav.redirect(buildAuthorizeUrl(config, redirectUri(), state));
  }, [config]);

  return { enabled: Boolean(config), status, error, startLogin };
}
