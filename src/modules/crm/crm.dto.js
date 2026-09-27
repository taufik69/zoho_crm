/**
 * Field mapping between this API and Zoho CRM API names.
 *
 * Our request/response bodies use camelCase (`firstName`); Zoho uses its
 * field API names (`First_Name`), which are NOT the labels shown in the CRM
 * UI ("First Name"). All translation happens here, in one place — a field
 * reaches the client, or reaches Zoho, only if it is listed below.
 *
 * API names: CRM → Setup → Developer Hub → APIs → API Names, or
 * GET /settings/fields?module=Leads.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/crm.md
 */

// TODO: map the validated body to Zoho API names
// (First_Name, Last_Name, Company, Email, Phone, ...).
// eslint-disable-next-line no-unused-vars
const toLeadPayload = (body) => ({});

// TODO: Record ID, Name, Email and one additional field — Name is
// Full_Name on Leads/Contacts but Account_Name on Accounts.
const toRecordResponse = (row) => {
  if (!row) return null;

  return { id: row.id };
};

const toRecordResponseList = (rows) => (rows ?? []).map(toRecordResponse);

export { toLeadPayload, toRecordResponse, toRecordResponseList };
