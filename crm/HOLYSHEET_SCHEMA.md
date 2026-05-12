# HolySheet Schema for TSC CRM

Create a Google Spreadsheet with the following tabs and column headers.

## Tab: Leads

| Column | Type | Description |
|--------|------|-------------|
| row_id | text | Unique ID (nanoid) |
| assigned_rep_id | text | Sales rep user ID |
| name | text | Lead name |
| email | text | Email |
| phone | text | Phone |
| webinar_dates | text | Webinar dates |
| attended | Y/N | Attended webinar |
| attendance_duration_min | number | Duration in minutes |
| meaningful_connect | YES/NO | Meaningful connect |
| lead_quality | 4,3,2,1,Future 4 | Lead quality |
| call_status | DNP, Switch Off/Wrong Number, Busy, Connected | Call status |
| lead_status | Not Interested, Cold, Warm, Hot, Token Received, Converted | Lead status |
| remarks | text | Long text |
| plan_option | One-Time, 3 Mo, 6 Mo, 9 Mo | Plan |
| locked_by | text | Row lock user ID |
| locked_at | ISO8601 | Lock timestamp |
| created_at | ISO8601 | Created |
| updated_at | ISO8601 | Updated |

## Tab: EMI_Tracking

| Column | Type | Description |
|--------|------|-------------|
| row_id | text | Unique ID |
| lead_row_id | text | References Leads.row_id |
| installment_no | number | 1, 2, 3... |
| due_date | YYYY-MM-DD | Due date |
| amount | number | Amount |
| status | Paid/Pending | Status |
| paid_at | ISO8601 | When paid |
| created_at | ISO8601 | Created |

## Tab: Audit_Log

| Column | Type | Description |
|--------|------|-------------|
| timestamp | ISO8601 | When changed |
| user_id | text | Who changed |
| user_role | text | admin/sales |
| lead_row_id | text | Lead affected |
| field_changed | text | Field name |
| old_value | text | Previous value |
| new_value | text | New value |

## Registration

1. Register the spreadsheet in HolySheet dashboard.
2. Create API key and link to this spreadsheet.
3. Ensure tabs `Leads`, `EMI_Tracking`, `Audit_Log` exist.
4. Set `HOLYSHEET_API_KEY` in the CRM `.env`.
