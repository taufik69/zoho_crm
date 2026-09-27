/**
 * Loads, validates and exposes environment configuration.
 *
 * This is the ONLY file in the project allowed to read process.env directly.
 * Every other file imports `config` from here instead. Keeping the read in
 * one place is what makes the fail-fast check below meaningful — a var that
 * is read somewhere else can go missing without this list noticing.
 *
 * There is no DATABASE_URL / REDIS_URL: Zoho CRM is the system of record, so
 * the app owns no database. The only state it keeps is the OAuth token pair
 * (src/integrations/zoho/token.store.js).
 *
 * See .claude/skills/backend-scaffold/SKILL.md
 */

import dotenv from 'dotenv';

// `quiet`: dotenv 17 otherwise prints a promo banner on every boot.
dotenv.config({ quiet: true });

const REQUIRED_ENV_VARS = ['PORT', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REDIRECT_URI'];

const missingVars = REQUIRED_ENV_VARS.filter((key) => {
  const value = process.env[key];
  return value === undefined || value === null || value === '';
});

if (missingVars.length > 0) {
  // Fail fast: an incompletely configured environment must never boot.
  //
  // This is the one deliberate `console.error` left in the codebase —
  // everything else logs through src/config/logger.js. The logger is
  // configured *from* this file, so importing it here would be a cycle, and
  // at this point in startup there is no configured logger to use anyway.
  console.error(
    `[env] Missing required environment variable(s): ${missingVars.join(', ')}. ` +
      'Check your .env file against .env.example.'
  );
  process.exit(1);
}

const DEFAULT_ZOHO_SCOPES =
  'ZohoCRM.modules.leads.ALL,ZohoCRM.modules.contacts.READ,ZohoCRM.modules.accounts.READ';

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT),
  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID,
    clientSecret: process.env.ZOHO_CLIENT_SECRET,
    redirectUri: process.env.ZOHO_REDIRECT_URI,
    // Data-centre specific. The CRM API domain is deliberately NOT configured
    // here: Zoho returns `api_domain` in every token response, and that value
    // — not a guess — is the host every CRM call must go to.
    accountsUrl: process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com',
    scopes: process.env.ZOHO_SCOPES || DEFAULT_ZOHO_SCOPES,
  },
  // Browser origin allowed through CORS. Optional — a dev machine without it
  // boots permissive rather than refusing to start.
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  // Pino's level threshold (src/config/logger.js). Optional: development
  // defaults to `debug`, production to `info`.
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};

export default config;
