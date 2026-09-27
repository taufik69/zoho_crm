# Plan — Part 1: Zoho CRM practical test

Source: `W3SCLOUD_Technical_Assessment_4hour_24hour.pdf`, Part 1 (features 1–5).
Status: plan only. No code has been written for this plan yet.

---

## 0. How "take data from Zoho" actually works

The CRM pages you open in the browser, for example

- `https://crm.zoho.com/crm/org940874010/tab/Leads/custom-view/7617346000000087501/list`
- `https://crm.zoho.com/crm/org940874010/tab/Contacts/custom-view/7617346000000087529/list`

are the **Zoho web UI**. The app never calls these URLs and never scrapes them.
They are useful for exactly two things:

1. Seeing the records exist (and, after feature 3, seeing the new Lead appear).
2. Demo video: showing the same record in the UI and in our API response.

The app reads and writes the same data through the **REST API**:

```
Browser UI : https://crm.zoho.com/crm/org940874010/tab/Leads/...
REST API   : https://www.zohoapis.com/crm/v8/Leads          <- what our code calls
```

- `org940874010` is the org id. The API does not need it in the URL; the
  access token already belongs to that org.
- `custom-view/...` is a saved UI filter. The API does not need it either.
- `www.zohoapis.com` is not hard-coded: the token response returns
  `api_domain`, and every CRM call uses that value (data-centre specific).

So the whole flow is:

```
You (browser/Postman)
  -> our Express API  (localhost:5000/api/v1/...)
     -> Zoho accounts server  (OAuth: get/refresh token)
     -> Zoho CRM REST API     (read / create records, with the token)
  <- our JSON envelope { success, statusCode, message, data }
```

---

## 1. Before any code (manual, in Zoho)

- [x] API console client created (Server-based app), `.env` filled:
      `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`,
      `ZOHO_REDIRECT_URI=http://localhost:5000/api/v1/auth/callback`.
- [ ] Confirm the redirect URI is saved (UPDATE clicked) in the API console.
- [ ] In CRM: Setup → Developer Hub → APIs & SDKs → **API Names**, open
      Leads / Contacts / Accounts and note the API names we use:
      - Leads: `First_Name`, `Last_Name`, `Full_Name`, `Company`, `Email`,
        `Phone`, `Lead_Source` (extra field)
      - Contacts: `Full_Name`, `Email`, `Phone`, `Account_Name`
      - Accounts: `Account_Name`, `Website`/`Phone` (no Email by default)
- [ ] Check which Lead fields are mandatory in this org (default:
      `Last_Name`, often `Company`). Setup → Modules and Fields → Leads.
- [ ] Make sure at least 2–3 Leads/Contacts exist (sample data is fine).

Scopes already in `.env`:
`ZohoCRM.modules.leads.ALL,ZohoCRM.modules.contacts.READ,ZohoCRM.modules.accounts.READ`
(enough for all five features).

---

## 2. Feature 1 — OAuth (15 pts)

Files: `src/integrations/zoho/zoho.oauth.js`, `token.store.js`,
`src/modules/auth/auth.service.js`, `auth.validator.js`.

Flow:

```
GET /api/v1/auth/connect
  -> service creates random `state` (crypto.randomBytes), keeps it in memory
     with a 10 min TTL, single use
  -> 302 redirect to
     {ZOHO_ACCOUNTS_URL}/oauth/v2/auth?scope=..&client_id=..&response_type=code
       &access_type=offline&prompt=consent&redirect_uri=..&state=..
  (user logs in to Zoho, clicks Accept)
GET /api/v1/auth/callback?code=..&state=..&accounts-server=..
  -> reject if `error=access_denied` (400) or unknown/expired state (400)
  -> POST {accounts}/oauth/v2/token (form-encoded)
       grant_type=authorization_code, client_id, client_secret,
       redirect_uri, code
  -> Zoho returns 200 even on failure: check body.error (invalid_code,
     invalid_client) -> AppError 400/401
  -> save { accessToken, refreshToken, expiresAt, apiDomain } to
     .tokens.json (gitignored) + memory
  -> 200 { connected: true, expiresAt, apiDomain }   (tokens never returned)
GET  /api/v1/auth/status   -> connected or not
POST /api/v1/auth/refresh  -> force a refresh (useful in the demo)
```

Tasks:
1. `zoho.oauth.js`: `buildAuthorizeUrl`, `exchangeCode`,
   `refreshAccessToken` using built-in `fetch` + `URLSearchParams`.
2. `token.store.js`: read/write `.tokens.json`; `saveTokens` keeps the old
   refresh token when a refresh response has none.
3. `auth.service.js`: state generation/verification, callback, status,
   refresh.
4. `auth.validator.js`: `code` required unless `error` present.

Done when: `/auth/connect` in the browser ends with
`"Zoho CRM connected successfully"` and `.tokens.json` exists.

---

## 3. Shared: Zoho HTTP client (needed by 2–5)

File: `src/integrations/zoho/zoho.client.js`.

`request(method, path, { query, body })`:
1. Load tokens. None -> AppError 401 "Zoho not connected, visit /auth/connect".
2. If `expiresAt - now < 60s` -> refresh first, save.
3. Call `${apiDomain}/crm/v8${path}` with header
   `Authorization: Zoho-oauthtoken <token>` and
   `signal: AbortSignal.timeout(10000)`.
4. 401 `INVALID_TOKEN` -> refresh once, retry once (never loop).
5. 204 -> return `null` (Zoho uses 204 for "no records").
6. Non-2xx, or 2xx whose `data[i].status === "error"` ->
   `toAppError(status, body)`.
7. Network error -> 502, timeout -> 504.

---

## 4. Feature 2 — Read records (20 pts, shared with 3/4)

Endpoint: `GET /api/v1/crm/:module?page=1&perPage=20`
(`module` = `leads | contacts | accounts`, already validated by Joi).

- Repository: `GET /{Module}?page&per_page&fields=...`
  — `fields` is **required** in API v8, otherwise Zoho returns
  `REQUIRED_PARAM_MISSING`.
- Fields per module (constant in `src/shared/constants/zoho.js`):
  - Leads: `Full_Name,Email,Company,Lead_Source`
  - Contacts: `Full_Name,Email,Account_Name,Phone`
  - Accounts: `Account_Name,Website,Phone`
- DTO `toRecordResponse(module, row)` ->
  `{ id, name, email, extra: { label, value } }`
  (`Account_Name` on Contacts is an object `{ name, id }`: take `.name`).
- Pagination from Zoho `info.more_records` ->
  `{ page, perPage, hasMore }`.

Done when: the list matches what the Leads / Contacts views show in the UI.

---

## 5. Feature 3 — Create a Lead (15 pts, with 4)

Endpoint: `POST /api/v1/crm/leads`

```json
{ "firstName": "John", "lastName": "Smith", "company": "ABC Ltd",
  "email": "john@example.com", "phone": "+8801XXXXXXXXX" }
```

1. Validator: `lastName` + `company` required, `email` valid email
   (lowercased), `phone` pattern, max lengths, unknown keys rejected.
2. DTO `toLeadPayload`: camelCase -> Zoho API names
   (`First_Name`, `Last_Name`, `Company`, `Email`, `Phone`).
3. Repository: `POST /Leads` with
   `{ data: [payload], duplicate_check_fields: ["Email"], trigger: [] }`.
4. Zoho answers 201 with `data[0].details.id`. A duplicate comes back as
   `DUPLICATE_DATA` -> 409 with the existing record id.
5. Response 201 `{ id, ...record }` (fetch it back via feature 4).

Done when: the new Lead shows up at
`crm.zoho.com/crm/org940874010/tab/Leads/...` (refresh the list).

---

## 6. Feature 4 — Get by Record ID

Endpoint: `GET /api/v1/crm/:module/:id` (id validated as digits, kept a string).

- Repository: `GET /{Module}/{id}` -> `data[0]`.
- 204 or `INVALID_DATA` on id -> AppError 404 "Record not found".
- Same DTO as the list.

Demo: take the `id` from feature 3's response, call this, show it matches.

---

## 7. Feature 5 — Error handling (10 pts)

File: `src/integrations/zoho/zoho.errors.js` (`toAppError`), plus validators.

| Scenario to demo | How to trigger | Expected response |
|---|---|---|
| Invalid/expired token | edit `.tokens.json` accessToken to garbage, call list | client refreshes and retries, 200 (show log line) |
| Revoked refresh token | also garble refreshToken | 401 "Zoho authorization expired, reconnect at /auth/connect" |
| Missing required field | `POST /crm/leads` without `lastName` | 400 "Validation failed" + `field: lastName` |
| Missing field at Zoho | (bypass Joi temporarily) | `MANDATORY_NOT_FOUND` -> 400 + `api_name` |
| Invalid module | `GET /crm/foo` | 400 "Validation failed", `field: module` |
| Record not found | `GET /crm/leads/123` | 404 |
| Duplicate | create same email twice | 409 |
| Scope problem | remove a scope and reconnect | `OAUTH_SCOPE_MISMATCH` -> 403 |
| Zoho down/timeout | set timeout very low | 504 / 502 |
| Unknown route | `GET /api/v1/nope` | 404 envelope |

Mapping in `toAppError`:
`INVALID_TOKEN`/`AUTHENTICATION_FAILURE` -> 401,
`OAUTH_SCOPE_MISMATCH` -> 403,
`MANDATORY_NOT_FOUND`/`INVALID_DATA` -> 400,
`INVALID_MODULE` -> 400, `DUPLICATE_DATA` -> 409,
429/`LIMIT_EXCEEDED` -> 429, 5xx -> 502, timeout -> 504.
Never forward Zoho's raw body; pick `code`, `details.api_name`, `details.id`.

---

## 8. Order of work (2–4 h budget)

1. OAuth + token store (feature 1) — test in browser. ~45 min
2. Zoho client + error mapping (shared, feature 5 core). ~40 min
3. Read list (feature 2). ~30 min
4. Create Lead + get by id (features 3, 4). ~40 min
5. Error demo pass (table above). ~20 min
6. README (install, env vars, OAuth setup, endpoints, sample req/res),
   `docs/api/auth.md`, `docs/api/crm.md`. ~30 min

## 9. Demo / submission checklist (Part 3)

- [ ] Show CRM account (Leads list in UI).
- [ ] `/auth/connect` -> consent -> connected.
- [ ] List Leads/Contacts via API.
- [ ] Create Lead via API -> refresh Zoho UI -> it's there.
- [ ] Get it by returned id.
- [ ] At least one handled error (invalid module + missing field + expired token).
- [ ] Blur client secret, tokens, personal data in video/README.
- [ ] Regenerate client secret before submission (it was shared in chat).
- [ ] AI usage note: Claude Code — what it helped with, what you changed.
