/**
 * Translates Zoho CRM failures into AppErrors.
 *
 * Zoho reports errors as `{ code, message, details, status: "error" }`,
 * either at the top level or per record inside `data[]`. Without one
 * translation point each repository would invent its own mapping, and an
 * unmapped Zoho error would surface as a generic 500.
 *
 * Status choice:
 *   - 401 from Zoho is OUR credential problem — the caller never sent a Zoho
 *     token. The message tells them to reconnect the app.
 *   - Zoho 5xx / unknown → 502, never 500: our code did not fail, the
 *     dependency did.
 *   - Zoho's raw body is never passed through. Only the field API name
 *     (`details.api_name`) is forwarded, because it tells the caller which
 *     field to fix; the Zoho code goes to the log.
 *
 * See .claude/rules/error-handling.md
 *      and docs/api/crm.md
 */

import { createLogger } from '../../config/logger.js';
import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';

const log = createLogger('zoho-errors');

const RECORD_ERROR_CODES = new Set(['MANDATORY_NOT_FOUND', 'INVALID_DATA', 'REQUIRED_PARAM_MISSING']);

/**
 * @param {number} status  HTTP status Zoho answered with
 * @param {object} body    parsed Zoho error body, if any
 * @returns {AppError}
 */
const toAppError = (status, body) => {
  const error = body?.data?.[0] ?? body ?? {};
  const { code } = error;
  const field = error.details?.api_name;

  // Zoho sends OAUTH_SCOPE_MISMATCH with HTTP 401, so the code is checked
  // before the status — otherwise a scope problem reads as "reconnect".
  if (code === 'OAUTH_SCOPE_MISMATCH') {
    return new AppError(httpStatus.FORBIDDEN, 'Zoho token lacks the scope for this module, reconnect');
  }

  if (status === httpStatus.UNAUTHORIZED) {
    return new AppError(httpStatus.UNAUTHORIZED, 'Zoho authorization expired, reconnect at /api/v1/auth/connect');
  }

  if (code === 'DUPLICATE_DATA') {
    return new AppError(httpStatus.CONFLICT, 'A record with this value already exists in Zoho CRM', { field });
  }

  if (RECORD_ERROR_CODES.has(code)) {
    return new AppError(httpStatus.BAD_REQUEST, 'Zoho CRM rejected the request', { code, field });
  }

  if (status === httpStatus.TOO_MANY_REQUESTS) {
    return new AppError(httpStatus.TOO_MANY_REQUESTS, 'Zoho API rate limit reached, try again later');
  }

  log.error({ status, code }, 'Unmapped Zoho CRM error');
  return new AppError(httpStatus.BAD_GATEWAY, 'Zoho CRM returned an error');
};

export { toAppError };
export default toAppError;
