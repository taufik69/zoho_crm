# CRM (Part 1, points 2–4) — sprint specs

Source plan: [../../plan/crm-read-insert-plan.md](../../plan/crm-read-insert-plan.md).
Depends on: auth sprints 1–9 ([../auth/README.md](../auth/README.md)) — a real
Zoho connection must exist.

Scope is exactly the assessment's points 2, 3 and 4 — nothing extra.

| Sprint | Scope | Files | Status |
|---|---|---|---|
| [1](./crm.sprint1.md) | Module config (slug → Zoho name + fields) | `constants/zoho.js` | done |
| [2](./crm.sprint2.md) | Zoho CRM HTTP client | `zoho.client.js` | done |
| [3](./crm.sprint3.md) | Zoho error → `AppError` mapping | `zoho.errors.js` | done |
| [4](./crm.sprint4.md) | Point 2 — list records | `crm.repository.js`, `crm.dto.js`, `crm.service.js` | done |
| [5](./crm.sprint5.md) | Point 3 — create a Lead | `crm.validator.js`, `crm.dto.js`, `crm.repository.js`, `crm.service.js` | done |
| [6](./crm.sprint6.md) | Point 4 — get record by id | `crm.repository.js`, `crm.service.js` | done |
| [7](./crm.sprint7.md) | Contract doc + end-to-end verification | `docs/api/crm.md` | done |

## Rules every sprint follows

- `.claude/rules/error-handling.md`: services throw `AppError`, no
  `try/catch` in controllers, status codes from `httpStatus.js`.
- `.claude/rules/code-comments.md`: multi-line header on every file touched,
  pointing at the owning skill and `docs/api/crm.md`.
- Zoho is reached only through `zoho.client.js`; the token never leaves the
  server; Zoho's raw error body is never forwarded.
- Unchanged: `crm.controller.js`, `crm.routes.js`.

## Definition of done (whole feature) — verified 2026-09-27

- `GET /api/v1/crm/leads` returns the Zoho leads with Record ID, Name, Email
  and one extra field.
- `POST /api/v1/crm/leads` creates a lead that appears in Zoho CRM.
- `GET /api/v1/crm/leads/:id` returns that lead by its returned id.

## Post-review fixes (2026-09-27)

Found in the full code review and live test run, fixed and re-verified:

- [x] Malformed JSON body → `400 Malformed JSON body` (was 500) — `error.middleware.js`.
- [x] `OAUTH_SCOPE_MISMATCH` arrives with HTTP 401 → now `403` (code checked
      before status) — `zoho.errors.js`.
- [x] Zoho `401 INVALID_TOKEN` → refresh once, retry once → `200` (was 401
      "reconnect") — `zoho.client.js`.
- [x] Refresh token rejected inside the client → stored tokens cleared,
      `/auth/status` shows `connected: false` — `zoho.client.js`.
- [x] `README.md` written.
