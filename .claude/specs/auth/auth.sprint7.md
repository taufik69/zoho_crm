# Auth sprint 7 — `/status` + DTO

Plan ref: oauth-plan.md §4.4 (`getStatus`), §4.5
Depends on: sprint 1
Files: `src/modules/auth/auth.service.js`, `src/modules/auth/auth.dto.js`

## Goal

Tell the caller whether Zoho is connected, without exposing any token.

## Tasks

- [x] `getStatus()` → `toConnectionResponse(await authRepository.getTokens())`.
      Not connected is a normal answer (200), not an error.
- [x] `toConnectionResponse` fields:
  - `connected` — boolean
  - `expiresAt` — ISO string or `null`
  - `apiDomain` — or `null`
  - `scopes` — `config.zoho.scopes` split on `,` (makes a scope mismatch
    visible, assessment Q7)
- [x] Explicitly **never** spread the token object into the response —
      pick fields one by one.
- [x] Remove the TODO, update header.

## Acceptance

- [x] No `.tokens.json` → `200 { connected: false }`.
- [ ] After sprint 6 connect → `200 { connected: true, expiresAt, apiDomain, scopes: [...] }`.
- [x] Restart the server → still `connected: true`.
- [x] `curl .../status | grep -i token` → no match.

> Unchecked items need a real Zoho consent in the browser — run in sprint 9.
