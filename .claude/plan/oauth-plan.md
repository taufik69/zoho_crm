# Plan — Feature 1: Zoho CRM OAuth

Status: **plan only, waiting for manual review.** No code written yet.
Parent plan: [part1-zoho-crm.md](./part1-zoho-crm.md) (section 2).
After OAuth is done and verified, work moves to the Zoho API (features 2–4).

---

## 1. Goal

Get a Zoho access token through the real OAuth 2.0 authorization-code flow,
keep it valid without asking the user again, and never hard-code a token.

Done means:

- `GET /api/v1/auth/connect` in the browser goes to Zoho consent, and after
  "Accept" the callback answers `"Zoho CRM connected successfully"`.
- `.tokens.json` exists and holds the tokens (gitignored).
- `GET /api/v1/auth/status` says `connected: true` and survives a server restart.
- `POST /api/v1/auth/refresh` gets a new access token from the refresh token.
- No token or secret ever appears in a response body or a log line.

---

## 2. The flow

```
Browser                  Our API (localhost:5000)               Zoho accounts
───────                  ────────────────────────               ─────────────
GET /api/v1/auth/connect ─►
                         create state (random 32 bytes, hex)
                         remember it: Map state -> expiresAt (10 min)
                     ◄── 302 Location: accounts.zoho.com/oauth/v2/auth?...
─────────────────────────────────────────────────────────────►  login + consent
◄──────────────────────── 302 to redirect_uri?code=..&state=..&location=us
                                   &accounts-server=https://accounts.zoho.com
GET /api/v1/auth/callback?code&state ─►
                         1. error=access_denied?  -> 400
                         2. state unknown/expired -> 400 (delete it either way)
                         3. accounts-server != config -> 400 (see 5.4)
                         4. POST /oauth/v2/token (form-encoded) ───────────►
                                                     ◄── { access_token,
                                                           refresh_token,
                                                           api_domain,
                                                           expires_in: 3600 }
                         5. body.error? -> AppError
                         6. save tokens (memory + .tokens.json)
                     ◄── 200 { connected, expiresAt, apiDomain }
```

Refresh (used by `/auth/refresh` now, and automatically by the Zoho client
in feature 2+):

```
POST {accounts}/oauth/v2/token
  grant_type=refresh_token, client_id, client_secret, refresh_token
◄── { access_token, api_domain, expires_in }     (NO refresh_token)
```

---

## 3. Endpoints (routes already exist in `auth.routes.js`)

| Method | Path | Response |
|---|---|---|
| GET | `/api/v1/auth/connect` | 302 to Zoho consent page |
| GET | `/api/v1/auth/callback` | 200 `{ connected: true, expiresAt, apiDomain }` |
| GET | `/api/v1/auth/status` | 200 `{ connected: false }` or `{ connected: true, expiresAt, apiDomain }` |
| POST | `/api/v1/auth/refresh` | 200 new status; 401 if never connected |

`accessToken` and `refreshToken` are never part of any response.

---

## 4. File-by-file work

Order is bottom-up: each file only depends on the ones above it.

### 4.1 `src/integrations/zoho/token.store.js`

State: one in-memory object + `.tokens.json` in the project root.

```
let cache            // undefined = not loaded yet, null = no tokens

getTokens()
  if cache !== undefined -> return cache
  try read .tokens.json, JSON.parse -> cache
  ENOENT -> cache = null
  bad JSON -> log warn, cache = null   (treat as not connected)
  return cache

saveTokens(next)
  merged = { ...current, ...next }
  if next.refreshToken is undefined -> keep current.refreshToken
  write to .tokens.json.tmp with mode 0o600, then rename -> .tokens.json
     (rename is atomic: a crash mid-write never leaves half a file)
  cache = merged
  return merged

clearTokens()
  cache = null; rm .tokens.json (ignore ENOENT)
```

Why a file and not only memory: Zoho issues the refresh token once, on
consent. Memory-only means every restart (nodemon restarts on every save)
sends the user back through consent.

### 4.2 `src/integrations/zoho/zoho.oauth.js`

```
buildAuthorizeUrl(state)
  URL(`${accountsUrl}/oauth/v2/auth`) with searchParams:
    scope, client_id, response_type=code,
    access_type=offline,   // without it: no refresh token
    prompt=consent,        // without it: no NEW refresh token on reconnect
    redirect_uri, state

exchangeCode(code)
  postToken({ grant_type: 'authorization_code', client_id, client_secret,
              redirect_uri, code })
  -> normalize(body)

refreshAccessToken(refreshToken)
  postToken({ grant_type: 'refresh_token', client_id, client_secret,
              refresh_token })
  -> normalize(body)            // refreshToken will be undefined

postToken(params)  (private)
  fetch POST `${accountsUrl}/oauth/v2/token`
    body: new URLSearchParams(params)      // form-encoded, not JSON
    signal: AbortSignal.timeout(10_000)
  network error -> AppError 502 "Could not reach Zoho accounts server"
  timeout       -> AppError 504 "Zoho accounts server timed out"
  body = await res.json()
  if !res.ok or body.error -> throw mapTokenError(body.error)
     // Zoho returns HTTP 200 with { error } for a bad code/secret

normalize(body)
  { accessToken: body.access_token,
    refreshToken: body.refresh_token,       // only on code exchange
    apiDomain: body.api_domain,
    expiresAt: Date.now() + body.expires_in * 1000 }
```

Token error mapping (kept here, it is OAuth-specific; CRM errors go to
`zoho.errors.js` in feature 5):

| Zoho `error` | Status | Message to client |
|---|---|---|
| `invalid_code` | 400 | Authorization code is invalid or expired, reconnect |
| `invalid_client`, `invalid_client_secret` | 500 (logged) | Zoho client is misconfigured |
| `invalid_redirect_uri` | 500 (logged) | Zoho client is misconfigured |
| `invalid_token` on refresh (refresh token revoked) | 401 | Zoho authorization expired, reconnect at /api/v1/auth/connect |
| `access_denied` / too many requests | 429 | Too many token requests, try again later |
| anything else | 502 | Zoho accounts server returned an error |

The misconfiguration cases are our fault, not the caller's, so the client
gets a generic message and the real `error` code goes to the log.

### 4.3 `src/modules/auth/auth.validator.js`

```
code:  required unless `error` is present   (Joi .when('error', ...))
state: required
error: optional
location, accounts-server: optional
.unknown(true) stays — Zoho may add params
```

### 4.4 `src/modules/auth/auth.service.js`

```
pendingStates = new Map()   // state -> expiresAt
STATE_TTL = 10 min

getAuthorizeUrl()
  prune expired entries
  state = crypto.randomBytes(32).toString('hex')
  pendingStates.set(state, now + STATE_TTL)
  return authRepository.buildAuthorizeUrl(state)

handleCallback({ code, state, error, 'accounts-server': server })
  if error                         -> 400 "Zoho authorization was denied"
  expiresAt = pendingStates.get(state); pendingStates.delete(state)   // single use
  if !expiresAt or expired         -> 400 "Invalid or expired OAuth state, start again at /api/v1/auth/connect"
  if server and server !== config accountsUrl
                                   -> 400 "This Zoho account is in a different data centre; set ZOHO_ACCOUNTS_URL to <server>"
  tokens = await authRepository.exchangeCode(code)
  saved  = await authRepository.saveTokens(tokens)
  return toConnectionResponse(saved)

getStatus()
  return toConnectionResponse(await authRepository.getTokens())

refresh()
  current = await authRepository.getTokens()
  if !current?.refreshToken -> 401 "Zoho is not connected, visit /api/v1/auth/connect"
  try tokens = await authRepository.refreshAccessToken(current.refreshToken)
  catch 401 (refresh token revoked) -> clearTokens(), rethrow
  return toConnectionResponse(await authRepository.saveTokens(tokens))
```

The single-flight refresh lock (so parallel CRM calls do not each refresh)
belongs in the Zoho client in feature 2, not here. Noted, not built now.

### 4.5 `src/modules/auth/auth.dto.js`

Keep as is (`connected`, `expiresAt`, `apiDomain`). Add `scopes` from config
so a scope mismatch is visible in `/status`. Tokens stay out.

### 4.6 Unchanged

- `auth.controller.js`, `auth.routes.js`, `auth.repository.js` — already
  wired correctly.
- `.gitignore` already has `.tokens.json`.

### 4.7 Docs (repo rule: module is not done without its contract)

- `docs/api/auth.md` — four endpoints, request/response examples, every
  error case above with the reason.

---

## 5. Decisions and why

1. **State in memory, not a cookie/session.** Single-user local app with no
   session layer. A server restart between connect and callback loses the
   state, so the user just clicks connect again. Acceptable here; a
   multi-instance deployment would need Redis or a signed cookie.
2. **`.tokens.json` with mode 0600, atomic write.** No database in this
   project. Multi-tenant production would keep one encrypted token row per
   client instead (assessment Q8), and only `token.store.js` changes.
3. **Callback returns JSON, not a redirect to a frontend.** There is no
   frontend yet. Easy to change in the controller later.
4. **`accounts-server` is checked, not followed.** Zoho sends the user's
   data-centre accounts server in the callback. Using an arbitrary URL from
   a query string for a request carrying our client secret would let anyone
   point it at their own server. So it is only compared with the configured
   `ZOHO_ACCOUNTS_URL`.
5. **`authLimiter` is 10 requests / 15 min** on connect + callback. Fine for
   real use; if it gets in the way while testing, restart the server (the
   limiter is in memory).

---

## 6. How I will test it (manual, after coding)

```
1. npm run dev
2. curl localhost:5000/api/v1/auth/status          -> connected: false
3. browser: http://localhost:5000/api/v1/auth/connect
   -> Zoho consent -> Accept -> JSON "Zoho CRM connected successfully"
4. ls -l .tokens.json                               -> exists, -rw-------
5. curl localhost:5000/api/v1/auth/status           -> connected: true
6. restart server, repeat 5                          -> still connected
7. curl -X POST localhost:5000/api/v1/auth/refresh   -> expiresAt moved forward
```

Error cases:

```
8.  callback with a made-up state:
    /api/v1/auth/callback?code=x&state=fake          -> 400 invalid state
9.  open the same callback URL twice (reuse code)    -> 400 invalid state
10. click "Reject" on the Zoho consent page          -> 400 authorization denied
11. put garbage in .tokens.json refreshToken, restart,
    POST /auth/refresh                               -> 401 reconnect, file deleted
12. grep the server log for the access token value   -> no match
```

---

## 7. Out of scope for this step

- Automatic refresh before CRM calls, retry on 401 — Zoho client, feature 2.
- CRM error mapping (`zoho.errors.js`) — feature 5.
- Revoking the token at Zoho on disconnect — not required by the assessment.

---

## 8. Questions for review

- OK to return JSON from the callback (no frontend redirect)?
- OK with `.tokens.json` for storage, or do you want memory only?
- Anything to add to the error table?
