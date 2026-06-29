/**
 * The Viewer's GitHub token is the data-access gate (ADR-0001). It is cached
 * long-term in localStorage so a Viewer pastes it once. We only ever store a
 * read-only fine-grained PAT here; XSS exposure is the accepted trade-off.
 */
const TOKEN_KEY = "beachfront.token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Deep link into GitHub's fine-grained PAT creation page. Beachfront is
 * read-mostly, so the Viewer is guided toward a narrowly-scoped, read-only
 * token (ADR-0001).
 */
export const GENERATE_TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new";
