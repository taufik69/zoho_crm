# Zoho CRM Technical Assessment — Answers

## 1. OAuth credentials and tokens

The **Client ID** identifies my application to Zoho. The **Client Secret** proves the application’s identity during the server-side OAuth flow, so I keep it on the server and never expose it in browser code or logs.

After the user approves access, Zoho issues an **access token** and a **refresh token**. I send the access token with CRM requests in the `Authorization: Zoho-oauthtoken <access_token>` header. The access token is short-lived; the refresh token lets the server obtain a replacement without asking the user to authorize again. In this project, the OAuth flow is handled in `src/integrations/zoho/zoho.oauth.js`, and credentials are kept out of source code.

## 2. Why authentication can fail later

Zoho access tokens expire, so an application that works today may get an authentication error later if it keeps using an old token. I request offline access, store the refresh token securely, and refresh the access token before it expires. This application refreshes when the token is within 60 seconds of expiry and retries once if Zoho rejects a token as invalid.

If the refresh token is revoked, or the application needs a scope it was not granted, refreshing will not fix the problem. The user must reconnect after the required scopes are configured. The refresh and retry logic is in `src/integrations/zoho/zoho.client.js`.

## 3. CRM field labels and API names

A field’s label is the name shown to a person in the CRM interface. Its API name is the identifier Zoho expects in requests. For example, the label `Customer Type` might have the API name `Customer_Type`. Sending a label where Zoho expects an API name can cause a request to fail or update the wrong field.

I check API names in Zoho CRM under **Setup → Developer Hub → APIs → API Names**, or use Zoho’s fields metadata endpoint. In this application, `src/modules/crm/crm.dto.js` maps client-facing names such as `firstName` to Zoho names such as `First_Name`.

## 4. Creating a Lead through the API

I send a `POST` request to `https://www.zohoapis.com/crm/v8/Leads` with a valid Zoho access token in the authorization header. Zoho expects records inside a `data` array. For example:

```json
{
  "data": [
    {
      "First_Name": "John",
      "Last_Name": "Smith",
      "Company": "ABC Ltd",
      "Email": "john@example.com",
      "Phone": "+8801XXXXXXXXX"
    }
  ]
}
```

For a Lead, `Last_Name` and `Company` are required. A successful create returns a success result containing the new record’s ID in `data[0].details.id`. The repository sends this request in `src/modules/crm/crm.repository.js`; the application’s public endpoint is `POST /api/v1/crm/leads`.

## 5. Retrieving a record versus searching

I use `GET /Leads/{id}` when I already know a record’s ID and need that specific record. I use `GET /Leads` to read records in pages. Search is for finding records by a value or condition when I do not know the ID—for example, searching Leads by email before creating a new one.

The choice depends on what I know: an ID is best for retrieving one known record, while search is useful for checking whether a record matching supplied criteria already exists.

## 6. Preventing duplicate records

Before creating a Lead, I check whether its email or phone is already in use. This application reserves those identifiers in Redis before the Zoho create request, which makes repeat requests through this API detectable immediately. It also searches Zoho for existing Leads, including records that were created before the Redis identifier index existed. If either value matches, the API returns `409 Conflict` instead of creating another Lead.

For a production integration, I would also consider configuring Zoho’s duplicate rules or using its upsert operation where its matching behavior fits the business requirements. I normalize email addresses before comparing them, and phone numbers should be normalized consistently as well.

## 7. `401` and `OAUTH_SCOPE_MISMATCH`

`OAUTH_SCOPE_MISMATCH` means the token does not grant permission for the requested operation. For example, a token with read-only access cannot create a record. I would check the failing request, the Zoho module and operation, and the granted scopes shown by the application’s auth status endpoint.

I would add the required scope to `ZOHO_SCOPES` and reconnect the application. Existing tokens do not gain new permissions when the configuration changes. Zoho reports this condition with HTTP `401`; this application translates it to `403` so the response indicates a permissions problem.

## 8. Supporting multiple customer CRM accounts

I would treat each customer as a separate tenant. Each tenant would have its own token record in a database, encrypted with a key managed through a KMS or secrets manager. The record would also store that customer’s Zoho API domain, since the domain can vary by data center.

For every request, the application would authenticate the tenant, load only that tenant’s credentials, and use them for Zoho calls. Tenant identity would be part of data access and cache boundaries. Tokens and secrets would never be written to logs. In the current single-account design, the token storage layer is isolated in `src/integrations/zoho/token.store.js`, which gives the application a clear place to extend for tenant-aware storage.

## 9. Synchronizing 200,000 records

I would run the synchronization as a background job rather than keeping a web request open. I would use Zoho’s supported pagination, with up to 200 records per page, and use page tokens or the Bulk Read API when the result size exceeds the regular search or list limits. For writes, I would send records in supported batches and track each record’s result.

The job would respect Zoho’s API limits. It would retry transient failures such as rate limits, timeouts, and server errors with exponential backoff, while leaving permanent validation errors for review. Failed records would be recorded separately with their IDs and error details. I would save a checkpoint—such as the last page token or the last successful modification time—after each successful batch so the job can resume after a restart. Structured logs and metrics would report progress, failures, retry counts, and elapsed time without exposing credentials or unnecessary personal data.

## 10. Designing the website-to-Zoho flow

The website would send the payload to our Node.js API over HTTPS. The API would validate the input, including the email and phone formats, and map the person’s name and other fields to Zoho’s API names. Since a Zoho Lead requires `Last_Name` and `Company`, the API would split `John Smith` into `First_Name: John` and `Last_Name: Smith`, and reject a name that cannot provide a last name. It would map `company`, `email`, and `phone` to `Company`, `Email`, and `Phone`.

The website would authenticate to our API with an appropriate mechanism, such as an API key or signed request. Our server would authenticate to Zoho using its stored OAuth credentials. Before creating the Lead, the API would check for a duplicate email or phone. It would then send a `POST` request to Zoho and return `201 Created` with the new record ID. Zoho’s internal error details would be translated into a safe response for the website.

If Zoho is temporarily unavailable, I would place the validated request in a durable queue and return `202 Accepted` only after the queue confirms it stored the job. A worker could retry transient failures and record permanent failures for follow-up. I would include a request ID in structured logs, avoid logging secrets or full personal data, and add HTTPS, rate limiting, monitoring, encrypted credential storage, and retry controls before production use.
