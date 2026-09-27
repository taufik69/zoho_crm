# CRM sprint 4 — Point 2: list records

Plan ref: crm-read-insert-plan.md §2
Depends on: sprints 1–3
Files: `crm.repository.js`, `crm.dto.js`, `crm.service.js`

## Goal

> Retrieve records from Leads, Contacts, or Accounts. Display Record ID,
> Name, Email, and one additional field.

`GET /api/v1/crm/:module?page=1&perPage=20`

## Tasks

- [x] Repository `findMany(apiName, { page, perPage, fields })` →
      `GET /{Module}?fields=..&page=..&per_page=..` (`fields` mandatory in v8)
      → `{ rows: data ?? [], hasMore: info.more_records ?? false }`.
- [x] DTO `toRecordResponse(moduleSlug, row)` → `{ id, name, email, <extra> }`
  - leads: `Full_Name`, `Email`, `company` ← `Company`
  - contacts: `Full_Name`, `Email`, `accountName` ← `Account_Name.name`
  - accounts: `Account_Name`, `email: null`, `phone` ← `Phone`
- [x] `toRecordResponseList(moduleSlug, rows)`.
- [x] Service `list(moduleSlug, { page, perPage })` →
      `{ data, pagination: { page, perPage, hasMore } }`.
- [x] Record `id` kept a string (19 digits).

## Acceptance (real Zoho, 2026-09-27)

- [x] `GET /api/v1/crm/leads` → 10 leads, e.g.
      `{ id: "7617346000000698112", name: "Christopher Maclead (Sample)", email: "christopher-maclead@noemail.invalid", company: "Rangoni Of Florence" }`
      — matches the Zoho Leads list.
- [x] `GET /api/v1/crm/contacts?perPage=3` → 3 contacts with `accountName`,
      `hasMore: true`.
- [x] `GET /api/v1/crm/accounts?perPage=2` → `email: null`, `phone` filled.
