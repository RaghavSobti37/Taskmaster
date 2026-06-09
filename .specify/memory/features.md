# Feature map

## Navigation highlights

| Area | Routes | Notes |
| --- | --- | --- |
| Dashboard | `/` | Missions, leaderboard, announcements, projects today |
| Projects | `/projects`, `/projects/:id` | Goals/KRA strip, team, status ping |
| Tasks / Todo | `/todo` | Review actions, completed rollback, activity timeline |
| CRM | `/crm/leads`, followups | Person-linked leads |
| Email hub | `/emails/*` | Replaces `/workspace/emails` (redirect) |
| Data Hub | `/admin/data-hub` | Person detail, analytics charts |
| Artist Path | `/admin/artist-path` | HolySheet sync, profile slider |
| Attendance | Settings → Attendance | Work mode toggle, unified time card |
| Gamification | Leaderboard on dashboard | Last-week rank badge, XP gap |

## Project goals (new)

- Models: `ProjectGoal`, `ProjectGoalSnapshot`, `ProjectKRA`
- API: `projectGoalsController`, `projectKraController`, `projectGoalsService`
- UI: `ProjectGoalsPanel`, `ProjectGoalsStrip`, `ProjectGoalMetricCards`

## Mail / Resend

- From-address picker: `resendFromEmails.js` (client + server)
- Attachments: `campaignAttachments.js`, upload endpoint
- Template preview: `useMailTemplatePreview`, `visualEmailHtml.js`

## Removed dead code (Jun 2026)

- `mailCampaignWizardSnapshot.js` — old wizard unsaved guard
- `loadingPhraseSession.js` — replaced by `useLoadingPhrase`
- `client/utils/emailContentUtils.js` — server copy retained
