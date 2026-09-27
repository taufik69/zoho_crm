/**
 * Zoho OAuth 2.0 (authorization-code grant) against the accounts server.
 *
 * Three calls, and nothing else in the app talks to accounts.zoho.*:
 *   1. buildAuthorizeUrl  → where /auth/connect redirects the browser
 *   2. exchangeCode       → code from /auth/callback → access + refresh token
 *   3. refreshAccessToken → new access token from the stored refresh token
 *
 * Easy to get wrong:
 *   - `access_type=offline` is what makes Zoho issue a refresh token at all,
 *     and `prompt=consent` makes it issue one again on re-authorization.
 *     Drop either and the app works for one hour, then needs a human.
 *   - The token endpoint takes form-encoded params, not JSON.
 *   - Zoho answers a bad code / bad secret with HTTP 200 and `{ error }` in
 *     the body — check the body, not only the status.
 *   - The same Zoho code means different things per grant: `invalid_code` on
 *     a code exchange is the caller's stale code (400), on a refresh it is our
 *     revoked refresh token (401, reconnect). So errors map per grant.
 *   - Client misconfiguration (bad id/secret/redirect URI) is our fault, not
 *     the caller's: they get a generic 500 and the real Zoho code goes to the
 *     log. The request body is never logged — it carries the client secret
 *     and the code or refresh token.
 *
 * See .claude/skills/backend-scaffold/SKILL.md, .claude/rules/error-handling.md
 *      and docs/api/auth.md
 */

import config from '../../config/env.js';
import { createLogger } from '../../config/logger.js';
import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';

const log = createLogger('zoho-oauth');

const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

const GRANT = Object.freeze({
  AUTHORIZATION_CODE: 'authorization_code',
  REFRESH_TOKEN: 'refresh_token',
});

const RECONNECT_MESSAGE = 'Zoho authorization expired, reconnect at /api/v1/auth/connect';

const MISCONFIGURED_CODES = new Set(['invalid_client', 'invalid_client_secret', 'invalid_redirect_uri']);

const { clientId, clientSecret, redirectUri, accountsUrl, scopes } = config.zoho;

/**
 * Consent URL for the browser redirect. The client secret is never part of
 * it — this URL is visible to the user and their browser history.
 */
const buildAuthorizeUrl = (state) => {
  const url = new URL('/oauth/v2/auth', accountsUrl);

  url.searchParams.set('scope', scopes);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  return url.toString();
};

const toTokenError = (grantType, zohoError) => {
  if (MISCONFIGURED_CODES.has(zohoError)) {
    log.error({ zohoError }, 'Zoho rejected the OAuth client configuration');
    return new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Zoho client is misconfigured');
  }

  if (zohoError === 'invalid_code' || zohoError === 'invalid_token') {
    return grantType === GRANT.REFRESH_TOKEN
      ? new AppError(httpStatus.UNAUTHORIZED, RECONNECT_MESSAGE)
      : new AppError(httpStatus.BAD_REQUEST, 'Authorization code is invalid or expired, reconnect');
  }

  // Zoho's throttle on the token endpoint answers "Access Denied".
  if (zohoError?.toLowerCase().replace(/\s+/g, '_') === 'access_denied') {
    return new AppError(httpStatus.TOO_MANY_REQUESTS, 'Too many token requests, try again later');
  }

  log.error({ zohoError }, 'Unexpected Zoho token endpoint error');
  return new AppError(httpStatus.BAD_GATEWAY, 'Zoho accounts server returned an error');
};

const sendTokenRequest = async (params) => {
  try {
    return await fetch(new URL('/oauth/v2/token', accountsUrl), {
      method: 'POST',
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new AppError(httpStatus.GATEWAY_TIMEOUT, 'Zoho accounts server timed out');
    }

    log.error({ err }, 'Could not reach Zoho accounts server');
    throw new AppError(httpStatus.BAD_GATEWAY, 'Could not reach Zoho accounts server');
  }
};

const postToken = async (params) => {
  const res = await sendTokenRequest(params);
  const body = await res.json().catch(() => ({}));

  if (!res.ok || body.error || !body.access_token) {
    throw toTokenError(params.grant_type, body.error ?? `http_${res.status}`);
  }

  return body;
};

// refreshToken is undefined on a refresh response; token.store keeps the old one.
const normalize = (body) => ({
  accessToken: body.access_token,
  refreshToken: body.refresh_token,
  apiDomain: body.api_domain,
  expiresAt: Date.now() + body.expires_in * 1000,
});

const exchangeCode = async (code) =>
  normalize(
    await postToken({
      grant_type: GRANT.AUTHORIZATION_CODE,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    })
  );

const refreshAccessToken = async (refreshToken) =>
  normalize(
    await postToken({
      grant_type: GRANT.REFRESH_TOKEN,
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    })
  );

export default { buildAuthorizeUrl, exchangeCode, refreshAccessToken };
