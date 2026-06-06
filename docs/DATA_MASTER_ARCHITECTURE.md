# Data Master Architecture

Golden-record identity spine with lean source facts and materialized admin read models.

## Entity layers

```
Person (identity)
  ├── PersonIdentifier     unique (tenantId, type, valueNormalized)
  ├── PersonCommunicationProfile   email status, unsubscribed, bounces
  └── PersonSourceLink     personId → source fact records

Source facts (domain data + personId)
  Lead, ArtistPathResponse, ExlyBooking, OutsourcedRecord,
  BookedCall, NewsletterSubscriber, MailEvent

Read models (presentation only)
  PersonHubView            Data Hub list + folder counts
  Artist Path admin        filtered PersonHubView + lazy Q&A
```

## Write path

Every external input:

1. `PersonIdentityService.resolvePerson({ email, phone, name, city })`
2. Insert/update **source fact** with `personId`
3. `PersonIdentityService.linkSource(personId, sourceType, sourceId)`
4. `PersonHubBuilder.rebuildPerson(personId)`
5. Legacy: `ContactService.mergeContact` still updates `PersonIndex` during migration

## Never duplicate

| Field | Owner |
|-------|--------|
| Email / phone identity | `PersonIdentifier` |
| `emailStatus`, `unsubscribed`, bounce count | `PersonCommunicationProfile` |
| CRM funnel (`leadStatus`, rep, follow-ups) | `Lead` only |
| Artist Path Q&A | `ArtistPathResponse` only |

Mail webhooks write **PersonCommunicationProfile** only (plus legacy PersonIndex sync until deprecation).

## Page boundaries

| UI | Query target | Joins on list load |
|----|--------------|-------------------|
| `/crm/leads` | `Lead` projection | None |
| `/admin` Data Hub | `PersonHubView` (fallback `PersonIndex`) | None |
| `/admin/artist-path` | `PersonHubView` where `inArtistPath` | None; slider lazy-loads Q&A |

Detail sliders lazy-load sections via `GET /api/data-hub/people/:id?section=…`.

## Migration

1. Deploy models + services
2. Bootstrap runs `backfillPersonIds.js` when `Person` or `PersonHubView` empty
3. Optional: `node server/scripts/dedupePersonIdentities.js`
4. Keep `PersonIndex` read-only one deploy until counts match
5. Remove legacy merge writes when hub parity confirmed

## Key files

- Models: `server/models/Person*.js`, `ArtistPathResponse.js`, `PersonHubView.js`
- Services: `PersonIdentityService.js`, `PersonHubBuilder.js`, `artistPathImportService.js`
- Scripts: `server/scripts/backfillPersonIds.js`, `dedupePersonIdentities.js`
- Shared: `shared/dataInlets.js`, `shared/artistPathSchema.js`
