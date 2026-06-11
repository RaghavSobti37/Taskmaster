# Taskmaster Prisma Schema — Mongo → PostgreSQL (Supabase)

Phase 1 database design for the NestJS migration path. This folder holds the **target** Postgres schema; no destructive migrations are run until data ETL is approved.

## ID strategy

| Rule | Detail |
|------|--------|
| Primary keys | `String @id` everywhere — **preserve existing Mongo ObjectId hex strings** (24-char lowercase hex) |
| No auto-increment | Do not use `@default(cuid())`, `@default(uuid())`, or serial IDs for migrated rows |
| New rows (post-cutover) | Application generates ObjectId-compatible hex via existing `mongoose.Types.ObjectId()` or equivalent |
| Foreign keys | Same string type; values copied verbatim from Mongo refs |

This lets Mongo and Postgres run in parallel during dual-write / backfill without ID remapping.

## Tenant scoping & RLS

- Every tenant-scoped table has `tenantId String` + `@@index([tenantId])`
- Supabase RLS pattern (apply in SQL migrations, not in Prisma):

```sql
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Lead"
  FOR ALL
  TO authenticated
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
```

- NestJS middleware sets `SET LOCAL app.tenant_id = '<tenantObjectIdHex>'` per request (same as Mongo `tenantPlugin` + AsyncLocalStorage)
- **Global tables** (no RLS tenant column today): only `Tenant` itself
- Tables that lacked `tenantPlugin` in Mongo (`Attendance`, `LeaveRequest`, `TaskAssignment`, `MailTemplate`, `CRMStatSnapshot`, `GamificationConfig`, etc.) **gain `tenantId`** in Postgres for consistent RLS

## Migration tiers

### Tier 1 — Foundation
| Prisma model | Mongo collection |
|--------------|------------------|
| Tenant | tenants |
| User | users |
| Department | departments |
| Team | teams |
| Workspace | workspaces |

### Tier 2 — Projects & tasks
| Prisma model | Mongo collection |
|--------------|------------------|
| Project | projects |
| ProjectMember | *(flattened from Project.members / memberRoles)* |
| Phase | phases |
| Task | tasks |
| TaskAssignment | taskassignments |
| TaskType | tasktypes |
| TaskActivity | taskactivities |
| TaskMentionReceipt | taskmentionreceipts |
| TaskDependency | *(flattened from Task.dependencies)* |
| TaskMentionAccess | *(flattened from Task.mentionAccessIds)* |

### Tier 3 — Person spine, CRM, HR, gamification
| Prisma model | Mongo collection |
|--------------|------------------|
| Person | people |
| PersonIdentifier | personidentifiers |
| PersonSourceLink | personsourcelinks |
| PersonCommunicationProfile | personcommunicationprofiles |
| PersonHubView | personhubviews |
| Lead | leads |
| LeadNote | *(flattened from Lead.notes)* |
| LeadExlyOffering | *(flattened from Lead.exlyOfferings)* |
| CRMConfig | crmconfigs |
| CRMImport | crmimports |
| CRMAudit | crmaudits |
| EMI | emis |
| Attendance | attendances |
| LeaveRequest | leaverequests |
| GamificationConfig | gamificationconfigs |
| DailyMission | dailymissions |
| XPAuditLog | xpauditlogs |
| Notification | notifications |
| DashboardPreset | dashboardPresets |

### Tier 4 — Mail, goals, source facts, artists
| Prisma model | Mongo collection |
|--------------|------------------|
| MailTemplate | mailtemplates |
| EmailProfile | emailprofiles |
| Campaign | campaigns |
| CampaignRecipient | *(flattened from Campaign.recipients)* |
| MailCampaign | mailcampaigns |
| MailCampaignRecipient | *(flattened from MailCampaign.recipients)* |
| MailEvent | mailevents |
| EmailLog | emaillogs |
| ProjectGoal | projectgoals |
| ProjectGoalSnapshot | projectgoalsnapshots |
| ProjectKRA | projectkras |
| ArtistPathResponse | artistpathresponses |
| BookedCall | bookedcalls |
| OutsourcedRecord | outsourcedrecords |
| ExlyBooking | exlybookings |
| NewsletterSubscriber | newslettersubscribers |
| Artist | artists |
| ArtistMetrics | artistmetrics |
| ArtistAuth | artistauths |
| ArtistConnection | artistconnections |
| CRMStatSnapshot | crmstatsnapshots |

## Deferred (Tier 5+)

Not in `schema.prisma` yet — add when those modules migrate:

| Mongo model | Collection | Reason |
|-------------|------------|--------|
| PersonIndex | personindices | Legacy read model; deprecate after PersonHubView parity |
| Contact | contacts | Superseded by Person spine |
| Announcement | announcements | Comms module |
| CalendarEvent | calendarevents | Calendar module |
| Asset | assets | Project assets |
| FinanceDocument | financedocuments | Finance tree + UploadThing |
| OfficeAsset | officeassets | Ops inventory |
| OfficeContact | officecontacts | Directory |
| Subscription | subscriptions | Vendor renewals |
| ExlyOffering | exlyofferings | Exly catalog aggregates |
| TscData | tscdatas | HolySheet rows |
| DataHubSyncState | datahubsyncstates | Sync cursors |
| Log | logs | Activity log (TTL) |
| SystemLog | systemlogs | Structured logs (TTL) |
| UserNote | usernotes | Notes widget |
| PinBoardNote | pinboardnotes | Pin board |
| NavbarPreference | navbarPreferences | UI prefs |
| ShortcutPreference | shortcutPreferences | UI prefs |
| WorkspacePreference | workspacePreferences | UI prefs |
| NewsletterArticle | newsletterarticles | Newsletter CMS |
| NewsletterIssue | newsletterissues | Newsletter CMS |
| MasterclassReview | masterclassreviews | Reviews queue |
| MetaDeletionRequest | metadeletionrequests | Meta compliance |
| PlatformSettings | platformsettings | Global singleton |
| OrgAccount | orgaccounts | Org integrations |
| QATestRun | qaTestRuns | QA automation |

## Json vs flattened arrays

| Mongo pattern | Postgres approach |
|---------------|-------------------|
| CRMConfig dropdown arrays | `Json` columns |
| DashboardPreset elements / presets | `Json` |
| ProjectGoal targets / sourceLinks | `Json` |
| Lead.metadata, MailEvent.metadata | `Json` |
| User.googleAccounts, pushSubscriptions | `Json` (migrate to child tables later if needed) |
| Lead.notes[], Campaign.recipients[] | **Own tables** (LeadNote, CampaignRecipient, …) |
| TaskActivity, MailEvent, Notification | Already separate Mongo collections — 1:1 Prisma models |

## Person spine — cascade deletes

`ON DELETE CASCADE` from `Person` to:

- PersonIdentifier, PersonSourceLink, PersonCommunicationProfile, PersonHubView
- ArtistPathResponse

`ON DELETE SET NULL` on optional `personId` FKs: Lead, BookedCall, OutsourcedRecord, ExlyBooking, NewsletterSubscriber

## Validate locally

```bash
cd nestjs-server
npm install
DATABASE_URL="postgresql://user:pass@localhost:5432/taskmaster" npm run prisma:validate
```

No `prisma migrate` until ETL scripts and RLS policies are reviewed.

## Model count (this schema)

**55 Prisma models** across Tiers 1–4 (includes flattened child tables).
