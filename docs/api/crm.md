# CRM API Contract

Module: `src/modules/crm/`
Route prefix: `/api/v1/crm`
Integration: `src/integrations/zoho/zoho.client.js`, `src/integrations/zoho/zoho.errors.js`
Config: `src/shared/constants/zoho.js`

> **Sibling-contract check:** response envelope, `AppError` shape,
> validation-error shape (`data: [{ field, message }]`) and the rate-limiter
> precedent (`apiLimiter` on writes) match `auth.md` exactly.
>
> CRM diverges in the following deliberate ways:
>
> 1. **List pagination is `{ page, perPage, hasMore }`, not
>    `ApiResponse.paginated`'s `{ page, limit, total, totalPages }`.** Zoho's
>    list response has no total count — only `info.more_records`. A total
>    would cost a second Zoho call per page. The controller therefore uses
>    `ApiResponse.success(..., { pagination })`.
> 2. **No guard middleware.** Every call runs as the one Zoho connection held
>    by the server (see `auth.md`, divergence 1).
> 3. **Reads have no rate limiter; the create does (`apiLimiter`).** Zoho
>    enforces its own API credit limit per org; our limiter exists on the
>    write so a script cannot fill the CRM with leads.

---

## Record model — read this before any endpoint below

- **Record ID is Zoho's `id`, always a string.** Zoho ids are 19 digits,
  beyond JavaScript's safe integer range (2^53); as a number they would be
  silently rounded to a different record. The `:id` param is validated as
  digits only, and kept a string end to end.
- **Module slugs.** Clients use lowercase slugs; the service maps them to
  Zoho API names (case-sensitive in Zoho URLs). Only these three are allowed —
  anything else is rejected by the validator before a Zoho call, so an
  arbitrary path segment never reaches Zoho.

  | Slug | Zoho module | Fields requested | Response item |
  |---|---|---|---|
  | `leads` | `Leads` | `Full_Name,Email,Company` | `{ id, name, email, company }` |
  | `contacts` | `Contacts` | `Full_Name,Email,Account_Name` | `{ id, name, email, accountName }` |
  | `accounts` | `Accounts` | `Account_Name,Phone` | `{ id, name, email: null, phone }` |

- **Field names.** Our bodies use camelCase; Zoho uses field API names
  (`First_Name`), which are not the UI labels ("First Name"). All translation
  is in `crm.dto.js`; a field reaches Zoho or the client only if listed there.
- **Accounts have no Email field** in a default Zoho org, so `email` is
  `null` rather than an invented value.
- **Lookups.** `Contacts.Account_Name` is an object `{ name, id }` in Zoho;
  only `name` is returned.

## Zoho connection and tokens

Every call goes through `zoho.client.js`:

1. No stored tokens → `401 "Zoho is not connected, visit /api/v1/auth/connect"`.
2. Access token expiring within 60 s → refreshed first, saved, then used — the
   caller never sees an expired token.
3. `GET|POST {apiDomain}/crm/v8{path}` with
   `Authorization: Zoho-oauthtoken <token>` (Zoho rejects `Bearer`).
4. Zoho `401 INVALID_TOKEN` (access token revoked or corrupt before its
   expiry) → refresh once, retry once, never loop. The caller gets the data.
5. `204` → treated as "no data" (empty list / record not found).
6. Any other non-2xx → `zoho.errors.js`.

If Zoho rejects the **refresh** token (step 2 or 4), the stored tokens are
cleared and the call answers `401` "reconnect": a dead refresh token left on
disk would keep `/auth/status` saying `connected: true` while every call
fails.

## Zoho failure modes

| Condition | Behaviour | Why |
|---|---|---|
| `OAUTH_SCOPE_MISMATCH` | `403 "Zoho token lacks the scope for this module, reconnect"` | Token was issued without this module's scope; reconnect after changing `ZOHO_SCOPES`. Zoho sends this with HTTP **401**, so the code is checked before the status — otherwise it would read as "reconnect". |
| Zoho `401` after the one retry | `401 "Zoho authorization expired, reconnect at /api/v1/auth/connect"` | Our credential, not the caller's. |
| `DUPLICATE_DATA` | `409`, `data.field` = Zoho `api_name` | Zoho duplicate rule matched. |
| `MANDATORY_NOT_FOUND`, `INVALID_DATA`, `REQUIRED_PARAM_MISSING` | `400 "Zoho CRM rejected the request"`, `data: { code, field }` | The field name tells the caller what to fix. |
| Zoho `429` | `429` | Zoho API credits exhausted. |
| Unreachable / no answer in 10 s | `502` / `504` | Dependency failure, not ours — never 500. |
| Anything else | `502 "Zoho CRM returned an error"`, Zoho code logged | Zoho's raw body is never forwarded. |

## Caching

List and record GET responses use Redis with a configurable TTL
(`REDIS_CACHE_TTL_SECONDS`, default 300). Cache keys include a global CRM
version. A successful lead create increments that version, so subsequent GETs
use fresh keys immediately; old entries expire by TTL. Redis is optional: if it
is unavailable, requests bypass the cache and read from Zoho. Configure it with
`REDIS_URL` (default `redis://localhost:6379`).

## Account enumeration

Not applicable — there is one CRM connection, and every caller sees the same
records.

---

## 1. `GET /api/v1/crm/:module`

Lists records of one module (assessment point 2). Public. No limiter.

**Params / Query**

| Field | Rules |
|---|---|
| `module` | `leads` \| `contacts` \| `accounts`, case-insensitive |
| `page` | integer ≥ 1, default 1 |
| `perPage` | integer 1–200, default 20 — 200 is Zoho's `per_page` maximum |

**`200`**

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
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "hasMore": false }
}
```

Only the listed fields are requested from Zoho (`fields` is mandatory on v8
list calls), so nothing else about a record can leak into a response. An
empty module answers `200` with `data: []`.

**Errors**

| Status | When |
|---|---|
| `400` | validation — unknown module, `page`/`perPage` out of range |
| `401` | Zoho not connected, or authorization expired |
| `403` | token lacks the module's scope |
| `429` / `502` / `504` | see Zoho failure modes |

---

## 2. `POST /api/v1/crm/leads`

Creates a Lead in Zoho (assessment point 3). Public. `apiLimiter`
(15 min / 100).

**Body**

| Field | Rules | Zoho field |
|---|---|---|
| `firstName` | string, trimmed, max 40, optional | `First_Name` |
| `lastName` | string, trimmed, max 80, **required** | `Last_Name` |
| `company` | string, trimmed, max 200, **required** | `Company` |
| `email` | valid email, trimmed, lowercased, max 100, optional | `Email` |
| `phone` | `+`, digits, spaces, `()` and `-`, 6–30 chars, optional | `Phone` |

`lastName` and `company` are mandatory on Zoho Leads; checking them here
gives a field-level 400 in our own shape before any Zoho call. Lengths follow
Zoho's field limits. Unknown fields are rejected — only mapped fields may
reach the CRM.

**`201`**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Lead created successfully",
  "data": { "id": "7617346000000702001" }
}
```

The record exists in Zoho when this returns — it appears in the CRM Leads
list and is readable via endpoint 3 with the returned `id`. The call is not
idempotent: sending the same body twice creates two leads unless the org's
own Zoho duplicate rule rejects the second (→ `409`).

**Errors**

| Status | When |
|---|---|
| `400` | validation — `data: [{ field, message }]` |
| `400` | `"Malformed JSON body"` — body is not valid JSON (global handler) |
| `400` | Zoho rejected a field — `data: { code, field }` |
| `401` / `403` | not connected / expired / missing `ZohoCRM.modules.leads` scope |
| `409` | Email or phone already exists, or a Zoho duplicate rule matched |
| `429` | `apiLimiter`, or Zoho API credits |
| `502` / `504` | Zoho unreachable / timed out |

---

## 3. `GET /api/v1/crm/:module/:id`

Fetches one record by its Record ID (assessment point 4). Public. No limiter.

**Params**

| Field | Rules |
|---|---|
| `module` | `leads` \| `contacts` \| `accounts` |
| `id` | digits only, kept a string |

**`200`**

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

Same response item as endpoint 1, so a record reads identically in the list
and by id.

**Errors**

| Status | When |
|---|---|
| `400` | validation — unknown module, non-numeric `id` |
| `401` / `403` | see endpoint 1 |
| `404` | `"Record not found"` — Zoho answers `204` for an id that does not exist in that module |
| `429` / `502` / `504` | see Zoho failure modes |
