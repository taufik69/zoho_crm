/**
 * Joi schema-validation middleware. Formats Joi's error details into
 * { field, message } pairs and forwards an AppError, so the centralized
 * error middleware sends the response — this file never calls ApiResponse.
 *
 * `target` selects the part of the request to validate — 'body' by default,
 * or 'query' / 'params', e.g. `validate(listQuerySchema, 'query')`.
 *
 * The write-back uses Object.defineProperty, not `req[target] = value`: in
 * Express 5 `req.query` is a getter-only property, so plain assignment
 * throws in strict-mode ESM and turns every validated query into a 500.
 *
 * See .claude/skills/module-consistency/SKILL.md
 */

import AppError from '../utils/AppError.js';
import httpStatus from '../constants/httpStatus.js';

const validate =
  (schema, target = 'body') =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[target], { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return next(new AppError(httpStatus.BAD_REQUEST, 'Validation failed', errors));
    }

    // Write the validated (Joi-coerced and defaulted) value back so
    // downstream layers receive normalized data — string "20" becomes 20.
    Object.defineProperty(req, target, { value, writable: true, enumerable: true, configurable: true });

    next();
  };

export { validate };
export default validate;
