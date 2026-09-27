/**
 * CRM record endpoints: list and fetch Leads / Contacts / Accounts, create a
 * Lead. Wires validators and controllers — no logic of any kind.
 *
 * `:module` is validated against the allow-list in shared/constants/zoho.js
 * BEFORE the controller runs, so an unknown module is a 400 from us rather
 * than a round trip to Zoho for its INVALID_MODULE.
 *
 * POST is on a fixed `/leads` path rather than `/:module`: the assessment
 * inserts Leads only, and a generic create would need per-module field
 * rules this app does not have.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/crm.md
 */

import express from 'express';

import crmController from './crm.controller.js';
import {
  moduleParamsSchema,
  recordParamsSchema,
  listQuerySchema,
  createLeadSchema,
} from './crm.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { apiLimiter } from '../../shared/middlewares/rateLimiter.js';

const router = express.Router();

// Registered before `/:module` so `leads` POST is never read as a module
// param on a future generic route.
router.post('/leads', apiLimiter, validate(createLeadSchema), asyncHandler(crmController.createLead));

router.get(
  '/:module',
  validate(moduleParamsSchema, 'params'),
  validate(listQuerySchema, 'query'),
  asyncHandler(crmController.list)
);

router.get(
  '/:module/:id',
  validate(recordParamsSchema, 'params'),
  asyncHandler(crmController.getById)
);

export default router;
