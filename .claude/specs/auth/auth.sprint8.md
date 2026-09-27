# Auth sprint 8 — `/refresh` + revoked refresh token

Plan ref: oauth-plan.md §4.4 (`refresh`)
Depends on: sprints 1, 3, 7
File: `src/modules/auth/auth.service.js`

## Goal

Get a new access token from the stored refresh token (assessment Q2: work
tomorrow without asking the user to authorize again). Handle the case where
the refresh token itself is dead.

## Tasks

- [x] `refresh()`
  - `current = await authRepository.getTokens()`
  - no `current?.refreshToken` →
    `AppError(UNAUTHORIZED, 'Zoho is not connected, visit /api/v1/auth/connect')`
  - `tokens = await authRepository.refreshAccessToken(current.refreshToken)`
  - on `AppError` 401 (refresh token revoked/invalid) →
    `await authRepository.clearTokens()`, then rethrow
    (a dead refresh token must not stay on disk looking "connected")
  - `saved = await authRepository.saveTokens(tokens)` — old refresh token kept
  - `return toConnectionResponse(saved)`
- [x] The try/catch here is in the **service**, for cleanup, and rethrows —
      allowed by the error-handling rule (no try/catch in controllers only).

## Acceptance

- [ ] Connected: `curl -X POST .../auth/refresh` → 200, `expiresAt` later than
      before; `.tokens.json` still has the same `refreshToken`.
- [x] Not connected → 401 "Zoho is not connected".
- [x] Edit `.tokens.json` refreshToken to garbage, restart, refresh →
      401 "reconnect", `.tokens.json` deleted, `/status` → `connected: false`.

## Out of scope

Automatic refresh before CRM calls, retry-once on `INVALID_TOKEN`, and the
single-flight refresh lock — these go in `zoho.client.js` (CRM feature 2).

> Unchecked items need a real Zoho consent in the browser — run in sprint 9.
