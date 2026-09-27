[Postman API Documentation](https://documenter.getpostman.com/view/23337783/2sBYB4KRyd)

# Zoho CRM Integration

A small Node.js + Express API that connects to Zoho CRM through OAuth 2.0 and
reads, creates and retrieves CRM records.

Built for the W3SCLOUD technical assessment, Part 1:

| # | Requirement | Endpoint |
|---|---|---|
| 1 | OAuth — obtain an access token through the real OAuth flow | `GET /api/v1/auth/connect` → `GET /api/v1/auth/callback` |
| 2 | Read Leads / Contacts / Accounts — Record ID, Name, Email + one field | `GET /api/v1/crm/:module` |
| 3 | Create a Lead that appears in Zoho CRM | `POST /api/v1/crm/leads` |
| 4 | Retrieve the created record by its Record ID | `GET /api/v1/crm/:module/:id` |
| 5 | Error handling — invalid/expired token, missing field, invalid module, API errors | see [Error handling](#error-handling) |

No token is hard-coded. The access token is obtained through the consent
flow, stored server-side, refreshed automatically, and never returned to a
client.

---

## Requirements

- Node.js **22+** (uses built-in `fetch`; see `.nvmrc`)
- A Zoho CRM account (the free edition works)

## Installation

```bash
git clone <repo-url>
cd zoho-crm-integration
npm install
cp .env.example .env
```

## Zoho OAuth configuration

1. Open the Zoho API Console for your data centre —
   `https://api-console.zoho.com` (`.eu`, `.in`, `.com.au`, … for other DCs).
2. **Add Client → Server-based Applications.**
3. Fill in:
   - Client Name: anything (e.g. `CRM Integration Test App`)
   - Homepage URL: `http://localhost:5000`
   - Authorized Redirect URI: `http://localhost:5000/api/v1/auth/callback`
4. Create, then open **Client Secret** and copy the Client ID and Client
   Secret into `.env`.

The redirect URI must match `ZOHO_REDIRECT_URI` character for character, or
Zoho rejects the authorization request.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | yes | — | HTTP port (`5000`) |
| `NODE_ENV` | no | `development` | `production` hides stack traces in error responses |
| `ZOHO_CLIENT_ID` | yes | — | From the API Console |
| `ZOHO_CLIENT_SECRET` | yes | — | From the API Console — **never commit it** |
| `ZOHO_REDIRECT_URI` | yes | — | `http://localhost:5000/api/v1/auth/callback` |
| `ZOHO_ACCOUNTS_URL` | no | `https://accounts.zoho.com` | Accounts server of your data centre |
| `ZOHO_SCOPES` | no | `ZohoCRM.modules.leads.ALL,ZohoCRM.modules.contacts.READ,ZohoCRM.modules.accounts.READ` | Changing it requires reconnecting |
| `CLIENT_ORIGIN` | no | `*` | Allowed CORS origin |
| `LOG_LEVEL` | no | `debug` (dev) / `info` (prod) | Pino log level |

The server refuses to start if a required variable is missing.

## Run

```bash
npm run dev     # nodemon, restarts on change
npm start       # plain node
```

Then connect Zoho once, **in a browser**:

```
http://localhost:5000/api/v1/auth/connect
```

Log in to Zoho, click **Accept**, and you should see
`"Zoho CRM connected successfully"`. The tokens are saved to `.tokens.json`
(gitignored, file mode `0600`), so the connection survives restarts. The
access token lasts one hour and is refreshed automatically from the refresh
token — you do not need to connect again.

---

## Endpoints

Every response uses one envelope:

```json
{ "success": true, "statusCode": 200, "message": "...", "data": {} }
```

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/api/v1/auth/connect` | Redirects to the Zoho consent page |
| GET | `/api/v1/auth/callback` | Zoho redirects here; exchanges the code, stores tokens |
| GET | `/api/v1/auth/status` | Connected or not (never returns a token) |
| POST | `/api/v1/auth/refresh` | Force an access-token refresh |
| GET | `/api/v1/crm/:module?page=&perPage=` | List records — `module` = `leads` \| `contacts` \| `accounts` |
| POST | `/api/v1/crm/leads` | Create a Lead |
| GET | `/api/v1/crm/:module/:id` | Get one record by Record ID |

**Postman:** [View the published API documentation](https://documenter.getpostman.com/view/23337783/2sBYB4KRyd), or import `postman/zoho-crm-integration.postman_collection.json`
(and optionally `postman/zoho-crm-local.postman_environment.json`). Folders
follow the assessment points 1–5; *Create Lead* stores the returned id in
`{{leadId}}` for *Get Lead by ID*.

Full contracts, including every error case and the reasoning behind it:
[`docs/api/auth.md`](docs/api/auth.md), [`docs/api/crm.md`](docs/api/crm.md).

### Fields returned

| Module | Returned |
|---|---|
| `leads` | `id`, `name`, `email`, `company` |
| `contacts` | `id`, `name`, `email`, `accountName` |
| `accounts` | `id`, `name`, `email` (always `null` — Zoho Accounts have no Email field), `phone` |

Record IDs are strings: Zoho IDs are 19 digits, beyond JavaScript's safe
integer range.

---

## Examples

### Connection status

```bash
curl http://localhost:5000/api/v1/auth/status
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection status fetched successfully",
  "data": {
    "connected": true,
    "expiresAt": "2026-09-27T06:39:45.555Z",
    "apiDomain": "https://www.zohoapis.com",
    "scopes": ["ZohoCRM.modules.leads.ALL", "ZohoCRM.modules.contacts.READ", "ZohoCRM.modules.accounts.READ"]
  }
}
```

### 2 — Read records

```bash
curl "http://localhost:5000/api/v1/crm/leads?page=1&perPage=2"
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Records fetched successfully",
  "data": [
    {
      "id": "7617346000000698112",
      "name": "Christopher Maclead (Sample)",
      "email": "christopher-maclead@noemail.invalid",
      "company": "Rangoni Of Florence"
    },
    {
      "id": "7617346000000698111",
      "name": "Carissa Kidman (Sample)",
      "email": "carissa-kidman@noemail.invalid",
      "company": "Oh My Goodknits Inc"
    }
  ],
  "pagination": { "page": 1, "perPage": 2, "hasMore": true }
}
```

### 3 — Create a Lead

```bash
curl -X POST http://localhost:5000/api/v1/crm/leads \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "company": "ABC Ltd",
    "email": "john@example.com",
    "phone": "+8801700000000"
  }'
```

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Lead created successfully",
  "data": { "id": "7617346000000702001" }
}
```

| Field | Rules |
|---|---|
| `firstName` | optional, max 40 |
| `lastName` | **required**, max 80 |
| `company` | **required**, max 200 |
| `email` | optional, valid email |
| `phone` | optional, digits / `+ ( ) -` / spaces, 6–30 chars |

The lead appears in Zoho CRM → Leads immediately.

### 4 — Retrieve by Record ID

```bash
curl http://localhost:5000/api/v1/crm/leads/7617346000000702001
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Record fetched successfully",
  "data": {
    "id": "7617346000000702001",
    "name": "John Smith",
    "email": "john@example.com",
    "company": "ABC Ltd"
  }
}
```

---

## Error handling

Errors use the same envelope with `success: false`. Zoho's raw error body is
never forwarded; stack traces appear only when `NODE_ENV=development`.

| Scenario | How to reproduce | Response |
|---|---|---|
| Invalid module | `GET /api/v1/crm/deals` | `400 Validation failed` — `field: module` |
| Missing required field | `POST /api/v1/crm/leads` with `{"firstName":"A"}` | `400 Validation failed` — `lastName`, `company` |
| Missing field rejected by Zoho | (validator bypassed) | `400 Zoho CRM rejected the request` — `code: MANDATORY_NOT_FOUND, field: Last_Name` |
| Malformed JSON | `-d '{bad'` | `400 Malformed JSON body` |
| Invalid record id | `GET /api/v1/crm/leads/abc` | `400 Validation failed` — `field: id` |
| Record not found | `GET /api/v1/crm/leads/7617346000000000001` | `404 Record not found` |
| Expired access token | set `expiresAt` in `.tokens.json` to `1`, restart | refreshed automatically → `200` |
| Invalid access token | set `accessToken` to garbage, restart | Zoho `INVALID_TOKEN` → refresh once, retry → `200` |
| Invalid / revoked refresh token | garbage `accessToken` **and** `refreshToken` | `401 Zoho authorization expired, reconnect` — tokens cleared |
| Not connected | delete `.tokens.json`, restart | `401 Zoho is not connected, visit /api/v1/auth/connect` |
| Missing scope | call a module outside `ZOHO_SCOPES` | Zoho `OAUTH_SCOPE_MISMATCH` → `403` |
| Zoho down / slow | unreachable or > 10 s | `502` / `504` |
| Unknown route | `GET /api/v1/nope` | `404 Route not found` |
| Rate limit | > 10 auth calls or > 100 creates in 15 min | `429` |

Example:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "data": [
    { "field": "lastName", "message": "\"lastName\" is required" },
    { "field": "company", "message": "\"company\" is required" }
  ]
}
```

---

## Project structure

```
index.js                         server start, graceful shutdown
src/
  app.js                         middleware, routes, 404, error handler (last)
  config/                        env validation, pino logger
  integrations/zoho/
    zoho.oauth.js                authorize URL, code exchange, refresh
    token.store.js               tokens in memory + .tokens.json (0600, atomic write)
    zoho.client.js               the only Zoho CRM HTTP client
    zoho.errors.js               Zoho error → AppError
  modules/
    auth/                        routes · controller · service · repository · dto · validator
    crm/                         routes · controller · service · repository · dto · validator
  shared/                        ApiResponse, AppError, asyncHandler, middlewares, constants
docs/api/                        API contracts (auth.md, crm.md)
```

Request flow: `route → validate → asyncHandler(controller) → service →
repository → zoho.client → Zoho`. Services throw `AppError`; the global
error handler is the only place an error becomes a response.

## Security notes

- Client secret only in `.env`; tokens only in `.tokens.json`. Both gitignored.
- No token or secret is ever returned in a response.
- Logger redacts token fields; the request log masks the OAuth `code` and
  `state` in callback URLs.
- OAuth `state` (random, single use, 10 min) protects the callback against
  CSRF.
- The `accounts-server` value Zoho sends on callback is compared with config,
  never called — it would otherwise receive the client secret.
- Helmet, CORS, rate limiting on auth and create endpoints.
- Production would store one encrypted token set per client in a database;
  only `token.store.js` would change.

---

## AI usage

- **Tool:** Claude Code (Anthropic).
- **What it helped with:** planning the OAuth and CRM work, writing the
  OAuth flow, token store, Zoho client and error mapping, CRM read/create/get
  endpoints, the API contract docs and this README; running the endpoint tests
  against a live Zoho account and finding bugs (malformed JSON returning 500,
  `OAUTH_SCOPE_MISMATCH` arriving as HTTP 401, no retry on an invalid access
  token, the callback `code` appearing in request logs).
- **What I changed / decided:** I reviewed the requirements, plans, and sprint specs before implementation. I chose Node.js and Express, kept the work within the assessment scope, and made the final decisions on validation, field mapping, OAuth configuration, and error responses.
- **Problems solved:** I fixed the redirect URI mismatch, malformed JSON returning `500`, `OAUTH_SCOPE_MISMATCH` being reported as `401`, missing retry for invalid access tokens, stale credentials after refresh-token rejection, authorization codes appearing in logs, and inaccurate pagination totals.
- **Workflow details:** See [AI Usage Statement](AI_USAGE.md) for how I used Claude Code, project skills, agent reviews, plans, specs, and sprints.
