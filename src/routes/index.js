/**
 * The single mount point for every route in the app. app.js mounts this
 * router and nothing else, so adding a module means one import and one
 * `router.use(...)` line here — never an edit to app.js.
 *
 * Versioning lives in the path (`/api/v1`). A breaking change ships as
 * `/api/v2` mounted beside v1, so existing clients keep working until they
 * migrate; nothing below the prefix knows which version it is serving.
 *
 * See .claude/skills/backend-scaffold/SKILL.md
 */

import express from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import crmRoutes from '../modules/crm/crm.routes.js';

const API_V1 = '/api/v1';

const router = express.Router();

// Health first, and outside the versioned prefix: probes must not depend on
// API routing, and keeping it ahead of everything else means no rate-limit
// middleware added later can accidentally shadow it.
router.use('/health', healthRoutes);

// --- Feature module routes (alphabetical) ---
router.use(`${API_V1}/auth`, authRoutes);
router.use(`${API_V1}/crm`, crmRoutes);

export default router;
