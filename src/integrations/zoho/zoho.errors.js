/**
 * Translates Zoho failures into AppErrors — the Zoho equivalent of the
 * stock scaffold's Prisma-code mapping.
 *
 * Why it exists: Zoho reports errors as `{ code, message, details, status }`,
 * sometimes at the top level, sometimes per record inside `data[]` with an
 * HTTP 201/202. Without one translation point each repository would invent
 * its own mapping, and an unmapped Zoho error would surface as a generic 500
 * — the wrong status, and a lost clue for the caller.
 *
 * Status choice matters:
 *   - 401 from Zoho is OUR credential problem, not the caller's. The caller
 *     never sent a Zoho token. Map it to 401 only when the app needs
 *     (re)authorization, with a message saying so.
 *   - 5xx / network / timeout from Zoho → 502 / 504, never 500 — our code
 *     did not fail, the dependency did.
 *   - Never pass Zoho's raw message through blindly; pick the fields
 *     (e.g. `details.api_name` for a missing field) that help the caller.
 *
 * See .claude/rules/error-handling.md
 *      and docs/api/crm.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';

/**
 * TODO: map at least
 *   INVALID_TOKEN / AUTHENTICATION_FAILURE → 401 (re-authorize)
 *   OAUTH_SCOPE_MISMATCH                   → 403
 *   MANDATORY_NOT_FOUND / INVALID_DATA     → 400 (+ offending api_name)
 *   INVALID_MODULE                         → 400
 *   DUPLICATE_DATA                         → 409
 *   INVALID_URL_PATTERN / record not found → 404
 *   429 / LIMIT_EXCEEDED                   → 429
 *   5xx, network, timeout                  → 502 / 504
 *
 * @param {number} status  HTTP status Zoho answered with (0 for network error)
 * @param {object} body    parsed Zoho error body, if any
 * @returns {AppError}
 */
// eslint-disable-next-line no-unused-vars
const toAppError = (status, body) =>
  new AppError(httpStatus.NOT_IMPLEMENTED, 'Zoho error mapping is not implemented yet');

export { toAppError };
export default toAppError;
