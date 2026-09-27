# Auth sprint 1 — Token store

Plan ref: oauth-plan.md §4.1, §5.2
Depends on: nothing
File: `src/integrations/zoho/token.store.js`

## Goal

Keep the Zoho token set in memory and in `.tokens.json`, so a server restart
(nodemon restarts on every save) does not send the user back through consent.

Stored shape:

```js
{ accessToken, refreshToken, expiresAt /* epoch ms */, apiDomain }
```

## Tasks

- [x] File path = project root `.tokens.json` (resolve from `process.cwd()`).
- [x] Module-level `cache`: `undefined` = not loaded, `null` = no tokens.
- [x] `getTokens()`
  - return `cache` if already loaded
  - read + `JSON.parse` the file
  - `ENOENT` → `null`
  - invalid JSON → log `warn` (no file contents in the log) → `null`
- [x] `saveTokens(next)`
  - merge with current set: `{ ...current, ...next }`
  - if `next.refreshToken` is `undefined`, keep `current.refreshToken`
    (a refresh response has no refresh token)
  - write `.tokens.json.tmp` with mode `0o600`, then `rename` to
    `.tokens.json` (atomic — a crash never leaves half a file)
  - update `cache`, return merged set
- [x] `clearTokens()` — `cache = null`, delete file, ignore `ENOENT`.
- [x] Remove the `notImplemented` stub and unused imports.
- [x] Update the file header (keep the "why a file" reasoning).

## Acceptance

- [x] `getTokens()` with no file → `null`.
- [x] `saveTokens({ accessToken: 'a', refreshToken: 'r', ... })` → file exists,
      `ls -l` shows `-rw-------`.
- [x] `saveTokens({ accessToken: 'b' })` afterwards → `refreshToken` still `'r'`.
- [x] Restart node, `getTokens()` returns the saved set.
- [x] `clearTokens()` → file gone, `getTokens()` → `null`.

## Quick check

```bash
node -e "
import('./src/integrations/zoho/token.store.js').then(async ({ default: s }) => {
  console.log(await s.getTokens());
  await s.saveTokens({ accessToken: 'a', refreshToken: 'r', expiresAt: 1, apiDomain: 'x' });
  await s.saveTokens({ accessToken: 'b' });
  console.log(await s.getTokens());
  await s.clearTokens();
  console.log(await s.getTokens());
})"
```

## Out of scope

Encryption at rest, multi-tenant storage (assessment Q8 talking point only).
