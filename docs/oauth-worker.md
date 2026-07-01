# OAuth token-exchange Worker

Optional infrastructure for the **"Login with GitHub"** path (ADR-0001). The
default single-repo path (PAT mode) needs none of this — deploy the Worker only
if you want Viewers to log in with GitHub instead of pasting a PAT.

GitHub's OAuth `code → token` exchange requires the app's `client_secret`, and
the token endpoint does not support CORS, so the browser cannot do the exchange
itself. This Worker is the minimal server-side shim that holds the secret and
performs the exchange. It is **stateless**: no token or secret is ever persisted.

- Handler: [`src/auth/oauthWorker.ts`](../src/auth/oauthWorker.ts)
- Deploy config: [`wrangler.toml`](../wrangler.toml)

## Request contract

`POST /` with a JSON body (from an allowlisted Instance origin):

```json
{ "code": "<oauth-code>" }
```

The Worker **pins `redirect_uri`** to its configured `REDIRECT_URI` (see below)
and ignores any `redirect_uri` in the request body, so a malicious caller cannot
steer GitHub's redirect. On success the Worker responds:

```json
{ "access_token": "gho_…", "token_type": "bearer", "scope": "repo" }
```

The app stores this token exactly as it stores a PAT. Errors come back as
`{ "error": …, "error_description": … }` with a 4xx/5xx status and no token.
`OPTIONS` is answered as a CORS preflight; other methods get `405`.

The Worker holds the app's `client_secret`, so it must not be a public exchange
oracle. It only serves an explicit **allowlist of Instance origins** — a request
whose `Origin` is not allowlisted gets no CORS grant and no token exchange
(`403 forbidden_origin`). The origin is never reflected as `*`.

## Client contract: `state` for CSRF protection

The Worker pins the redirect and locks CORS, but the login flow's CSRF defence —
the OAuth `state` parameter — lives in the **client**. The later "Login with
GitHub" slice (#25) MUST implement it so an attacker cannot feed a Viewer a code
of the attacker's choosing (login CSRF):

1. **Before redirecting to GitHub**, generate an unguessable random `state`
   (e.g. `crypto.getRandomValues`), store it (e.g. `sessionStorage`), and include
   it in the authorize URL's `state` query parameter.
2. **On the callback**, read `state` from the query string and compare it to the
   stored value. If it is missing or does not match, abort — do **not** POST the
   `code` to this Worker.
3. Only after `state` verifies, POST `{ "code" }` to the Worker and store the
   returned token. Clear the stored `state` afterward.

The Worker is stateless and cannot verify `state` for you; skipping this step
leaves the flow open to login CSRF even though the exchange itself is hardened.

## 1. Register a GitHub OAuth app

GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.

- **Homepage URL** — your Beachfront Instance URL.
- **Authorization callback URL** — the page in your app that receives the
  `?code=…` and POSTs it to the Worker.

Note the **Client ID** and generate a **Client secret**.

## 2. Deploy the Worker and set the secrets

```sh
# One-time: install + authenticate the Cloudflare CLI.
npm i -g wrangler
npx wrangler login

# Hold the OAuth credentials as Worker Secrets (never commit them):
npx wrangler secret put GITHUB_CLIENT_ID       # paste the Client ID
npx wrangler secret put GITHUB_CLIENT_SECRET   # paste the Client secret

# Deploy. Wrangler prints the Worker's URL (e.g. https://beachfront-oauth.<you>.workers.dev).
npx wrangler deploy
```

Then set the two security pins in [`wrangler.toml`](../wrangler.toml)'s `[vars]`
before deploying (or `wrangler deploy --var …`):

- **`ALLOWED_ORIGINS`** — your Instance origin(s), comma/space-separated. The
  Worker serves CORS and token exchanges only for these; it fails closed if unset.
- **`REDIRECT_URI`** — your Instance callback URL, matching the OAuth app's
  **Authorization callback URL**. The Worker always sends this to GitHub.

## 3. Point the Instance at the Worker

Record the deployed Worker URL in your Instance config. Beachfront then offers
the "Login with GitHub" button (see #25); without a configured Worker URL, only
PAT mode is offered.

## Notes

- **Nothing is persisted.** The Worker forwards the exchange and returns the
  result; it keeps no token store, so there is no extra data model to secure.
- The `client_secret` lives only in the Worker's Secrets — never in the browser,
  the repo, or the static build.
- **CORS is not permissive.** The Worker reflects `Access-Control-Allow-Origin`
  only for an allowlisted Instance origin (`ALLOWED_ORIGINS`), never `*`, and
  refuses the exchange for any other origin — so the secret-holding endpoint is
  not an open oracle.
- **The redirect is pinned.** GitHub only ever receives the Worker's configured
  `REDIRECT_URI`; a caller-supplied `redirect_uri` is ignored.
