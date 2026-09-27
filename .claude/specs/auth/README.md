# Auth (Zoho OAuth) — sprint specs

Source plan: [../../plan/oauth-plan.md](../../plan/oauth-plan.md).
Each sprint is small enough to build, test and review on its own. Do them in
order; a sprint starts only after the previous one is reviewed.

| Sprint | Scope | Files | Status |
|---|---|---|---|
| [1](./auth.sprint1.md) | Token store (memory + `.tokens.json`) | `token.store.js` | done |
| [2](./auth.sprint2.md) | Authorize URL | `zoho.oauth.js` | done |
| [3](./auth.sprint3.md) | Token endpoint + Zoho error mapping | `zoho.oauth.js` | done |
| [4](./auth.sprint4.md) | `/connect` + `state` generation | `auth.service.js` | done |
| [5](./auth.sprint5.md) | Callback validator | `auth.validator.js` | done |
| [6](./auth.sprint6.md) | `/callback`: verify state, exchange, save | `auth.service.js` | done |
| [7](./auth.sprint7.md) | `/status` + DTO | `auth.service.js`, `auth.dto.js` | done |
| [8](./auth.sprint8.md) | `/refresh` + revoked refresh token | `auth.service.js` | done |
| [9](./auth.sprint9.md) | API contract doc + end-to-end verification | `docs/api/auth.md` | done |

## Rules every sprint follows

- `.claude/rules/error-handling.md`: services throw `AppError`, no
  `try/catch` in controllers, status codes from `httpStatus.js`.
- `.claude/rules/code-comments.md`: multi-line header on every file touched,
  pointing at the owning skill and `docs/api/auth.md`.
- No access token, refresh token or client secret in any response body or
  log line.
- Unchanged: `auth.controller.js`, `auth.routes.js`, `auth.repository.js`.

## Definition of done (whole feature)

- Browser `GET /api/v1/auth/connect` → Zoho consent → callback answers
  `"Zoho CRM connected successfully"`.
- `.tokens.json` exists, mode `0600`, gitignored.
- `/status` shows `connected: true` and survives a restart.
- `/refresh` moves `expiresAt` forward.
- Every error case in sprint 9 returns the expected status.
