# Viewer identity is the data-access gate; no private data is ever baked

## Status

accepted

## Context

Beachfront is hosted on GitHub Pages and must show issue/state data from both
public and private repos, while being open-source so others can run their own
Instance, *and* serving as James's own private instance.

Two hard constraints shaped the decision:

- **Access-controlled (private) GitHub Pages is GitHub Enterprise Cloud only.**
  On a free/Pro plan the Pages HTML is always world-readable. So private repo
  data cannot be baked into static JSON and served from Pages without leaking it.
- **GitHub offers no native HTTP compute.** Pages is static-only; Actions are
  batch jobs, not a request/response server. OAuth's `code → token` exchange
  requires the `client_secret` and the token endpoint does not support CORS, so
  a pure-static "Login with GitHub" is impossible — it needs a server-side shim.

## Decision

The data-access gate is **the Viewer's own GitHub identity**, and **no private
data is ever baked into the static site**. The Pages site is a public, empty SPA
shell; private data is fetched live, browser → GitHub API, using the Viewer's
own credentials. GitHub repo access therefore decides what each Viewer sees.

Authentication is **pluggable and Viewer-selectable**, with two modes:

1. **PAT mode (always available, 100% GitHub-native).** A "Generate a token"
   deep link into GitHub's token settings; the Viewer pastes a read-only
   fine-grained PAT once; it is cached long-term in `localStorage`.
2. **OAuth "Login with GitHub" mode (optional, opt-in).** Available only if the
   Instance owner deploys their own free Cloudflare Worker token-exchange shim
   and records its URL in their config. Beachfront then offers a login button.

A separate, optional **baked-read demo mode** is allowed *only for public repos*:
a scheduled Action in the Tool repo reads public-repo state with a read-only PAT
in Actions secrets and writes static JSON, so the public demo loads with no login.

## Consequences

- The default, single-repo path (PAT mode) needs no external infrastructure.
- OAuth login costs each Instance owner their own OAuth identity + Cloudflare
  Worker; the init flow must guide that. It is a pure UX upgrade — the data model
  (browser → API with Viewer identity) is identical in both modes.
- Because the same Viewer token can also `POST workflow_dispatch` (CORS-supported),
  later interactive triggering needs no extra backend.
- `localStorage` token caching has XSS exposure; mitigated by using read-only
  fine-grained PATs scoped as narrowly as the task allows.
