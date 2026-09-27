# Auth sprint 5 — Callback validator

Plan ref: oauth-plan.md §4.3
Depends on: nothing
File: `src/modules/auth/auth.validator.js`

## Goal

Reject malformed callback query strings before the service runs.

## Tasks

- [x] `state`: string, trimmed, **required**.
- [x] `error`: optional string.
- [x] `code`: required **unless** `error` is present
      (`Joi.string().trim().when('error', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() })`).
- [x] `location`, `accounts-server` (`uri`): optional.
- [x] Keep `.unknown(true)` — Zoho may add params; failing on an unknown key
      would break a legitimate callback.
- [x] Update the header / remove the TODO.

## Acceptance

| Query | Result |
|---|---|
| `?code=x&state=y` | passes validation |
| `?state=y` | 400 `Validation failed`, field `code` |
| `?code=x` | 400, field `state` |
| `?error=access_denied&state=y` | passes (service handles it in sprint 6) |
| `?code=x&state=y&foo=1` | passes |
