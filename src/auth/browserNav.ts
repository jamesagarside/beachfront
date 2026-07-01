/**
 * Thin, mockable wrappers over imperative browser navigation. Kept in their own
 * module so the OAuth flow's redirect and URL-cleanup are easy to spy on in
 * tests (jsdom does not implement real navigation).
 */

/** Navigate the current tab to `url` (used to hand off to GitHub's authorize page). */
export function redirect(url: string): void {
  window.location.assign(url);
}

/** Replace the current URL without reloading (used to strip the `?code` after login). */
export function replaceUrl(url: string): void {
  window.history.replaceState(null, "", url);
}
