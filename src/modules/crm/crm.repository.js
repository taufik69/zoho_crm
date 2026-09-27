/**
 * Data access for CRM records — every Zoho CRM API call for this module.
 *
 * The only file in the module that imports the Zoho client. It answers
 * "what did Zoho return": no AppError, no status decisions, no field
 * mapping. A null from here is a fact; the service decides it means 404.
 *
 * Paths are relative to `${apiDomain}/crm/${CRM_API_VERSION}` — the client
 * owns the host, the version and the Authorization header.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/crm.md
 */

import zohoClient from '../../integrations/zoho/zoho.client.js';

const findMany = async (moduleApiName, { page, perPage, fields }) => {
  const body = await zohoClient.request('GET', `/${moduleApiName}`, {
    query: { fields: fields.join(','), page, per_page: perPage },
  });

  return { rows: body?.data ?? [], hasMore: body?.info?.more_records ?? false };
};

const findById = async (moduleApiName, id) => {
  const body = await zohoClient.request('GET', `/${moduleApiName}/${id}`);
  return body?.data?.[0] ?? null;
};

// Returns the created record's `details` ({ id, Created_Time, ... }).
const createLead = async (payload) => {
  const body = await zohoClient.request('POST', '/Leads', { body: { data: [payload] } });
  return body.data[0].details;
};

export default { findMany, findById, createLead };
