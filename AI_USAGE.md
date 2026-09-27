# Part 4 — AI Usage

## Tool and workflow

I used Claude Code to help plan and implement the Zoho CRM integration. I first read the assessment requirements, then created a high-level plan and reviewed it before implementation. I broke the work into feature plans, specs, and small sprints so each part could be implemented and reviewed on its own.

I used project skills to keep the backend structure, API responses, error handling, and documentation consistent. I also used agent and subagent reviews to examine plans and code for gaps. I reviewed the suggestions and made the final decisions; the tools supported my work, but I remain responsible for understanding and explaining the implementation.

## What I changed / decided

I chose Node.js and Express and kept the implementation focused on the assessment’s OAuth and CRM requirements. I reviewed the plans and sprint specs before moving into implementation, then decided how the behavior should work at the API boundaries—for example, requiring `lastName` and `company` when creating a Lead, returning `email: null` for Accounts that do not have an email field, and translating Zoho errors into consistent responses. I also configured the redirect URI to match the local API callback and kept tokens and client secrets on the server.

## Problems solved

During review and endpoint verification, I found and fixed several integration issues:

- A redirect URI mismatch prevented the OAuth callback from working reliably.
- Malformed JSON was reaching the generic error path and returning `500`; it now returns `400`.
- Zoho reports `OAUTH_SCOPE_MISMATCH` with HTTP `401`; the application now recognizes the error code and returns `403` for the missing permission.
- An invalid access token was not being refreshed and retried; the Zoho client now refreshes it and retries once.
- A rejected refresh token could leave stale credentials stored; the client now clears them so the app can be reconnected.
- The OAuth callback authorization code could appear in request logs; request logging now redacts it.
- Zoho list responses do not provide a total record count, so the API reports Zoho’s `more_records` value instead of inventing pagination totals.
