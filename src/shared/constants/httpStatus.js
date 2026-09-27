/**
 * HTTP status-code constants. Every status in the app comes from here — never
 * a bare integer.
 *
 * 501/502/504 are additions over the stock scaffold: 501 is what a stubbed
 * endpoint answers until it is implemented, and 502/504 are how an upstream
 * Zoho failure is reported — the client's request was fine, the dependency
 * was not, and a 500 would blame our own code.
 *
 * See .claude/skills/api-response/SKILL.md
 */

const httpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  FOUND: 302,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

export default httpStatus;
