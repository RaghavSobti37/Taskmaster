# Google Integration Plan — Taskmaster
*Domain-restricted Google OAuth + Per-Project Calendar Linking + Google Calendar UI*

---

## Overview

| Feature | Status |
|---|---|
| Google OAuth Login | 🔧 To Implement |
| Domain restriction (`@theshakticollective.in`) | 🔧 To Implement |
| Admin account bypass (`redacted@example.com`) | 🔧 To Implement |
| Link user Google Calendar to Project | 🔧 To Implement |
| Show calendar events inside ProjectDetail | 🔧 To Implement |
| Google Calendar UI redesign in CalendarView | 🔧 To Implement |

> [!IMPORTANT]
> Complete **Steps 1–3 (GCP console)** before writing any code. The Client ID and Client Secret are required for everything else.

---

## Step 1 — Create a Google Cloud Project

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Top bar → Click project dropdown → **New Project**
3. Name: `Taskmaster` → **Create**
4. Wait ~30s, then select the new project from the dropdown

---

## Step 2 — Enable Required APIs

1. Left sidebar → **APIs & Services → Library**
2. Search and **Enable** each of these:
   - `Google Calendar API`
   - `Google People API` *(for profile info during login)*
3. Left sidebar → **APIs & Services → OAuth consent screen**
   - User Type: **Internal** *(since you'll restrict to your Workspace domain)*
   - App name: `Taskmaster`
   - User support email: your admin email
   - Developer contact email: your admin email
   - Scopes to add:
     - `openid`
     - `email`
     - `profile`
     - `https://www.googleapis.com/auth/calendar` *(for calendar read/write)*
   - Save

> [!NOTE]
> If you don't have a Google Workspace for `@theshakticollective.in`, set User Type to **External** instead, and add test users manually in the consent screen.

---

## Step 3 — Create OAuth 2.0 Credentials

1. Left sidebar → **APIs & Services → Credentials**
2. **Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: `Taskmaster Web`
5. Authorized JavaScript origins:
   ```
   http://localhost:5173
   ```
6. Authorized redirect URIs:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
7. Click **Create** → Download JSON or copy the **Client ID** and **Client Secret**
8. Paste into `server/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
   ADMIN_EMAIL=redacted@example.com
   ALLOWED_DOMAIN=theshakticollective.in
   ```

---

## Step 4 — Backend: Update User Model

Add Google OAuth fields to `server/models/User.js`:

```js
googleId: { type: String },
googleAccessToken: { type: String },
googleRefreshToken: { type: String },
googleCalendarLinked: { type: Boolean, default: false },
```

Also make `password` optional since Google login users won't have one:
```js
password: { type: String, required: false }
```

---

## Step 5 — Backend: OAuth Callback Route

Add to `server/routes/authRoutes.js`:
```js
router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleAuthCallback);
```

In `server/controllers/authController.js`, add two new exports:
- `googleAuthRedirect` — generates the Google consent URL with scopes and redirects
- `googleAuthCallback` — handles the callback, validates domain, upserts user, issues JWT, redirects to frontend

**Domain logic:**
```js
const domain = email.split('@')[1];
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN;

if (email !== ADMIN_EMAIL && domain !== ALLOWED_DOMAIN) {
  return res.redirect(`http://localhost:5173/login?error=unauthorized_domain`);
}
```

---

## Step 6 — Backend: Calendar Link per Project

1. Add to `server/models/Project.js`:
   ```js
   linkedCalendars: [{ 
     userId: { type: ObjectId, ref: 'User' },
     calendarId: { type: String, default: 'primary' }
   }]
   ```

2. New route `POST /api/projects/:id/link-calendar` — adds the logged-in user's calendar to the project
3. New route `GET /api/projects/:id/calendar-events` — fetches events from all linked members' calendars and returns merged list

---

## Step 7 — Frontend: Login Page — Google Button

In `client/src/pages/LoginPage.jsx`:
- Add a "Sign in with Google" button
- On click: `window.location.href = '/api/auth/google'`
- Handle `?error=unauthorized_domain` query param to show error message

---

## Step 8 — Frontend: AuthContext — Handle Google Redirect

After Google callback, server redirects to:
```
http://localhost:5173/auth/google/success?token=JWT_TOKEN&user=JSON
```

Add a new route `/auth/google/success` in App.jsx that:
1. Reads `?token` from URL
2. Calls `login(token, user)` from AuthContext
3. Redirects to `/`

---

## Step 9 — Frontend: ProjectDetail — Calendar Tab

1. Add `calendar` tab to `ProjectDetail.jsx` tabs array
2. New `ProjectCalendar.jsx` component:
   - Shows linked members' calendar events
   - "Link My Calendar" button → calls `POST /api/projects/:id/link-calendar`
   - Full month-view grid (Google Calendar aesthetic)

---

## Step 10 — Frontend: CalendarView UI Redesign

Redesign `CalendarView.jsx` to match Google Calendar:
- **Left sidebar**: mini month navigator, "My Calendars" toggle list
- **Main area**: month grid with event chips (colored by type)
- **Today highlighted** in blue circle
- **Event chips**: pill shape, left-truncated, colored
- Color palette: Google's blue `#1a73e8`, green `#0f9d58`, red `#d93025`

---

## Implementation Order

```
Step 1-3  →  GCP Console (manual, ~20 min)
Step 4    →  server/models/User.js
Step 5    →  server/controllers/authController.js + authRoutes.js
Step 6    →  server/models/Project.js + new controller + routes
Step 7    →  client/src/pages/LoginPage.jsx
Step 8    →  client/src/App.jsx + new GoogleSuccessPage
Step 9    →  client/src/pages/ProjectDetail.jsx + ProjectCalendar.jsx
Step 10   →  client/src/pages/CalendarView.jsx
```

---

## Security Notes

> [!CAUTION]
> Never commit `GOOGLE_CLIENT_SECRET` to git. It's already in `.env` which should be in `.gitignore`.

> [!WARNING]
> The `googleRefreshToken` stored in MongoDB grants long-lived calendar access. Store it encrypted in production (use `mongoose-field-encryption` or similar).

> [!TIP]
> Use `access_type: 'offline'` and `prompt: 'consent'` in the OAuth URL to ensure you always receive a refresh token on first login.
