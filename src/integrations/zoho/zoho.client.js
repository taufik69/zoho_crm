/**
 * The one HTTP client for the Zoho CRM REST API. Repositories call this;
 * nothing else builds a CRM URL or sets an Authorization header.
 *
 * Its job, in order, for every request:
 *   1. get a valid access token — refresh first if it expires within a
 *      small skew window, so a request does not leave with a token that
 *      dies in flight
 *   2. call `${apiDomain}/crm/${CRM_API_VERSION}${path}` with
 *      `Authorization: Zoho-oauthtoken <token>` (NOT "Bearer")
 *   3. on 401 INVALID_TOKEN: refresh once and retry once — never loop
 *   4. hand any non-2xx (or a 2xx whose per-record status is "error") to
 *      zoho.errors.js, which turns it into an AppError
 *
 * Uses Node 22's built-in fetch — no axios dependency. A request timeout
 * (AbortSignal.timeout) is required: without one a hung Zoho call holds the
 * client's request open indefinitely.
 *
 * See .claude/skills/backend-scaffold/SKILL.md
 *      and docs/api/crm.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';

/**
 * TODO: implement steps 1–4 above.
 *
 * @param {string} method  GET | POST | PUT | DELETE
 * @param {string} path    e.g. `/Leads` or `/Leads/5725767000000512001`
 * @param {{ query?: object, body?: object }} [options]
 * @returns {Promise<object>} parsed JSON body (null for 204 No Content)
 */
// eslint-disable-next-line no-unused-vars
const request = async (method, path, options = {}) => {
  throw new AppError(httpStatus.NOT_IMPLEMENTED, 'Zoho client is not implemented yet');
};

export default { request };
