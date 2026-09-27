# CRM sprint 2 — Zoho CRM HTTP client

Plan ref: crm-read-insert-plan.md §1, §5
Depends on: auth sprints 1, 3; crm sprint 3 (error mapping)
File: `src/integrations/zoho/zoho.client.js`

## Goal

`request(method, path, { query, body })` — the only code that calls the Zoho
CRM API.

## Tasks

- [x] Load tokens from `token.store`; none →
      `AppError(UNAUTHORIZED, 'Zoho is not connected, visit /api/v1/auth/connect')`.
- [x] Access token expiring within 60 s (`REFRESH_SKEW_MS`) → refresh via
      `zohoOauth.refreshAccessToken`, save, use the new one.
- [x] URL `{apiDomain}/crm/v8{path}` + query params (`new URL`, `searchParams`).
      `apiDomain` from the token response, never config.
- [x] Header `Authorization: Zoho-oauthtoken <token>` (not `Bearer`);
      `Content-Type: application/json` only when there is a body.
- [x] `AbortSignal.timeout(10_000)`; `TimeoutError` → 504, network error → 502.
- [x] `204` → `null`; other non-2xx → `toAppError(status, body)`.
- [x] Header comment updated, TODO removed.

## Acceptance

- [x] Not connected → any CRM endpoint answers 401 "Zoho is not connected".
- [x] Connected → real Zoho data returned (sprint 4).
- [x] Token never appears in a response or the log.

## Out of scope

Single-flight refresh, retry-once on 401 — not required by points 2–4.
