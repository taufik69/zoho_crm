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

// Allowed module slugs → Zoho API name + the fields we read. `fields` is
// required on GET records in v8; we ask only for what we display.
const CRM_MODULES = Object.freeze({
  leads: { apiName: 'Leads', fields: ['Full_Name', 'Email', 'Company'] },
  contacts: { apiName: 'Contacts', fields: ['Full_Name', 'Email', 'Account_Name'] },
  // Accounts have no Email field by default — email is returned as null.
  accounts: { apiName: 'Accounts', fields: ['Account_Name', 'Phone'] },
});

// Zoho's own ceiling for `per_page` on GET records.
const MAX_PAGE_SIZE = 200;

export { CRM_API_VERSION, CRM_MODULES, MAX_PAGE_SIZE };
