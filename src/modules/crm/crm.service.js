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
import redisCache from '../../shared/utils/redis.js';

const list = async (moduleSlug, { page, perPage }) => {
  const cacheKey = `list:${moduleSlug}:${page}:${perPage}`;
  const cached = await redisCache.get(cacheKey);
  if (cached.value) return cached.value;

  const { apiName, fields } = CRM_MODULES[moduleSlug];
  const { rows, hasMore } = await crmRepository.findMany(apiName, { page, perPage, fields });

  const result = {
    data: toRecordResponseList(moduleSlug, rows),
    pagination: { page, perPage, hasMore },
  };
  await redisCache.set(cacheKey, result, cached.version);
  return result;
};

// Zoho answers 204 (null from the repository) for an id that does not exist.
const getById = async (moduleSlug, id) => {
  const cacheKey = `record:${moduleSlug}:${id}`;
  const cached = await redisCache.get(cacheKey);
  if (cached.value) return cached.value;

  const row = await crmRepository.findById(CRM_MODULES[moduleSlug].apiName, id);

  if (!row) {
    throw new AppError(httpStatus.NOT_FOUND, 'Record not found');
  }

  const result = toRecordResponse(moduleSlug, row);
  await redisCache.set(cacheKey, result, cached.version);
  return result;
};

const createLead = async (body) => {
  const duplicateFields = [];
  if (body.email && await crmRepository.findLeadDuplicate('Email', body.email)) duplicateFields.push('email');
  if (body.phone && await crmRepository.findLeadDuplicate('Phone', body.phone)) duplicateFields.push('phone');
  if (duplicateFields.length) {
    throw new AppError(httpStatus.CONFLICT, 'A lead with this email or phone already exists', { fields: duplicateFields });
  }

  const { id } = await crmRepository.createLead(toLeadPayload(body));
  await redisCache.invalidate();
  return { id };
};

export default { list, getById, createLead };
