# TSC Website ↔ Taskmaster integration

Source of truth for webhook URLs, auth, payloads, and deploy order.

Shared env template: [tsc-integration.env.example](./tsc-integration.env.example)

Production API base: see `.cursor/production-hosts.local.json` → `productionApiUrl`.

## Webhook URLs

| Flow | Taskmaster endpoint | TSC proxy route |
|------|---------------------|-----------------|
| Book a call | `POST /api/webhooks/book-call` | `POST /api/book-call` |
| Artist enquiry | `POST /api/webhooks/artist-enquiry` | `POST /api/query` |
| Artist path | `POST /api/webhooks/artist-path` | `POST /api/artist-path` |
| Newsletter | `POST /api/webhooks/newsletter` | `POST /api/newsletter` |
| Masterclass review | `POST /api/webhooks/masterclass-review` | `POST /api/reviews`, `/api/reviews02` |
| Review display | `GET /api/public/masterclass-reviews?campaign=review01\|review02` | GET on same TSC routes |

## Auth rules

| Route | Auth |
|-------|------|
| `artist-enquiry` | `X-Webhook-Secret` only (`ARTIST_ENQUIRY_WEBHOOK_SECRET`) |
| `newsletter` | `X-Webhook-Secret` only (`NEWSLETTER_WEBHOOK_SECRET`) |
| `masterclass-review` | `X-Webhook-Secret` only (`MASTERCLASS_REVIEW_WEBHOOK_SECRET`) |
| `book-call`, `artist-path` | `X-Webhook-Secret` **or** HMAC `X-Webhook-Signature: sha256=<hex>` |

Implementation: `server/utils/webhookAuth.js`

## Payload notes

All TSC outbound payloads include `source: "tsc-website"` and `sourceSite: "tsc-website"`.

### Newsletter

```json
{ "email": "user@example.com", "source": "tsc-footer", "subscribedAt": "ISO-8601", "sourceSite": "tsc-website" }
```

Response: `{ "success": true, "subscriberId": "..." }`

### Masterclass review

Flat JSON from TSC review forms plus `campaign: "review01" | "review02"`. Stored with `isApproved: false`. Admin approve: `PATCH /api/admin/masterclass-reviews/:id/approve` (JWT admin).

### Artist enquiry field aliases

TSC `query` form maps to Taskmaster via `organization`/`company`, `collaborationType`/`engagementType`, `projectNature`/`nature`, `whenWhere`/`whenAndWhere`, etc. See `TSC-Website/lib/forwardArtistEnquiry.ts`.

### Artist path

CamelCase TSC form fields normalized to HolySheet keys in `artistPathImportService.normalizeWebhookPayload`. WhatsApp confirmation sent from Taskmaster (`Confirmation TSC` campaign) when `AISENSY_API_KEY` is set.

## Env checklist

### Render (Taskmaster)

- `BOOK_CALL_WEBHOOK_SECRET`, `ARTIST_ENQUIRY_WEBHOOK_SECRET`, `ARTIST_PATH_WEBHOOK_SECRET`, `NEWSLETTER_WEBHOOK_SECRET`, `MASTERCLASS_REVIEW_WEBHOOK_SECRET`
- `REDIS_URL` (webhook queue)
- `AISENSY_API_KEY`, optional `AISENSY_ARTIST_PATH_CAMPAIGN`
- `BOOKED_CALLS_CRM_ONLY=true`
- `HOLYSHEET_ARTIST_PATH_API_KEY` (legacy sheet sync only)

### Vercel (TSC)

- All `TASKMASTER_*_WEBHOOK_URL` vars (see env template)
- Matching `*_WEBHOOK_SECRET` values (identical to Render)
- Remove after cutover: `GOOGLE_*`, `HOLYSHEET_*`, `AISENSY_*`, `SPREADSHEET_ID`

## Deploy order

1. Generate 5 secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Deploy **Taskmaster** → run `node server/scripts/smoke-tsc-webhooks.js`
3. Deploy **TSC** → run `node scripts/test-tsc-webhooks.mjs`
4. Remove legacy env from Vercel; disable `send-reminders` workflow (already deprecated)

## Smoke scripts

| Script | Repo | Purpose |
|--------|------|---------|
| `server/scripts/smoke-tsc-webhooks.js` | Taskmaster | Direct POST all 5 webhooks |
| `scripts/test-tsc-webhooks.mjs` | TSC-Website | POST all TSC `/api/*` proxies |

Optional: `TASKMASTER_BASE_URL`, `TSC_BASE_URL` for staging/prod smoke.

## Test contacts (dev/smoke only)

Use `@example.com` or personal test values from the test-values skill — never production customer PII in committed fixtures.

## Admin: approve reviews

```http
PATCH /api/admin/masterclass-reviews/:id/approve
Authorization: Bearer <admin JWT>
```

After approval, review appears on TSC pages via public GET proxy.
