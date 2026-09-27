/**
 * Data access for the auth module: the token store and the Zoho accounts
 * server. This app has no database, so these are its "rows".
 *
 * The only file in the module that imports from src/integrations/zoho/. No
 * AppError, no business rules — it answers "what did the store / Zoho say",
 * and the service decides what that means.
 *
 * TODO: the pending `state` values (CSRF) need a home too — an in-memory Map
 * with a TTL is enough for a single process.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/auth.md
 */

import tokenStore from '../../integrations/zoho/token.store.js';
import zohoOauth from '../../integrations/zoho/zoho.oauth.js';

const buildAuthorizeUrl = (state) => zohoOauth.buildAuthorizeUrl(state);

const exchangeCode = (code) => zohoOauth.exchangeCode(code);

const refreshAccessToken = (refreshToken) => zohoOauth.refreshAccessToken(refreshToken);

const getTokens = () => tokenStore.getTokens();

const saveTokens = (tokens) => tokenStore.saveTokens(tokens);

const clearTokens = () => tokenStore.clearTokens();

export default { buildAuthorizeUrl, exchangeCode, refreshAccessToken, getTokens, saveTokens, clearTokens };
