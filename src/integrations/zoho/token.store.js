/**
 * Holds the Zoho OAuth token set — the only state this app owns.
 *
 * There is no database, so the store is a small JSON file (`.tokens.json`,
 * gitignored, mode 0600) plus an in-memory copy. The file matters: the
 * refresh token is issued once, on consent, and without persisting it every
 * restart (nodemon restarts on every save) would force the user through the
 * consent screen again.
 *
 * Shape kept:
 *   { accessToken, refreshToken, expiresAt, apiDomain }
 *   - expiresAt  epoch millis, computed at issue time from `expires_in`
 *   - apiDomain  from the token response; every CRM call must use it,
 *                because it is data-centre specific
 *
 * Writes go to a temp file that is then renamed over the real one. rename is
 * atomic, so a crash mid-write never leaves a half-written file that would
 * read as "not connected" and lose the refresh token.
 *
 * A refresh response carries no refresh_token, so saveTokens merges instead
 * of replacing — overwriting would silently drop the refresh token and the
 * app would stop working an hour later.
 *
 * Callers depend only on getTokens / saveTokens / clearTokens, so moving to a
 * database or a secrets manager (one encrypted token row per tenant for
 * multi-client) later changes this file and nothing else.
 *
 * See .claude/skills/backend-scaffold/SKILL.md
 *      and docs/api/auth.md
 */

import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

import { createLogger } from '../../config/logger.js';

const log = createLogger('token-store');

const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');
const TEMP_FILE = `${TOKEN_FILE}.tmp`;
const OWNER_READ_WRITE = 0o600;

// undefined = file not read yet, null = no tokens (never connected).
let cache;

const readTokenFile = async () => {
  try {
    return JSON.parse(await readFile(TOKEN_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;

    // Corrupt file: treat as not connected. The contents are never logged —
    // they are the tokens.
    log.warn({ code: err.code ?? err.name }, 'Token file unreadable, treating as not connected');
    return null;
  }
};

/**
 * Returns the stored token set, or null when the app was never authorized.
 */
const getTokens = async () => {
  if (cache === undefined) cache = await readTokenFile();
  return cache;
};

/**
 * Persists a token set, merged over the current one. A missing refreshToken
 * in `next` keeps the stored one.
 */
const saveTokens = async (next) => {
  const current = (await getTokens()) ?? {};
  const merged = {
    ...current,
    ...next,
    refreshToken: next.refreshToken ?? current.refreshToken,
  };

  await writeFile(TEMP_FILE, JSON.stringify(merged, null, 2), { mode: OWNER_READ_WRITE });
  await rename(TEMP_FILE, TOKEN_FILE);

  cache = merged;
  return merged;
};

/**
 * Forgets the token set — used when Zoho reports the refresh token itself as
 * revoked, so a dead token never stays on disk looking "connected".
 */
const clearTokens = async () => {
  cache = null;
  await rm(TOKEN_FILE, { force: true });
};

export default { getTokens, saveTokens, clearTokens };
