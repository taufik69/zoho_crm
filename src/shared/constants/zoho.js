/**
 * Zoho CRM constants shared by the integration layer and the crm module.
 *
 * Module names are Zoho's API names (`Leads`, not `leads`) — the URL segment
 * is case-sensitive. The allow-list exists so an arbitrary path segment from
 * a client never reaches Zoho: an unknown module is rejected here with a
 * clear 400 instead of being forwarded and coming back as Zoho's
 * INVALID_MODULE.
 *
 * See .claude/skills/backend-scaffold/SKILL.md
 */

const CRM_API_VERSION = 'v8';

// TODO: confirm which modules the app exposes (assessment: Leads, Contacts or
// Accounts) and the lowercase URL slug each one is reached by.
const CRM_MODULES = Object.freeze({
  leads: 'Leads',
  contacts: 'Contacts',
  accounts: 'Accounts',
});

// Zoho's own ceiling for `per_page` on GET records.
const MAX_PAGE_SIZE = 200;

export { CRM_API_VERSION, CRM_MODULES, MAX_PAGE_SIZE };
