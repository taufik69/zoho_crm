/**
 * Joi schemas for CRM routes — request shape and normalization only.
 * Whether a lead is a duplicate is the service's question, not this file's.
 *
 * The module param is lowercased and checked against the allow-list, so
 * `/crm/LEADS` and `/crm/leads` are one route and `/crm/deals` is a 400 here.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/crm.md
 */

import Joi from 'joi';

import { CRM_MODULES, MAX_PAGE_SIZE } from '../../shared/constants/zoho.js';

const moduleSlug = Joi.string()
  .trim()
  .lowercase()
  .valid(...Object.keys(CRM_MODULES))
  .required();

const moduleParamsSchema = Joi.object({ module: moduleSlug });

// Zoho record ids are long numeric strings — keep them strings, a JS number
// loses precision past 2^53.
const recordParamsSchema = Joi.object({
  module: moduleSlug,
  id: Joi.string().pattern(/^\d+$/).required(),
});

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(MAX_PAGE_SIZE).default(20),
});

// TODO: the real create rules — Last_Name (and Company) are mandatory in
// Zoho by default; decide lengths, email/phone format, trimming/lowercasing.
const createLeadSchema = Joi.object({
  firstName: Joi.string().trim(),
  lastName: Joi.string().trim(),
  company: Joi.string().trim(),
  email: Joi.string().trim(),
  phone: Joi.string().trim(),
});

export { moduleParamsSchema, recordParamsSchema, listQuerySchema, createLeadSchema };
