/**
 * Thin HTTP layer for the Zoho OAuth flow: read req, call the service, send
 * through ApiResponse. No token handling here — that is the service's job.
 *
 * `connect` is the one handler that does not answer with the envelope: it
 * issues a 302 to Zoho's consent screen, because a browser must follow it.
 * A JSON body with the URL in it would force every client to redirect by
 * hand. This is a documented exception, like /health.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/auth.md
 */

import authService from './auth.service.js';
import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';

const connect = async (req, res) => {
  const authorizeUrl = await authService.getAuthorizeUrl();
  return res.redirect(httpStatus.FOUND, authorizeUrl);
};

const callback = async (req, res) => {
  const connection = await authService.handleCallback(req.query);
  return ApiResponse.success(res, httpStatus.OK, 'Zoho CRM connected successfully', connection);
};

const status = async (req, res) => {
  const connection = await authService.getStatus();
  return ApiResponse.success(res, httpStatus.OK, 'Connection status fetched successfully', connection);
};

const refresh = async (req, res) => {
  const connection = await authService.refresh();
  return ApiResponse.success(res, httpStatus.OK, 'Access token refreshed successfully', connection);
};

export default { connect, callback, status, refresh };
