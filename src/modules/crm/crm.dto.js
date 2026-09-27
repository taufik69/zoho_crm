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

const toLeadPayload = ({ firstName, lastName, company, email, phone }) => ({
  First_Name: firstName,
  Last_Name: lastName,
  Company: company,
  Email: email,
  Phone: phone,
});

// Record ID, Name, Email + one additional field per module. Lookup fields
// (Contacts.Account_Name) are objects `{ name, id }` in Zoho.
const RECORD_MAPPERS = {
  leads: (row) => ({ name: row.Full_Name, email: row.Email, company: row.Company }),
  contacts: (row) => ({ name: row.Full_Name, email: row.Email, accountName: row.Account_Name?.name }),
  accounts: (row) => ({ name: row.Account_Name, email: null, phone: row.Phone }),
};

const toRecordResponse = (moduleSlug, row) => {
  if (!row) return null;

  return { id: row.id, ...RECORD_MAPPERS[moduleSlug](row) };
};

const toRecordResponseList = (moduleSlug, rows) => rows.map((row) => toRecordResponse(moduleSlug, row));

export { toLeadPayload, toRecordResponse, toRecordResponseList };
