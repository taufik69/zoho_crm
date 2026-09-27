/**
 * Business rules for CRM records: resolve the Zoho module name, shape
 * records through the DTO, decide what "not found" means.
 *
 * Never touches req/res, never calls Zoho directly (crm.repository.js does).
 * Throws AppError; Zoho-level failures arrive already translated by
 * src/integrations/zoho/zoho.errors.js.
 *
 * See .claude/skills/module-consistency/SKILL.md
 *      and docs/api/crm.md
 */

import crmRepository from './crm.repository.js';
import { toLeadPayload, toRecordResponse, toRecordResponseList } from './crm.dto.js';
import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { CRM_MODULES } from '../../shared/constants/zoho.js';

const list = async (moduleSlug, { page, perPage }) => {
  const { apiName, fields } = CRM_MODULES[moduleSlug];
  const { rows, hasMore } = await crmRepository.findMany(apiName, { page, perPage, fields });

  return {
    data: toRecordResponseList(moduleSlug, rows),
    pagination: { page, perPage, hasMore },
  };
};

// Zoho answers 204 (null from the repository) for an id that does not exist.
const getById = async (moduleSlug, id) => {
  const row = await crmRepository.findById(CRM_MODULES[moduleSlug].apiName, id);

  if (!row) {
    throw new AppError(httpStatus.NOT_FOUND, 'Record not found');
  }

  return toRecordResponse(moduleSlug, row);
};

const createLead = async (body) => {
  const { id } = await crmRepository.createLead(toLeadPayload(body));
  return { id };
};

export default { list, getById, createLead };
