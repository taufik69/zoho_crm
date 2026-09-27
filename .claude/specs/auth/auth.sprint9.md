# Auth sprint 9 — API contract doc + end-to-end verification

Plan ref: oauth-plan.md §4.7, §6
Depends on: sprints 1–8
File: `docs/api/auth.md` (new)

## Goal

Document the auth module (repo rule: a module without its contract doc is
not finished — `api-contract-doc` skill) and run the whole test list once.

## Tasks — doc

- [x] Follow `.claude/skills/api-contract-doc/SKILL.md` format.
- [x] Four endpoints: `connect`, `callback`, `status`, `refresh` — method,
      path, rate limiter, query/body, success example, every error case.
- [x] Reasoning for: `state` (CSRF), `access_type=offline` + `prompt=consent`,
      `accounts-server` compare-only, `.tokens.json` 0600, tokens never
      returned.
- [x] Setup section: API console app, redirect URI, `.env` vars.
- [x] Example responses with tokens and personal data masked.
- [x] File headers of sprint 1–8 files point at `docs/api/auth.md`.

## Tasks — end-to-end run

Happy path:

- [x] 1. `npm run dev`
- [x] 2. `GET /api/v1/auth/status` → `connected: false`
- [x] 3. Browser `/api/v1/auth/connect` → Accept → "Zoho CRM connected successfully"
- [x] 4. `ls -l .tokens.json` → `-rw-------`
- [x] 5. `/status` → `connected: true`
- [x] 6. Restart server, `/status` → still `connected: true`
- [x] 7. `POST /api/v1/auth/refresh` → `expiresAt` moved forward

Error cases:

- [x] 8. `/callback?code=x&state=fake` → 400 invalid state
- [x] 9. Same callback URL twice → 400 invalid state
      *(same `state` sent twice: 1st → 400 invalid code, 2nd → 400 invalid state)*
- [x] 10. Reject on consent → 400 authorization denied
      *(verified with the `error=access_denied` query Zoho sends on Reject)*
- [x] 11. Garbage refreshToken → `/refresh` → 401, file deleted
- [x] 12. `grep` server log for the access token → no match
      *Found and fixed: the request log wrote the callback `code`/`state` in the
      URL. `logger.middleware.js` now masks them (`code=[redacted]`).*

## Done

All boxes ticked → mark every sprint `done` in [README.md](./README.md), then
move to the CRM module (features 2–4).
