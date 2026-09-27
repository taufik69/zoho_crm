/**
 * OAuth flow rules: issue and verify `state`, exchange the code, store the
 * token set, report connection status, force a refresh.
 *
 * Never touches req/res; throws AppError. Tokens never leave this layer —
 * every return value goes through auth.dto.js, which exposes connection
 * facts (connected, expiresAt, scopes) and never a token.
 *
 * `state` is the CSRF protection for the callback: without it, anyone could
 * send a victim to our callback with THEIR code and connect the app to the
 * attacker's CRM. It is kept in memory, single use, 10 minutes. Acceptable
 * for a single-user, single-process app — a restart between connect and
 * callback just means clicking connect again. A multi-instance deployment
 * would need Redis or a signed cookie instead.
 *
 * The `accounts-server` callback parameter is only compared with
 * ZOHO_ACCOUNTS_URL, never called: the token request carries our client
 * secret, and following a URL from a query string would send it wherever an
 * attacker pointed it.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/auth.md
 */

import crypto from 'node:crypto';

import authRepository from './auth.repository.js';
import { toConnectionResponse } from './auth.dto.js';
import config from '../../config/env.js';
import { createLogger } from '../../config/logger.js';
import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';

const log = createLogger('auth');

const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_BYTES = 32;

// state → expiresAt (epoch ms)
const pendingStates = new Map();

const pruneExpiredStates = () => {
  const now = Date.now();
  for (const [state, expiresAt] of pendingStates) {
    if (expiresAt <= now) pendingStates.delete(state);
  }
};

// Single use: deleted on lookup whether or not it is still valid, so a
// replayed callback URL fails even inside the TTL.
const consumeState = (state) => {
  const expiresAt = pendingStates.get(state);
  pendingStates.delete(state);
  return expiresAt !== undefined && expiresAt > Date.now();
};

const isSameOrigin = (a, b) => new URL(a).origin === new URL(b).origin;

const getAuthorizeUrl = async () => {
  pruneExpiredStates();

  const state = crypto.randomBytes(STATE_BYTES).toString('hex');
  pendingStates.set(state, Date.now() + STATE_TTL_MS);

  return authRepository.buildAuthorizeUrl(state);
};

const handleCallback = async ({ code, state, error, 'accounts-server': accountsServer }) => {
  if (error) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Zoho authorization was denied');
  }

  if (!consumeState(state)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid or expired OAuth state, start again at /api/v1/auth/connect'
    );
  }

  if (accountsServer && !isSameOrigin(accountsServer, config.zoho.accountsUrl)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `This Zoho account is in a different data centre; set ZOHO_ACCOUNTS_URL to ${accountsServer}`
    );
  }

  const tokens = await authRepository.exchangeCode(code);
  const saved = await authRepository.saveTokens(tokens);

  log.info({ apiDomain: saved.apiDomain, expiresAt: new Date(saved.expiresAt).toISOString() }, 'Zoho connected');

  return toConnectionResponse(saved);
};

// Not connected is a normal answer, not an error.
const getStatus = async () => toConnectionResponse(await authRepository.getTokens());

const refresh = async () => {
  const current = await authRepository.getTokens();

  if (!current?.refreshToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Zoho is not connected, visit /api/v1/auth/connect');
  }

  let tokens;
  try {
    tokens = await authRepository.refreshAccessToken(current.refreshToken);
  } catch (err) {
    // A revoked refresh token must not stay on disk looking "connected".
    if (err instanceof AppError && err.statusCode === httpStatus.UNAUTHORIZED) {
      await authRepository.clearTokens();
      log.warn('Zoho refresh token rejected, stored tokens cleared');
    }
    throw err;
  }

  return toConnectionResponse(await authRepository.saveTokens(tokens));
};

export default { getAuthorizeUrl, handleCallback, getStatus, refresh };
