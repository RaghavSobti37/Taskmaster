# Email Engine — LOCKED (May 2026)

**Status: FROZEN.** Do not change tracking, geo, campaign dispatch, or mail template logic unless the user explicitly asks to modify the email engine.

This document records the verified production behavior after extensive debugging. Treat it as a contract.

---

## 1. Tracking URLs

| File | Responsibility |
|------|----------------|
| `server/utils/trackingUrls.js` | `TRACKING_BASE_URL` → public API (`taskmaster-jfw0.onrender.com`). Never fall back to suspended `taskmaster-api.onrender.com`. |
| `server/utils/emailTracker.js` | Inject 1×1 open pixel **before `</body>`**, no `display:none`. Wrap click links; skip unsubscribe/mailto/track URLs. |
| `server/routes/track.js` | `/api/track/open/:pixelId.gif` and `/api/track/click/:clickId`. |

**Local dev:** pixels hit public Render API. Use `MAIL_USE_PROD_DB=true` so `EmailLog` matches production DB.

---

## 2. Open tracking

- Gmail loads images via **GoogleImageProxy** → IP is Google (`66.249.*`), not the reader.
- **Do not** geo-locate opens from Google infrastructure IPs.
- Open pixel still records the open event; city is inferred from the **same recipient's click** when available.
- On click, `backfillOpenGeo()` updates prior Open `MailEvent` rows with the click's real city.

---

## 3. Click tracking

- Clicks use the reader's real browser IP via `extractClientIp(req)` (`X-Forwarded-For`, `req.ip`).
- City resolution: `geoip-lite` first, then **ip-api.com** HTTP fallback when city is missing.
- **No hardcoded cities** (removed Mumbai localhost fallback).
- Only valid city names shown — reject 2-letter country codes (`IN`, `US`) and `Unknown`.

---

## 4. Geo resolution (`server/utils/geoLookup.js`)

```
resolveMailEventCity()       → sync: stored city, metadata, or geoip-lite
resolveMailEventCityAsync() → async: ip-api.com fallback for clicks
buildClickCityByEmail()    → map email → click city (for Gmail open inference)
isGoogleInfrastructureIp() → block fake Mountain View on opens
```

**Campaign GET** (`server/routes/campaignRoutes.js`):
- `MailEvent.find({ campaignId }).setOptions({ bypassTenant: true })` — track routes create events without user tenant context.
- Attach `displayCity` to each event for the activity stream.
- Build `locationBreakdown` from resolved cities only (no placeholder cities).

---

## 5. MailEvent schema

```javascript
ipAddress: String          // always store real client IP on click
location: { city, country } // no defaults — omit when unknown
tenantId: from campaign      // must match for tenant-scoped reads
```

---

## 6. Campaign resolution

- `server/utils/resolveCampaign.js` — resolve by `campaignId` OR `_id`.
- Resend, dispatch, GET all use `resolveCampaignByParam()`.

---

## 7. Raw HTML templates

- `MailTemplate.format`: `'rawHtml' | 'visual'`
- Raw mode saves HTML as-is; no signature/unsubscribe wrapper merge on save.
- Server still appends signature/unsubscribe at send time if toggles enabled.

---

## 8. HolySheet defaults

- On **Fetch HolySheet**, all source tabs start **deselected** (`excludedSources` includes every HolySheet source).
- User explicitly selects tabs to include recipients.

---

## 9. Activity stream UI

- `client/src/pages/CampaignDetails.jsx`
- Timestamp format: `MMM dd, yyyy · HH:mm:ss`
- Location: `@ {displayCity}` from server `displayCity` field only.
- No fake placeholder cities in location chart.

---

## 10. Environment variables

```
TRACKING_BASE_URL=https://taskmaster-jfw0.onrender.com
FRONTEND_URL=https://tsccoreknot.com
MAIL_USE_PROD_DB=true          # local send tests sync to prod DB for tracking
MONGODB_URI_PROD=...
```

---

## Change policy

**DO NOT MODIFY** the files listed above for tracking/geo/template logic without explicit user instruction like "change email tracking" or "unlock email engine".

Safe changes: unrelated features, styling outside locked behavior, new campaigns, copy/text.
