# Auth sprint 3 — Token endpoint + Zoho error mapping

Plan ref: oauth-plan.md §4.2 (`exchangeCode`, `refreshAccessToken`,
`postToken`, `normalize`, token error table)
Depends on: sprint 2 (same file)
File: `src/integrations/zoho/zoho.oauth.js`

## Goal

Talk to `POST {accounts}/oauth/v2/token` for both grants and turn every
failure into an `AppError` with the right status.

## Tasks

- [x] Private `postToken(params)`
  - `fetch` POST, body `new URLSearchParams(params)` (form-encoded, **not** JSON)
  - `signal: AbortSignal.timeout(10_000)`
  - `TimeoutError` → `AppError(GATEWAY_TIMEOUT, 'Zoho accounts server timed out')`
  - other network error → `AppError(BAD_GATEWAY, 'Could not reach Zoho accounts server')`
  - parse JSON; `!res.ok || body.error` → `mapTokenError(body.error)`
    (Zoho answers **HTTP 200** with `{ error }` for a bad code/secret)
- [x] Private `normalize(body)` →
      `{ accessToken, refreshToken, apiDomain, expiresAt: Date.now() + expires_in * 1000 }`
- [x] `exchangeCode(code)` — `grant_type=authorization_code`, `client_id`,
      `client_secret`, `redirect_uri`, `code`.
- [x] `refreshAccessToken(refreshToken)` — `grant_type=refresh_token`,
      `client_id`, `client_secret`, `refresh_token`. Result has no
      `refreshToken` (sprint 1 keeps the old one).
- [x] Private `mapTokenError(code)`:

| Zoho `error` | Status | Client message |
|---|---|---|
| `invalid_code` on code exchange | 400 | Authorization code is invalid or expired, reconnect |
| `invalid_code` on refresh (Zoho's answer for a revoked refresh token) | 401 | Zoho authorization expired, reconnect at /api/v1/auth/connect |
| `invalid_client`, `invalid_client_secret`, `invalid_redirect_uri` | 500 | Zoho client is misconfigured *(real code logged)* |
| `invalid_token` | 401 | Zoho authorization expired, reconnect at /api/v1/auth/connect |
| `access_denied` | 429 | Too many token requests, try again later |
| anything else | 502 | Zoho accounts server returned an error *(real code logged)* |

- [x] Log the Zoho `error` code, never the request body (it holds the secret
      and the code/refresh token).

## Acceptance

- [x] `exchangeCode('garbage')` → `AppError` 400.
- [x] `refreshAccessToken('garbage')` → `AppError` 401.
- [x] Wrong `ZOHO_CLIENT_SECRET` in `.env` → 500 "misconfigured", log shows
      `invalid_client`, secret not in log.
      *Verified with a wrong `ZOHO_CLIENT_ID` (→ `invalid_client`, 500). A wrong
      secret alone can only be checked with a live code: Zoho validates the
      code first and answers `invalid_code` for a made-up one.*
- [x] `ZOHO_ACCOUNTS_URL=https://accounts.zoho.invalid` → 502.

## Quick check

```bash
node -e "import('./src/integrations/zoho/zoho.oauth.js').then(m => m.default.exchangeCode('x')).catch(e => console.log(e.statusCode, e.message))"
```
