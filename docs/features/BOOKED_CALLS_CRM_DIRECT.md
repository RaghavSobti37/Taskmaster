# Booked calls → CRM only (no sheets)

## Flow

```
theshakticollective.in  →  POST /api/book-call  (TSC-Website)
                       →  POST /api/webhooks/book-call  (Taskmaster)
                       →  MongoDB Lead (source: Website Booking)
                       →  Rep assignment 2:1:1 (Satyam / Aryaman / Akash)
                       →  Data Hub contact merge
                       →  In-app follow-up reminders
                       →  AiSensy WhatsApp
```

There is **no** Google Sheets append, **no** HolySheet import, and **no** CRM “sync from sheet” button.

## Env (Taskmaster)

```env
BOOK_CALL_WEBHOOK_SECRET=<shared with TSC-Website>
AISENSY_API_KEY=<for WhatsApp>
```

Optional legacy vars (`HOLYSHEET_BOOKED_CALLS_*`, `SPREADSHEET_ID` for BookedCalls) are **unused** for new bookings.

## Env (TSC-Website)

```env
TASKMASTER_WEBHOOK_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/webhooks/book-call
BOOK_CALL_WEBHOOK_SECRET=<same as Taskmaster>
```

## TSC-Website files

- `pages/book-a-call.tsx` — form
- `pages/api/book-call.ts` — forward to Taskmaster
- `lib/forwardBookCall.ts` — URL + secret

## Taskmaster files

- `controllers/webhookController.js` — `processBookedCallLogic`
- `utils/bookedCallRepAssignment.js` — rep split
- `services/notificationService.js` — follow-up reminders

## Website reminders note

TSC `pages/api/check-reminders.ts` still reads the **BookedCalls** Google Sheet. Taskmaster CRM reminders cover assigned reps via `notificationService`. Disable or retire the website sheet cron if you no longer maintain that tab.
