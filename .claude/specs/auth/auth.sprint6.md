# Auth sprint 6 — `/callback`: verify, exchange, save

Plan ref: oauth-plan.md §2, §4.4 (`handleCallback`), §5.4
Depends on: sprints 1, 3, 4, 5
File: `src/modules/auth/auth.service.js`

## Goal

Finish the OAuth round trip: Zoho redirects back, we verify it is our own
request, exchange the code, persist the tokens.

## Tasks

`handleCallback({ code, state, error, 'accounts-server': accountsServer })`,
checks in this order:

- [x] `error` present → `AppError(BAD_REQUEST, 'Zoho authorization was denied')`.
- [x] `!consumeState(state)` →
      `AppError(BAD_REQUEST, 'Invalid or expired OAuth state, start again at /api/v1/auth/connect')`.
      State is deleted even on failure (single use).
- [x] `accountsServer` present and `!== config.zoho.accountsUrl` →
      `AppError(BAD_REQUEST, 'This Zoho account is in a different data centre; set ZOHO_ACCOUNTS_URL to <server>')`.
      **Compare only, never call the URL from the query** — it would receive
      our client secret.
- [x] `tokens = await authRepository.exchangeCode(code)`
- [x] `saved = await authRepository.saveTokens(tokens)`
- [x] `return toConnectionResponse(saved)`
- [x] Log `info` "Zoho connected" with `apiDomain` + `expiresAt` only.

## Acceptance

- [ ] Browser `/api/v1/auth/connect` → Accept → JSON
      `{ success: true, message: "Zoho CRM connected successfully", data: { connected: true, expiresAt, apiDomain } }`.
- [ ] `.tokens.json` created, `-rw-------`.
- [ ] Response and log contain no token values.
- [ ] Reload the same callback URL → 400 invalid state.
- [x] `/api/v1/auth/callback?code=x&state=fake` → 400 invalid state.
- [ ] Click **Reject** on consent → 400 authorization denied.

> Unchecked items need a real Zoho consent in the browser — run in sprint 9.
