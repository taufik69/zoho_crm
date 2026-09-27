# CRM sprint 6 — Point 4: get record by id

Plan ref: crm-read-insert-plan.md §4
Depends on: sprints 4, 5
Files: `crm.repository.js`, `crm.service.js`

## Goal

> Retrieve the inserted record using its returned Record ID.

`GET /api/v1/crm/:module/:id`

## Tasks

- [x] Repository `findById(apiName, id)` → `GET /{Module}/{id}` →
      `data[0]` or `null` (Zoho answers 204 for an unknown id).
- [x] Service `getById(moduleSlug, id)` → `AppError(NOT_FOUND, 'Record not found')`
      on `null`, else the same DTO as the list.
- [x] Validator: `id` digits only (already present).

## Acceptance (real Zoho, 2026-09-27)

- [x] `GET /api/v1/crm/leads/7617346000000702001` →
      `{ id, name: "John Smith", email: "john@example.com", company: "ABC Ltd" }`.
- [x] `GET /api/v1/crm/leads/7617346000000000001` → 404 "Record not found".
- [x] `GET /api/v1/crm/leads/abc` → 400 `id`.
