/**
 * Shapes the stored token set into the connection status a client may see.
 *
 * This is the boundary that keeps secrets off the wire: the access token,
 * refresh token and client secret are never listed here, so they can never
 * reach a response — even when someone adds a field to the token store.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/auth.md
 */

import config from '../../config/env.js';

// `scopes` makes an OAUTH_SCOPE_MISMATCH diagnosable from /status alone.
// Fields are picked one by one — never spread `tokens` into the result.
const toConnectionResponse = (tokens) => {
  if (!tokens) return { connected: false };

  return {
    connected: true,
    expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
    apiDomain: tokens.apiDomain ?? null,
    scopes: config.zoho.scopes.split(','),
  };
};

export { toConnectionResponse };
