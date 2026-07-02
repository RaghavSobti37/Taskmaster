# Integration Data Catalog

Checklist for adding a new external data source.

## Onboarding runbook

1. Map source columns → schema (identity vs enrichment vs forbidden)
2. Add inlet key in `shared/dataInlets.js`
3. Call `PersonIdentityService.resolvePerson` before insert
4. Store `personId` on the fact model
5. `PersonIdentityService.linkSource(personId, sourceType, recordId)`
6. `PersonHubBuilder.rebuildPerson(personId)`
7. Add Data Hub folder filter if needed (`buildFolderQuery`)
8. Add admin page only if source needs dedicated UX (see Artist Path)

---

## Per-source field tiers

### Artist Path sheet

| Tier | Fields | Store on |
|------|--------|----------|
| Required | email or phone, submittedAt, Q&A answers | `ArtistPathResponse` |
| Enrichment | city, artistType, primaryRole, learningGoal | `answers` object |
| Do NOT store | leadStatus, assignedRep, CRM notes | — use `Lead` |

Sheet ID: see `shared/artistPathSchema.js`. Import: `POST /api/artist-path/sync` or CSV upload.

### Exly webhook

| Tier | Fields | Store on |
|------|--------|----------|
| Required | offeringId, bookedOn, transactionId, pricePaid | `ExlyBooking` |
| Enrichment | paymentType, offeringTitle | `ExlyBooking` |
| Do NOT store | emailStatus (read PersonComms), marketing copy | — |

### Newsletter / website signup

| Tier | Fields | Store on |
|------|--------|----------|
| Required | email, subscribedAt, source | `NewsletterSubscriber` |
| Enrichment | name | identity via `Person` |
| Do NOT store | CRM call status, rep | — |

### Outsourced CSV

| Tier | Fields | Store on |
|------|--------|----------|
| Required | email or phone, campaign, importId | `OutsourcedRecord` |
| Enrichment | role, originSource, city | `OutsourcedRecord` |
| Do NOT store | leadStatus, assignedRep | — |

### CRM Lead (manual)

| Tier | Fields | Store on |
|------|--------|----------|
| Required | phone, name, source | `Lead` + `personId` |
| Enrichment | funnel fields (status, rep, follow-ups) | `Lead` only |
| Do NOT store | duplicate hub flags, emailStatus owner | PersonComms for comms |

### Mail events

| Tier | Fields | Store on |
|------|--------|----------|
| Required | email, eventType, timestamp | `MailEvent` |
| Enrichment | campaignId | `MailEvent` |
| Do NOT store | person name on every event | resolve `personId` at ingest |

### Booked call

| Tier | Fields | Store on |
|------|--------|----------|
| Required | email or phone, bookedAt, source | `BookedCall` |
| Enrichment | course, callStatus | `BookedCall` |
| Do NOT store | duplicate CRM funnel | pick BookedCall **or** Lead tag, not both |

---

## Identity rules

- One normalized email or phone → one `Person` (DB unique index on `PersonIdentifier`)
- Email-only + phone-only merge via identifier graph in `PersonIdentityService`
- Comms state: single writer = mail webhooks → `PersonCommunicationProfile`

## Admin surfaces

| Source | List | Detail |
|--------|------|--------|
| All people | Data Hub `/admin` | PersonHubView + lazy sections |
| CRM pipeline | `/crm/leads` | Lead-only |
| Artist Path respondents | `/admin/artist-path` | Cards + Q&A slider |
