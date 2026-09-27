/**
 * Endpoints for connecting this app to a Zoho CRM account over OAuth 2.0.
 * Wires limiters, validators and controllers — no logic of any kind.
 *
 * No authGuard / requirePermission here, unlike the stock scaffold: the app
 * has no users of its own. The Zoho account that consents IS the identity,
 * and `state` (verified in the service) is what protects the callback.
 *
 * authLimiter on connect + callback: those are the endpoints a script would
 * hammer to replay or guess at codes.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/auth.md
 */

import express from 'express';

import authController from './auth.controller.js';
import { callbackQuerySchema } from './auth.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authLimiter } from '../../shared/middlewares/rateLimiter.js';

const router = express.Router();

router.get('/connect', authLimiter, asyncHandler(authController.connect));

router.get(
  '/callback',
  authLimiter,
  validate(callbackQuerySchema, 'query'),
  asyncHandler(authController.callback)
);

router.get('/status', asyncHandler(authController.status));

router.post('/refresh', authLimiter, asyncHandler(authController.refresh));

export default router;
