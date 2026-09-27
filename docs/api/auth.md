# Auth API Contract

Module: `src/modules/auth/`
Route prefix: `/api/v1/auth`
Integration: `src/integrations/zoho/zoho.oauth.js`, `src/integrations/zoho/token.store.js`

> **Sibling-contract check:** response envelope (`{ success, statusCode,
> message, data }` via `ApiResponse`), `AppError` shape, validation-error shape
> (`data: [{ field, message }]` from `shared/middlewares/validate.js`) and the
> rate-limiter precedent (`authLimiter` / `apiLimiter` from
> `shared/middlewares/rateLimiter.js`) match the only sibling module, `crm`
> (`docs/api/crm.md`, not yet written — this is the first contract).
>
> Auth diverges from a typical auth module in the following deliberate ways:
>
> 1. **It authenticates the app to Zoho, not a user to the app.** There is no
>    login, no user table and no session. "Connected" means the server holds a
>    Zoho token set; every caller of `/api/v1/crm/*` uses that one connection.
>    A per-user auth layer in front of this API is out of scope for the
>    assessment and would be added as `authGuard` on the routes, not here.
> 2. **`/connect` answers `302`, not the envelope.** A browser must follow it to
>    Zoho's consent page; wrapping the URL in JSON would require a frontend to
>    do the redirect, and there is none.
> 3. **The callback answers JSON, not a redirect to a frontend.** Same reason.
>    It is one line in `auth.controller.js` to change once a frontend exists.
> 4. **No tokens are ever returned.** Every response goes through
>    `auth.dto.js`, which picks connection facts field by field. A client that
>    needs to call Zoho does it through `/api/v1/crm/*`, never with a token of
>    its own.

---

## Connection model — read this before any endpoint below

- **One Zoho connection per server.** The token set is
  `{ accessToken, refreshToken, expiresAt, apiDomain }`, held in memory and in
  `.tokens.json` at the project root. Connecting again replaces it.
- **States:** `not connected` → (`/connect` + consent + `/callback`) →
  `connected` → (`/refresh` rejected by Zoho) → `not connected`. There is no
  explicit disconnect endpoint; deleting `.tokens.json` and restarting has
  the same effect.
- **`apiDomain` comes from Zoho, not config.** Zoho returns the CRM host for
  the account's data centre in every token response; the CRM client must use
  it. Only the accounts server (`ZOHO_ACCOUNTS_URL`) is configured.

---

## Tokens

| | Access token | Refresh token | OAuth `state` |
|---|---|---|---|
| Issued by | Zoho, on code exchange and on refresh | Zoho, on code exchange only | this server, on `/connect` |
| Lifetime | 1 hour (`expires_in: 3600`) | until revoked in Zoho | 10 min (`STATE_TTL_MS`, code constant) |
| Stored | memory + `.tokens.json` (0600) | memory + `.tokens.json` (0600) | memory only |
| Reusable | yes, until expiry | yes | **no — single use** |
| Returned to clients | never | never | only inside the Zoho redirect URL |

- **Why the refresh token is persisted to disk.** Zoho issues it once, on
  consent. Memory-only storage means every restart (nodemon restarts on every
  save) sends the user back through consent. The file is written with mode
  `0600` via temp file + `rename`, so a crash mid-write never leaves a
  half-written file that would read as "not connected".
- **Why a refresh keeps the old refresh token.** A refresh response has no
  `refresh_token`; the store merges instead of replacing. Replacing would drop
  the refresh token and the app would stop working an hour later.
- **Why `access_type=offline` and `prompt=consent`.** Without `offline` Zoho
  issues no refresh token at all; without `consent` a re-authorization issues
  no new one. Either omission yields an app that works for one hour.
- **What a stolen `.tokens.json` buys.** Full access to the scopes below until
  the refresh token is revoked in Zoho (Accounts → Connected Apps). This is
  why the file is 0600 and gitignored, and why production would move to an
  encrypted store — only `token.store.js` changes.

Scopes (`ZOHO_SCOPES`):
`ZohoCRM.modules.leads.ALL, ZohoCRM.modules.contacts.READ, ZohoCRM.modules.accounts.READ`.
Changing them requires reconnecting — a stored token keeps the scopes it was
issued with (`OAUTH_SCOPE_MISMATCH` otherwise).

## Configuration

| Setting | Env var | Default |
|---|---|---|
| Client id | `ZOHO_CLIENT_ID` | required |
| Client secret | `ZOHO_CLIENT_SECRET` | required |
| Redirect URI (must match the API console character for character) | `ZOHO_REDIRECT_URI` | required |
| Accounts server (data centre) | `ZOHO_ACCOUNTS_URL` | `https://accounts.zoho.com` |
| Scopes | `ZOHO_SCOPES` | the three above |
| Token request timeout | — (code constant `TOKEN_REQUEST_TIMEOUT_MS`) | 10 s |

Setup: register a **Server-based Application** at `https://api-console.zoho.com`
(the console for your data centre), set Authorized Redirect URI to
`http://localhost:5000/api/v1/auth/callback`, copy the client id and secret
into `.env`.

## CSRF — the `state` parameter

Without `state`, anyone could send a victim's browser to our callback with
**their own** authorization code, connecting this server to the attacker's CRM
(every lead created afterwards lands in the attacker's account). So:

- `/connect` generates 32 random bytes (hex) and remembers them for 10 min.
- `/callback` looks the value up **and deletes it** in the same step, so a
  replayed callback URL fails even inside the TTL.
- Expired entries are pruned on every `/connect`, so abandoned attempts cannot
  grow the map without bound.

Kept in memory because this is a single-user, single-process app: a restart
between connect and callback just means clicking connect again. A
multi-instance deployment needs Redis or a signed cookie instead.

## Data-centre check (`accounts-server`)

Zoho appends `accounts-server` to the callback for multi-DC accounts. It is
**compared** with `ZOHO_ACCOUNTS_URL` and never called: the token request
carries our client secret, and following a URL taken from a query string
would send that secret wherever an attacker pointed it. A mismatch is a 400
telling the operator which value to configure.

## Rate limiting

| Limiter | Window / max | Applied to | Why |
|---|---|---|---|
| `authLimiter` | 15 min / 10 | `/connect`, `/callback`, `/refresh` | Each hits Zoho's token endpoint (or starts a flow that will). Zoho throttles that endpoint per client and answers "Access Denied" when exceeded — failing here first keeps our client id out of Zoho's penalty box. |
| none | — | `/status` | Local read, no Zoho call. |

The limiter is in memory; restarting the server resets it (useful while
testing).

## Account enumeration

Not applicable: no endpoint takes a user-supplied identifier. **Known residual
oracle:** `/status` tells any caller whether the server is connected and to
which API domain. Acceptable for a local assessment app; behind a real
deployment it would sit behind `authGuard`.

## Caching

Nothing is cached beyond the token set itself (see Tokens). `/status` reads
the in-memory copy, which is the source of truth after the first read.

## Zoho accounts server failure modes

| Condition | Behaviour | Why |
|---|---|---|
| Unreachable (DNS, connection refused) | `502 "Could not reach Zoho accounts server"`, logged | Our code did not fail, the dependency did — 500 would point at us. |
| No answer in 10 s | `504 "Zoho accounts server timed out"` | Without a timeout a hung Zoho call holds the client's request open indefinitely. |
| Zoho throttling (`Access Denied`) | `429 "Too many token requests, try again later"` | The caller can retry later; nothing is wrong with the request. |
| Client misconfigured (`invalid_client`, `invalid_client_secret`, `invalid_redirect_uri`) | `500 "Zoho client is misconfigured"`, real code logged | Our configuration, not the caller's input. The Zoho code names what is wrong with our credentials; it goes to the log, not the wire. |
| Any other Zoho error | `502 "Zoho accounts server returned an error"`, real code logged | Unknown upstream failure. |

Zoho answers most of these with **HTTP 200** and `{ "error": "..." }` in the
body, so `zoho.oauth.js` checks the body, not only the status. The request
body is never logged — it holds the client secret and the code or refresh
token. The logger additionally redacts `access_token`, `refresh_token`,
`client_secret`, `accessToken` and `refreshToken` at any depth
(`src/config/logger.js`).

---

## Auth

No guard middleware. These endpoints set up the server's own Zoho connection;
there is no user identity in this app to guard them with (see divergence 1).

---

## 1. `GET /api/v1/auth/connect`

Starts the OAuth flow. Public. `authLimiter`.

No body, no query.

**`302`**

```
Location: https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.leads.ALL%2CZohoCRM.modules.contacts.READ%2CZohoCRM.modules.accounts.READ&client_id=1000.XXXXXXXX&response_type=code&access_type=offline&prompt=consent&redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fapi%2Fv1%2Fauth%2Fcallback&state=3f9c…
```

Open it in a browser, not with `curl` — the point is the Zoho login and
consent page. The client secret is never in this URL (it ends up in browser
history). Every call issues a new `state`; earlier ones stay valid until used
or expired, so two tabs can race without breaking each other.

**Errors**

| Status | When |
|---|---|
| `429` | `authLimiter` |

---

## 2. `GET /api/v1/auth/callback`

Zoho redirects the browser here after consent. Exchanges the code and stores
the tokens. Public (it has to be — Zoho's redirect carries no credentials of
ours); protected by `state`. `authLimiter`.

**Query**

| Field | Rules |
|---|---|
| `code` | string, trimmed; required unless `error` is present |
| `state` | string, trimmed, required |
| `error` | string, optional — Zoho sets `access_denied` when the user clicks Reject |
| `location` | string, optional — Zoho's DC hint, unused |
| `accounts-server` | URI, optional — compared, never called |

Unknown keys are allowed: Zoho may append parameters of its own, and failing
on one would break a legitimate callback.

**`200`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Zoho CRM connected successfully",
  "data": {
    "connected": true,
    "expiresAt": "2026-09-27T06:12:44.120Z",
    "apiDomain": "https://www.zohoapis.com",
    "scopes": [
      "ZohoCRM.modules.leads.ALL",
      "ZohoCRM.modules.contacts.READ",
      "ZohoCRM.modules.accounts.READ"
    ]
  }
}
```

Checks run in this order, and each stops the flow: user denied → `state`
valid → data centre matches → code exchange. `state` is consumed even when a
later step fails, so a failed callback must be restarted from `/connect`.
Reloading this URL after success is a 400 (state already used) — it does not
reconnect and does not touch the stored tokens.

**Errors**

| Status | When |
|---|---|
| `400` | validation failure — `data: [{ field, message }]` (`code` or `state` missing) |
| `400` | `"Zoho authorization was denied"` — user clicked Reject |
| `400` | `"Invalid or expired OAuth state, start again at /api/v1/auth/connect"` — unknown, reused, or older than 10 min. One message for all three: the fix is the same. |
| `400` | `"This Zoho account is in a different data centre; set ZOHO_ACCOUNTS_URL to <server>"` |
| `400` | `"Authorization code is invalid or expired, reconnect"` — Zoho `invalid_code` (codes live ~2 min and are single use) |
| `429` | `authLimiter`, or Zoho throttling |
| `500` | `"Zoho client is misconfigured"` — see failure modes |
| `502` / `504` | Zoho accounts server unreachable / timed out |

---

## 3. `GET /api/v1/auth/status`

Whether the server holds a Zoho token set. Public. No limiter (local read).

**`200` — not connected**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection status fetched successfully",
  "data": { "connected": false }
}
```

**`200` — connected**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection status fetched successfully",
  "data": {
    "connected": true,
    "expiresAt": "2026-09-27T06:12:44.120Z",
    "apiDomain": "https://www.zohoapis.com",
    "scopes": ["ZohoCRM.modules.leads.ALL", "ZohoCRM.modules.contacts.READ", "ZohoCRM.modules.accounts.READ"]
  }
}
```

Not connected is a normal answer, not a `401`: the question was asked
successfully. `expiresAt` in the past does **not** mean disconnected — the
refresh token still works; the CRM client refreshes before its next call.
`scopes` is the configured list, so an `OAUTH_SCOPE_MISMATCH` from a CRM call
can be diagnosed from this response alone.

**Errors**

None expected beyond a `500` on an unreadable disk.

---

## 4. `POST /api/v1/auth/refresh`

Forces an access-token refresh from the stored refresh token. Public.
`authLimiter`. Normal CRM calls refresh automatically; this endpoint exists to
demonstrate and debug the refresh path.

No body.

**`200`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Access token refreshed successfully",
  "data": {
    "connected": true,
    "expiresAt": "2026-09-27T07:14:02.511Z",
    "apiDomain": "https://www.zohoapis.com",
    "scopes": ["ZohoCRM.modules.leads.ALL", "ZohoCRM.modules.contacts.READ", "ZohoCRM.modules.accounts.READ"]
  }
}
```

The refresh token is unchanged (Zoho does not rotate it). If Zoho rejects the
refresh token — revoked in Zoho, or the stored value is corrupt — the stored
token set is **deleted** before the 401 is returned: a dead refresh token left
on disk would keep `/status` saying `connected: true` while every CRM call
fails.

**Errors**

| Status | When |
|---|---|
| `401` | `"Zoho is not connected, visit /api/v1/auth/connect"` — no stored refresh token |
| `401` | `"Zoho authorization expired, reconnect at /api/v1/auth/connect"` — Zoho rejected the refresh token; stored tokens cleared |
| `429` | `authLimiter`, or Zoho throttling |
| `500` | `"Zoho client is misconfigured"` |
| `502` / `504` | Zoho accounts server unreachable / timed out |
