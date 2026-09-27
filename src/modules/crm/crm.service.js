/**
 * Business rules for CRM records: resolve the Zoho module name, apply
 * duplicate policy on create, decide what "not found" means.
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

const notImplemented = (name) => {
  throw new AppError(httpStatus.NOT_IMPLEMENTED, `${name} is not implemented yet`);
};

// TODO: map slug → Zoho module (CRM_MODULES), fetch the page, return
// { data: toRecordResponseList(rows), pagination: { page, perPage, hasMore } }.
// eslint-disable-next-line no-unused-vars
const list = async (module, { page, perPage }) => notImplemented('list');

// TODO: fetch by id; Zoho answers 204 (empty) for a missing record — turn
// that into AppError(NOT_FOUND). Return toRecordResponse(row).
// eslint-disable-next-line no-unused-vars
const getById = async (module, id) => notImplemented('getById');

// TODO: duplicate policy (e.g. Email as duplicate_check_fields, or search
// first), create via repository, return the created id + fetched record.
// eslint-disable-next-line no-unused-vars
const createLead = async (body) => notImplemented('createLead');

export default { list, getById, createLead };
