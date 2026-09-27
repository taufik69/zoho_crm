# CRM sprint 5 — Point 3: create a Lead

Plan ref: crm-read-insert-plan.md §3
Depends on: sprints 2, 3
Files: `crm.validator.js`, `crm.dto.js`, `crm.repository.js`, `crm.service.js`

## Goal

> Create a new Lead from your application using fields such as First Name,
> Last Name, Company, Email, and Phone. The record must actually appear in
> Zoho CRM.

`POST /api/v1/crm/leads`

## Tasks

- [x] Validator `createLeadSchema`:
  - `firstName` optional, max 40
  - `lastName` **required**, max 80
  - `company` **required**, max 200
  - `email` optional, valid email, lowercased, max 100
  - `phone` optional, `^\+?[0-9 ()-]{6,30}$`
  - all trimmed; unknown keys rejected
- [x] DTO `toLeadPayload` → `First_Name`, `Last_Name`, `Company`, `Email`, `Phone`.
- [x] Repository `createLead(payload)` → `POST /Leads` with `{ data: [payload] }`
      → `data[0].details`.
- [x] Service `createLead(body)` → `{ id }`.
- [x] Controller / route unchanged (`apiLimiter`, 201).

## Acceptance

- [x] POST without `lastName` / `company` → 400 naming both fields.
- [x] POST with `email: "bad"` → 400 `email`.
- [x] Real Zoho: POST John Smith / ABC Ltd / john@example.com /
      +8801700000000 → `201 { id: "7617346000000702001" }`.
- [x] Lead count via API 10 → 11.
- [ ] Zoho UI → Leads → refresh → "John Smith" visible, Total Records 11.
      *Needs a human look at the CRM page.*
