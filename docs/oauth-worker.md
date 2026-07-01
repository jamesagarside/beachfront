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

`POST /` with a JSON body:

```json
{ "code": "<oauth-code>", "redirect_uri": "https://your-instance/callback" }
```

`redirect_uri` is optional (include it only if your OAuth app sets one). On
success the Worker responds:

```json
{ "access_token": "gho_…", "token_type": "bearer", "scope": "repo" }
```

The app stores this token exactly as it stores a PAT. Errors come back as
`{ "error": …, "error_description": … }` with a 4xx/5xx status and no token.
`OPTIONS` is answered as a CORS preflight; other methods get `405`.

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

## 3. Point the Instance at the Worker

Set both build-time env vars when you build the static app:

```sh
VITE_BEACHFRONT_OAUTH_WORKER_URL=https://beachfront-oauth.<you>.workers.dev
VITE_BEACHFRONT_OAUTH_CLIENT_ID=<the OAuth app Client ID>
```

With both present, Beachfront offers a **"Login with GitHub"** button alongside
PAT mode (#25). With either missing, only PAT mode is offered. The flow stashes a
random `state` in `sessionStorage`, redirects to GitHub, and on the callback
verifies that `state`, exchanges the `code` via the Worker, and stores the
returned token exactly as a pasted PAT.

## Notes

- **Nothing is persisted.** The Worker forwards the exchange and returns the
  result; it keeps no token store, so there is no extra data model to secure.
- The `client_secret` lives only in the Worker's Secrets — never in the browser,
  the repo, or the static build.
- CORS is permissive (`Access-Control-Allow-Origin: *`) because the response is a
  token bound for the Viewer's own browser and no cookies/credentials are used.
