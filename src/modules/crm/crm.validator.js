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

// Last_Name and Company are mandatory on Zoho Leads; checking them here gives
// a field-level 400 before any Zoho call. Lengths follow Zoho's field limits.
const createLeadSchema = Joi.object({
  firstName: Joi.string().trim().max(40),
  lastName: Joi.string().trim().max(80).required(),
  company: Joi.string().trim().max(200).required(),
  email: Joi.string().trim().lowercase().email().max(100),
  phone: Joi.string().trim().pattern(/^\+?[0-9 ()-]{6,30}$/),
});

export { moduleParamsSchema, recordParamsSchema, listQuerySchema, createLeadSchema };
