# CRM sprint 1 — Module config

Plan ref: crm-read-insert-plan.md §2
Depends on: nothing
File: `src/shared/constants/zoho.js`

## Goal

One place that says which modules are allowed, their Zoho API name, and
which fields we read from each.

## Tasks

- [x] `CRM_MODULES`: slug → `{ apiName, fields }`
  - `leads` → `Leads`, `['Full_Name', 'Email', 'Company']`
  - `contacts` → `Contacts`, `['Full_Name', 'Email', 'Account_Name']`
  - `accounts` → `Accounts`, `['Account_Name', 'Phone']` (no Email field in Zoho)
- [x] Keep `CRM_API_VERSION = 'v8'`, `MAX_PAGE_SIZE = 200`.
- [x] Validator still uses `Object.keys(CRM_MODULES)` — unchanged.

## Acceptance

- [x] `GET /api/v1/crm/foo` → 400 `Validation failed`, field `module`.
- [x] App loads (`import('./src/app.js')`).
