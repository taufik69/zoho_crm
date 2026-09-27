/**
 * Thin HTTP layer for CRM records: read req, call the service, send through
 * ApiResponse. No Zoho calls, no field mapping — those live below.
 *
 * `list` uses ApiResponse.success with a `pagination` extra instead of
 * ApiResponse.paginated: Zoho returns `more_records`, not a total count, and
 * paginated() needs a real total — faking one would make totalPages a lie.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/crm.md
 */

import crmService from './crm.service.js';
import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';

const list = async (req, res) => {
  const { module } = req.params;
  const { page, perPage } = req.query;

  const { data, pagination } = await crmService.list(module, { page, perPage });

  return ApiResponse.success(res, httpStatus.OK, 'Records fetched successfully', data, { pagination });
};

const getById = async (req, res) => {
  const { module, id } = req.params;
  const record = await crmService.getById(module, id);
  return ApiResponse.success(res, httpStatus.OK, 'Record fetched successfully', record);
};

const createLead = async (req, res) => {
  const lead = await crmService.createLead(req.body);
  return ApiResponse.success(res, httpStatus.CREATED, 'Lead created successfully', lead);
};

export default { list, getById, createLead };
