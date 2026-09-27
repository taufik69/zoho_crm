# Plan — Part 1, points 2, 3, 4: Read, Insert, Retrieve

Scope is exactly what the assessment asks, nothing extra:

> 2) Read data: retrieve records from Leads, Contacts, or Accounts. Display
>    Record ID, Name, Email, and one additional field.
> 3) Insert data: create a new Lead from your application using fields such
>    as First Name, Last Name, Company, Email, and Phone. The record must
>    actually appear in Zoho CRM.
> 4) Retrieve the inserted record using its returned Record ID.

Extras such as single-flight refresh and retry-once on 401 were
deliberately left out — they are not part of these three points.

Status: **done — verified against real Zoho on 2026-09-27.**
Sprint breakdown: [../specs/crm/README.md](../specs/crm/README.md).

---

## 1. How it works (all three points)

```
Client (curl / Postman / browser)
  -> our API  localhost:5000/api/v1/crm/...
     route -> validate -> asyncHandler(controller) -> service -> repository
       -> zoho.client.request(method, path, { query, body })
            1. read tokens from token.store       (none -> 401 "not connected")
            2. access token expires in < 60 s?  -> refresh via zoho.oauth, save
            3. fetch {apiDomain}/crm/v8{path}
               Authorization: Zoho-oauthtoken <accessToken>   (not "Bearer")
               timeout 10 s
            4. 204 -> null ; non-2xx -> zoho.errors.toAppError
  <- { success, statusCode, message, data }
```

Zoho is only reached through `zoho.client.js`; the token never leaves the
server.

---

## 2. Point 2 — Read data

**Endpoint:** `GET /api/v1/crm/:module?page=1&perPage=20`
`module` = `leads | contacts | accounts` (anything else → 400).

**Zoho call:** `GET /crm/v8/{Module}?fields=...&page=..&per_page=..`
(`fields` is mandatory in v8).

| Module | Zoho `fields` | Returned |
|---|---|---|
| leads | `Full_Name,Email,Company` | `{ id, name, email, company }` |
| contacts | `Full_Name,Email,Account_Name` | `{ id, name, email, accountName }` |
| accounts | `Account_Name,Phone` | `{ id, name, email: null, phone }` |

- Record ID = Zoho `id`, kept as a string (19 digits).
- Name = `Full_Name` (Leads/Contacts) or `Account_Name` (Accounts).
- Email = `Email` (Accounts have no email field → `null`).
- One additional field = `company` / `accountName` / `phone`.

**Response**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Records fetched successfully",
  "data": [
    { "id": "7617346000000512001", "name": "Christopher Maclead (Sample)",
      "email": "christopher-maclead@noemail.invalid", "company": "Rangoni Of Florence" }
  ],
  "pagination": { "page": 1, "perPage": 20, "hasMore": false }
}
```

**Files**

| File | Work |
|---|---|
| `src/shared/constants/zoho.js` | `CRM_MODULES`: slug → `{ apiName, fields }` |
| `crm.repository.js` | `findMany(apiName, { page, perPage, fields })` → `{ rows, hasMore }` |
| `crm.dto.js` | `toRecordResponse(moduleSlug, row)` per-module mapping |
| `crm.service.js` | `list(moduleSlug, { page, perPage })` |
| `crm.validator.js`, routes, controller | already done, unchanged |

---

## 3. Point 3 — Insert a Lead

**Endpoint:** `POST /api/v1/crm/leads`

**Body**

| Field | Rules | Zoho field |
|---|---|---|
| `firstName` | optional, trimmed, max 40 | `First_Name` |
| `lastName` | **required**, trimmed, max 80 | `Last_Name` |
| `company` | **required**, trimmed, max 200 | `Company` |
| `email` | optional, valid email, lowercased | `Email` |
| `phone` | optional, digits / `+ ( ) -` / spaces, 6–30 | `Phone` |

`lastName` and `company` are mandatory on Zoho Leads, so they are checked
before calling Zoho — the client gets a field-level 400 instead of a Zoho
error. Unknown fields are rejected.

**Zoho call:** `POST /crm/v8/Leads` with `{ "data": [ { First_Name, Last_Name, Company, Email, Phone } ] }`
→ Zoho answers `{ data: [ { code: "SUCCESS", details: { id, ... } } ] }`.

**Response — `201`**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Lead created successfully",
  "data": { "id": "7617346000000598001" }
}
```

"Must actually appear in Zoho CRM" → refresh the Leads list in the Zoho UI:
the new lead is there, Total Records goes 10 → 11.

**Files**

| File | Work |
|---|---|
| `crm.validator.js` | `createLeadSchema` rules above |
| `crm.dto.js` | `toLeadPayload`: camelCase → Zoho API names |
| `crm.repository.js` | `createLead(payload)` → `data[0].details` |
| `crm.service.js` | `createLead(body)` → `{ id }` |

---

## 4. Point 4 — Retrieve by Record ID

**Endpoint:** `GET /api/v1/crm/leads/:id` (`id` must be digits → else 400).

**Zoho call:** `GET /crm/v8/Leads/{id}` → `data[0]`.

**Response — `200`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Record fetched successfully",
  "data": { "id": "7617346000000598001", "name": "John Smith",
            "email": "john@example.com", "company": "ABC Ltd" }
}
```

Same DTO as point 2. Zoho returns 204 for an id that does not exist → our
404 `"Record not found"`.

**Files**

| File | Work |
|---|---|
| `crm.repository.js` | `findById(apiName, id)` → `data[0]` or `null` |
| `crm.service.js` | `getById(moduleSlug, id)` → 404 on `null` |

---

## 5. Shared integration files

| File | Work |
|---|---|
| `zoho.client.js` | `request()` as in §1 |
| `zoho.errors.js` | Zoho → `AppError`: 401 reconnect, `OAUTH_SCOPE_MISMATCH` 403, `DUPLICATE_DATA` 409, `MANDATORY_NOT_FOUND` / `INVALID_DATA` / `REQUIRED_PARAM_MISSING` 400 (+ field name), 429, else 502. Zoho's raw body never forwarded. |

---

## 6. Test steps

Prerequisite: server running, then browser
`http://localhost:5000/api/v1/auth/connect` → Accept.

```
Point 2
  curl localhost:5000/api/v1/crm/leads
    -> 10 leads, names match the Zoho Leads list
  curl localhost:5000/api/v1/crm/contacts
    -> 10 contacts with accountName

Point 3
  curl -X POST localhost:5000/api/v1/crm/leads \
    -H 'Content-Type: application/json' \
    -d '{"firstName":"John","lastName":"Smith","company":"ABC Ltd","email":"john@example.com","phone":"+8801700000000"}'
    -> 201 { id }
  Zoho UI -> Leads -> refresh -> "John Smith" present, Total Records 11

Point 4
  curl localhost:5000/api/v1/crm/leads/<id from point 3>
    -> John Smith, john@example.com, ABC Ltd
```

Already verified without Zoho:

- `/crm/foo` → 400 `module`
- `/crm/leads/abc` → 400 `id`
- POST without `lastName` / `company` → 400 naming both
- POST with bad email → 400 `email`
- any CRM call while not connected → 401 "Zoho is not connected"

---

## 7. Checklist

- [x] Point 2 code (constants, repository, DTO, service)
- [x] Point 3 code (validator, DTO payload, repository, service)
- [x] Point 4 code (repository, service 404)
- [x] Zoho client + error mapping
- [x] Validation tested
- [x] OAuth connect in browser
- [x] Point 2 tested against Zoho — 10 leads, contacts with accountName, accounts
- [x] Point 3 tested — lead `7617346000000702001` created, leads 10 → 11 via API
- [x] Point 4 tested with the returned id — John Smith / john@example.com / ABC Ltd; unknown id → 404
- [x] `docs/api/crm.md`
