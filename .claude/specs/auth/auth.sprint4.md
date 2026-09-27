# Auth sprint 4 — `/connect` + `state`

Plan ref: oauth-plan.md §4.4 (`getAuthorizeUrl`), §5.1
Depends on: sprint 2
File: `src/modules/auth/auth.service.js`

## Goal

`GET /api/v1/auth/connect` redirects to Zoho with a fresh, single-use
`state` — the CSRF protection for the callback.

## Tasks

- [x] Module-level `pendingStates = new Map()` (`state → expiresAt`).
- [x] `STATE_TTL_MS = 10 * 60 * 1000` as a named constant.
- [x] Private `pruneExpiredStates()` — drop entries past `expiresAt`, so the
      map cannot grow forever from abandoned connects.
- [x] `getAuthorizeUrl()`
  - prune
  - `state = crypto.randomBytes(32).toString('hex')`
  - `pendingStates.set(state, Date.now() + STATE_TTL_MS)`
  - `return authRepository.buildAuthorizeUrl(state)`
- [x] Export a private `consumeState(state)` helper for sprint 6:
      get + **delete** (single use), return `true` only if present and not
      expired.
- [x] Header comment: why in-memory state is acceptable here (single user,
      restart = click connect again) and what multi-instance would need
      (Redis / signed cookie).

## Acceptance

- [x] `curl -i localhost:5000/api/v1/auth/connect` → `302`, `Location`
      starts with `https://accounts.zoho.com/oauth/v2/auth?`.
- [x] Two calls → two different `state` values.
- [ ] Browser: `/api/v1/auth/connect` shows the Zoho consent screen.

## Note

`authLimiter` allows 10 requests / 15 min on connect + callback. Restart the
server if testing hits the limit.

> Unchecked items need a real Zoho consent in the browser — run in sprint 9.
