/**
 * The one HTTP client for the Zoho CRM REST API. Repositories call this;
 * nothing else builds a CRM URL or sets an Authorization header.
 *
 * For every request:
 *   1. load the stored tokens — none means the app was never connected (401)
 *   2. refresh first if the access token expires within a minute, so a
 *      request does not leave with a token that dies in flight
 *   3. call `${apiDomain}/crm/${CRM_API_VERSION}${path}` with
 *      `Authorization: Zoho-oauthtoken <token>` (NOT "Bearer")
 *   4. 401 INVALID_TOKEN (token revoked or corrupt before its expiry):
 *      refresh once and retry once — never loop
 *   5. 204 → null (Zoho's answer for "no records"); any other non-2xx goes
 *      to zoho.errors.js, which turns it into an AppError
 *
 * If Zoho rejects the refresh token itself, the stored tokens are cleared:
 * a dead refresh token left on disk would keep /auth/status saying
 * "connected" while every call fails.
 *
 * `apiDomain` comes from the token response, never from config: it is
 * data-centre specific.
 *
 * A request timeout is required: without one a hung Zoho call holds the
 * client's request open indefinitely.
 *
 * See .claude/skills/backend-scaffold/SKILL.md
 *      and docs/api/crm.md
 */

import tokenStore from './token.store.js';
import zohoOauth from './zoho.oauth.js';
import toAppError from './zoho.errors.js';
import { createLogger } from '../../config/logger.js';
import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { CRM_API_VERSION } from '../../shared/constants/zoho.js';

const log = createLogger('zoho-client');

const REQUEST_TIMEOUT_MS = 10_000;
const REFRESH_SKEW_MS = 60_000;

const refreshTokens = async (refreshToken) => {
  try {
    return await tokenStore.saveTokens(await zohoOauth.refreshAccessToken(refreshToken));
  } catch (err) {
    if (err instanceof AppError && err.statusCode === httpStatus.UNAUTHORIZED) {
      await tokenStore.clearTokens();
      log.warn('Zoho refresh token rejected, stored tokens cleared');
    }
    throw err;
  }
};

const getValidTokens = async () => {
  const tokens = await tokenStore.getTokens();

  if (!tokens) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Zoho is not connected, visit /api/v1/auth/connect');
  }

  if (tokens.expiresAt - Date.now() > REFRESH_SKEW_MS) return tokens;

  log.info('Access token expired or expiring, refreshing');
  return refreshTokens(tokens.refreshToken);
};

const buildUrl = (apiDomain, path, query) => {
  const url = new URL(`/crm/${CRM_API_VERSION}${path}`, apiDomain);
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
};

const send = async (url, method, accessToken, body) => {
  try {
    return await fetch(url, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new AppError(httpStatus.GATEWAY_TIMEOUT, 'Zoho CRM timed out');
    }

    log.error({ err }, 'Could not reach Zoho CRM');
    throw new AppError(httpStatus.BAD_GATEWAY, 'Could not reach Zoho CRM');
  }
};

const call = async ({ accessToken, apiDomain }, method, path, query, body) => {
  const res = await send(buildUrl(apiDomain, path, query), method, accessToken, body);

  if (res.status === httpStatus.NO_CONTENT) return { status: res.status, ok: true, json: null };

  return { status: res.status, ok: res.ok, json: await res.json().catch(() => ({})) };
};

/**
 * @param {string} method  GET | POST
 * @param {string} path    e.g. `/Leads` or `/Leads/7617346000000512001`
 * @param {{ query?: object, body?: object }} [options]
 * @returns {Promise<object|null>} parsed JSON body, null for 204 No Content
 */
const request = async (method, path, { query, body } = {}) => {
  const tokens = await getValidTokens();
  let result = await call(tokens, method, path, query, body);

  if (result.status === httpStatus.UNAUTHORIZED && result.json.code === 'INVALID_TOKEN') {
    log.info('Zoho rejected the access token, refreshing and retrying once');
    result = await call(await refreshTokens(tokens.refreshToken), method, path, query, body);
  }

  if (!result.ok) throw toAppError(result.status, result.json);

  return result.json;
};

export default { request };
