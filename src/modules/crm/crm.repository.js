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

// TODO: GET /{module}?page&per_page&fields — `fields` is REQUIRED on GET
// records in v8; pass the API names you display.
// eslint-disable-next-line no-unused-vars
const findMany = async (moduleApiName, { page, perPage, fields }) =>
  zohoClient.request('GET', `/${moduleApiName}`);

// TODO: GET /{module}/{id}; return data[0] or null.
const findById = async (moduleApiName, id) => zohoClient.request('GET', `/${moduleApiName}/${id}`);

// TODO: POST /Leads with { data: [payload] } (+ duplicate_check_fields /
// trigger as decided); return the created record's details.
// eslint-disable-next-line no-unused-vars
const createLead = async (payload) => zohoClient.request('POST', '/Leads');

export default { findMany, findById, createLead };
