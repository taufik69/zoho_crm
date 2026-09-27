/**
 * Joi schema for the OAuth callback query string. Shape only — whether the
 * `state` is one we issued is the service's question.
 *
 * `.unknown(true)` because Zoho appends parameters of its own on redirect
 * (`location`, `accounts-server` for multi-DC accounts); rejecting unknown
 * keys would fail a legitimate callback.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/auth.md
 */

import Joi from 'joi';

// `code` is absent when the user clicked Reject — Zoho sends `error` instead,
// and the service turns that into its own message.
const callbackQuerySchema = Joi.object({
  code: Joi.string().trim().when('error', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  state: Joi.string().trim().required(),
  error: Joi.string().trim(),
  location: Joi.string().trim(),
  'accounts-server': Joi.string().uri(),
}).unknown(true);

export { callbackQuerySchema };
