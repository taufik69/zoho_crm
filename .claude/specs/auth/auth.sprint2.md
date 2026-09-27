# Auth sprint 2 — Authorize URL

Plan ref: oauth-plan.md §4.2 (`buildAuthorizeUrl`)
Depends on: nothing (can run in parallel with sprint 1)
File: `src/integrations/zoho/zoho.oauth.js`

## Goal

Build the Zoho consent URL the browser is redirected to.

```
{ZOHO_ACCOUNTS_URL}/oauth/v2/auth
  ?scope=<ZOHO_SCOPES>
  &client_id=<ZOHO_CLIENT_ID>
  &response_type=code
  &access_type=offline
  &prompt=consent
  &redirect_uri=<ZOHO_REDIRECT_URI>
  &state=<state>
```

## Tasks

- [x] `buildAuthorizeUrl(state)` using `new URL()` + `searchParams.set`
      (handles encoding; never string-concatenate query params).
- [x] Values from `config.zoho` only — nothing hard-coded.
- [x] Comment why `access_type=offline` (no refresh token without it) and
      `prompt=consent` (no new refresh token on reconnect without it) are
      load-bearing.
- [x] Client secret is **not** in this URL.

## Acceptance

- [x] Printed URL opened in a browser shows the Zoho consent screen for
      "CRM Integration Test App" with the three scopes listed.
      *Verified in sprint 9, step 3.*
- [x] URL contains `redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fapi%2Fv1%2Fauth%2Fcallback`.
- [x] No `client_secret` in the URL.

## Quick check

```bash
node -e "import('./src/integrations/zoho/zoho.oauth.js').then(m => console.log(m.default.buildAuthorizeUrl('test')))"
```

(Accepting consent here will fail at the callback — expected until sprint 6.)
