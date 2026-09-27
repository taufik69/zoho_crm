# CRM sprint 7 — Contract doc + end-to-end verification

Plan ref: crm-read-insert-plan.md §6, §7
Depends on: sprints 1–6
File: `docs/api/crm.md` (new)

## Tasks — doc

- [x] Follow `.claude/skills/api-contract-doc/SKILL.md` format.
- [x] Sibling check against `auth.md`; divergences: `hasMore` pagination
      (Zoho has no total), no guard, limiter on create only.
- [x] Record model: string ids, module slugs, field mapping table,
      Accounts `email: null`, lookup objects.
- [x] Zoho connection + failure-mode table.
- [x] Three endpoints with envelope-complete examples and error tables.

## Tasks — end-to-end run

- [x] OAuth connected (auth sprint 9).
- [x] Point 2: leads / contacts / accounts listed.
- [x] Point 3: John Smith created, id `7617346000000702001`.
- [x] Point 4: John Smith fetched by that id.
- [x] Errors: unknown module 400, bad id 400, unknown id 404, missing fields
      400, not connected 401.
- [ ] Zoho UI shows John Smith (see sprint 5).

## Done

All code sprints done. Only the manual Zoho UI check remains.
