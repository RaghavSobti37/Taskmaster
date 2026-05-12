# Audit-based reports

The CRM writes an audit row to `data/audit.csv` on every lead edit. Each row has:

| Column         | Description |
|----------------|-------------|
| `timestamp`    | When the edit happened (ISO) |
| `user_id`     | Who made the edit (e.g. sr05, sr06) |
| `user_role`   | Role at time of edit |
| `lead_row_id` | Which lead was edited |
| `field_changed` | e.g. `lead_status` or `updated` |
| `old_value`   | Previous value (if applicable) |
| `new_value`   | New value (e.g. Warm, Converted) |

---

## 1. Sales rep level daily reports (automated)

### What’s implemented

- **By lead owner (`by=rep`)**  
  For a given date, report is grouped by **assigned_rep_id** of the lead (who “owns” the lead). For each rep you get:
  - Number of edits on their leads that day
  - Number of unique leads touched
  - Breakdown by `field_changed` and `new_value` (e.g. lead_status → Warm: 5, Converted: 2)

- **By user who edited (`by=user`)**  
  Same metrics grouped by **user_id** (who actually made the change in the CRM).

### API

```http
GET /api/reports/daily?date=2026-03-17&by=rep
GET /api/reports/daily?date=2026-03-17&by=user
GET /api/reports/daily
```

- `date`: `YYYY-MM-DD` (default: today).
- `by`: `rep` (by lead owner) or `user` (by who edited). Default: `rep`.
- Requires auth (same as rest of CRM).

Example response (`by=rep`):

```json
{
  "date": "2026-03-17",
  "by": "rep",
  "rows": [
    {
      "repId": "sr06",
      "repName": "Satyam Mishra",
      "edits": 12,
      "uniqueLeads": 10,
      "byField": {
        "lead_status": { "Warm": 6, "Converted": 1, "Not Interested": 2 }
      }
    }
  ]
}
```

### Running daily automatically

1. **Cron on the server**  
   Call the API once per day (e.g. after midnight) and store or send the result:
   - `curl -b cookies.txt "https://your-crm.com/api/reports/daily?date=$(date +%Y-%m-%d)&by=rep"`
   - Or use a small script that logs in (e.g. passkey), then fetches and emails/saves the JSON.

2. **Vercel cron (if you use Vercel)**  
   Add a cron route that runs on a schedule, reads audit + leads (same logic as `lib/audit-reports.ts`), and sends the report (e.g. Slack, email, or append to a sheet).

3. **Scheduled job that reads CSV**  
   A script (Node or other) that runs daily, reads `data/audit.csv` and `data/leads.csv`, runs the same grouping logic (or calls the API internally), and emails/Slack the summary. No need to expose the API publicly if you run it on the same machine that has the data.

---

## 2. What else is theoretically possible from audit data

With the current audit columns you can support:

| Use case | How |
|----------|-----|
| **Conversion funnel over time** | Filter `field_changed === 'lead_status'`, count transitions to `Converted` per day/week. |
| **Lead history / timeline** | Already supported: `GET /api/audit?lead_row_id=...` for per-lead history. |
| **Who changed what (compliance)** | For each lead or date range, list user_id, timestamp, field_changed, old_value, new_value. |
| **Rep activity trends** | Daily/weekly counts of edits per rep (by `user_id` or by lead’s `assigned_rep_id`) — same as daily report, over many dates. |
| **Time-to-convert** | Join audit (first and last status change to Converted) with leads; compute days from creation/assignment to conversion. |
| **Re-engagement** | Find leads that had status set to Not Interested/Cold and later to Warm/Hot (audit by lead_row_id, order by timestamp). |
| **Field-level change frequency** | Count by `field_changed` and optionally `new_value` to see which fields are updated most. |
| **Incremental sync to sheet** | Already in use: “changed since last sync” is derived from audit timestamps. |

### Limitations

- **No “who assigned” history**  
  If you need “rep A assigned this lead to rep B on date X”, you’d have to log `assigned_rep_id` changes in audit (old_value/new_value). Right now we log a single “updated” row per save; you could add explicit audit rows for assignment changes.
- **No out-of-CRM actions**  
  Calls, emails, meetings are not in audit unless you add them (e.g. via integration or manual log).
- **No “view” events**  
  Only edits are logged; opening a lead without saving doesn’t create an audit row.

---

## 3. Files

- `lib/audit-reports.ts` – daily report logic (by rep, by user).
- `app/api/reports/daily/route.ts` – GET endpoint for daily report.
- `lib/csv-store.ts` – `getAudit()`, `getAuditByLead()`, `getLeadRowIdsChangedSince()`.
- `app/api/audit/route.ts` – GET by `lead_row_id` for lead history.
