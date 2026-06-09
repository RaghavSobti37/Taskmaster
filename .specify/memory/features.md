# Features

## Email campaigns

- **Campaign detail** (`/campaign/:campaignId`): stats, engagement over time, **registered location breakdown** (CRM city, descending horizontal bar chart), recipient delivery log.
- **Aggregate analytics** (`/emails` analytics tab): cumulative performance by event tag + **registered location breakdown** chart (opens/clicks/count by CRM city); click bar opens leads modal.

## Data sources for location charts

| Source | Used for charts |
| --- | --- |
| `Lead.location` / `Lead.city` | Primary |
| `PersonIndex.city` | Fallback when no Lead row |
| MailEvent Open/Click | Counts only — city from CRM map, not event IP |
