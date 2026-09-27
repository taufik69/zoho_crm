/**
 * Global error handler — the ONLY place in the app that turns an error into
 * an HTTP response. Controllers and services never catch in order to
 * respond; they throw AppError and it lands here.
 *
 * MOUNTED LAST in app.js, after every route and the 404 catch-all. Express
 * identifies an error handler by its FOUR-argument signature, so the unused
 * `next` parameter is load-bearing — remove it and this silently becomes
 * ordinary middleware that never runs.
 *
 * Known vs unknown is the whole job:
 *   - instanceof AppError  → operational. Send err.statusCode and
 *                            err.message as-is; we chose both.
 *   - anything else        → a bug or an outage. Log the real error
 *                            server-side, respond with a generic 500.
 *
 * There is no Prisma-code mapping here (the stock scaffold has one): this app
 * has no database. The equivalent translation for Zoho — INVALID_TOKEN,
 * MANDATORY_NOT_FOUND, INVALID_MODULE, DUPLICATE_DATA → AppError — happens
 * in src/integrations/zoho/zoho.errors.js, before an error ever reaches this
 * file, so a raw Zoho payload (which can echo field API names and request
 * ids) never leaks through the 500 path.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and .claude/rules/error-handling.md
 */

import config from '../../config/env.js';
import { createLogger } from '../../config/logger.js';
import AppError from '../utils/AppError.js';
import ApiResponse from '../utils/apiResponse.js';
import httpStatus from '../constants/httpStatus.js';

const log = createLogger('error');

const isDevelopment = config.nodeEnv === 'development';

/**
 * 404 catch-all. Mounted after all routes but before errorHandler, so an
 * unmatched path produces the standard envelope rather than Express's
 * default HTML page.
 */
const notFound = (req, res, next) => {
  next(new AppError(httpStatus.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // --- KNOWN: operational, raised deliberately by our own code ---
  if (err instanceof AppError) {
    const data = err.details ?? null;

    if (isDevelopment) {
      return ApiResponse.error(res, err.statusCode, err.message, { details: data, stack: err.stack });
    }

    return ApiResponse.error(res, err.statusCode, err.message, data);
  }

  // --- UNKNOWN: a bug or an outage. Log everything, reveal nothing. ---
  // `req.log` carries the request id that ties this trace to its request
  // line; the module logger is the fallback for errors raised before the
  // pino-http middleware ran (e.g. a malformed JSON body).
  (req.log ?? log).error({ err }, 'Unhandled error');

  if (isDevelopment) {
    return ApiResponse.error(res, httpStatus.INTERNAL_SERVER_ERROR, 'Internal server error', {
      stack: err.stack,
    });
  }

  return ApiResponse.error(res, httpStatus.INTERNAL_SERVER_ERROR, 'Internal server error');
};

export { notFound, errorHandler };
export default errorHandler;
