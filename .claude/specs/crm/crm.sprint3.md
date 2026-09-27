# CRM sprint 3 — Zoho error mapping

Plan ref: crm-read-insert-plan.md §5
Depends on: nothing
File: `src/integrations/zoho/zoho.errors.js`

## Goal

Turn any Zoho CRM failure into an `AppError` with the right status, without
forwarding Zoho's raw body.

## Tasks

- [x] Read the error from `body.data[0]` (per-record) or `body` (top level).
- [x] Mapping:

| Zoho | Status | Client message |
|---|---|---|
| HTTP 401 | 401 | Zoho authorization expired, reconnect at /api/v1/auth/connect |
| `OAUTH_SCOPE_MISMATCH` | 403 | Zoho token lacks the scope for this module, reconnect |
| `DUPLICATE_DATA` | 409 | A record with this value already exists in Zoho CRM (+ `field`) |
| `MANDATORY_NOT_FOUND`, `INVALID_DATA`, `REQUIRED_PARAM_MISSING` | 400 | Zoho CRM rejected the request (+ `code`, `field`) |
| HTTP 429 | 429 | Zoho API rate limit reached, try again later |
| anything else | 502 | Zoho CRM returned an error *(code logged)* |

- [x] Only `details.api_name` (as `field`) is forwarded; Zoho's message is not.

## Acceptance

- [x] Module loads, used by `zoho.client.js`.
- [x] 404 path does not depend on this file (Zoho sends 204 → service 404).

> The 400/403/409 branches are covered by code review, not a live Zoho
> trigger — validation stops bad input before Zoho sees it.
