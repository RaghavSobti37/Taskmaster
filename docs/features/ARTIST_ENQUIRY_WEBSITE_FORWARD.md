# Marketing site: forward Artist Enquiry to Taskmaster

Apply in the **theshakticollective.in** Next.js repo (`pages/api/query.ts`), after the existing Google Sheets + email success path. User-facing success must not depend on Taskmaster.

## Environment (website host)

```env
TASKMASTER_ARTIST_ENQUIRY_WEBHOOK_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/webhooks/artist-enquiry
# Optional shared secret (must match Taskmaster ARTIST_ENQUIRY_WEBHOOK_SECRET)
ARTIST_ENQUIRY_WEBHOOK_SECRET=
```

Alternatively derive from book-call URL:

```env
TASKMASTER_WEBHOOK_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/webhooks/book-call
```

## Code to add (after Sheets + email succeed)

```ts
async function forwardToTaskmaster(data: Record<string, unknown>) {
  const taskmasterUrl =
    process.env.TASKMASTER_ARTIST_ENQUIRY_WEBHOOK_URL
    || process.env.TASKMASTER_WEBHOOK_URL?.replace(/book-call\/?$/, 'artist-enquiry')
    || 'https://YOUR-RENDER-SERVICE.onrender.com/api/webhooks/artist-enquiry';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = process.env.ARTIST_ENQUIRY_WEBHOOK_SECRET;
  if (secret) headers['X-Webhook-Secret'] = secret;

  try {
    const res = await fetch(taskmasterUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[artist-enquiry] Taskmaster forward non-OK', res.status, body);
    }
  } catch (e) {
    console.error('[artist-enquiry] Taskmaster forward failed', e);
  }
}

// Inside handler, after success:
await forwardToTaskmaster(data);
```

Send the same JSON body the form already posts (field names: `name`, `organization`, `email`, `phone`, plus step-2/3 fields). Taskmaster accepts aliases documented in `server/services/artistEnquiryService.js`.

## Taskmaster behavior

- `POST /api/webhooks/artist-enquiry` → BullMQ job `artist-enquiry` (or sync if Redis down)
- Resolves artist → project (e.g. YUGM → **YUGM** project)
- Creates **high** priority task, type `enquiry`, assigned to `artist_management` on that project
- Does not replace Sheet/email on the website
