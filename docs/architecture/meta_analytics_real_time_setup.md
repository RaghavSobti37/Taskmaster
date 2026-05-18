# Harshad Duhita Meta Analytics & Real-Time Webhooks Guide

This document provides exact, end-to-end instructions for configuring your Meta App (`733417183164639`) to pull real Instagram and Facebook analytics and receive real-time webhook mentions for **Harshad Golesar / Harshaduhita Collective**.

---

## 🏗️ 1. Navigating the Modern Meta App Dashboard (Graph API v19.0+)

In recent Meta Developer Portal updates, apps are organized by **Use cases** rather than standalone APIs.

### Step 1: Add Necessary Use Cases
1. Log in to [Meta for Developers](https://developers.facebook.com/) and select **TaskMaster Analytics** (App ID: `733417183164639`).
2. In the left navigation sidebar, click **Use cases**.
3. Locate **Manage messaging & content on Instagram** and click **Customize**.
   * Under Permissions, ensure you add `instagram_basic` and `instagram_manage_insights`.
4. Locate **Manage everything on your Page** and click **Customize**.
   * Under Permissions, ensure you add `pages_show_list` and `pages_read_engagement`.

---

## 🔗 2. Finding & Configuring Webhooks for Real-Time `@mentions`

In the new UI, the **Webhooks** product must be explicitly added if it is not visible in your left sidebar.

### Step 1: Enable the Webhooks Product
1. On the **Use cases** page, look at the top right and click the **Add use cases** (or **Add Product**) button.
2. Search for or select **Webhooks** and click **Add**.
3. Once successfully added, **Webhooks** will now appear in your left-hand menu.

### Step 2: Configure Subscription Endpoint
1. Click **Webhooks** in the left sidebar.
2. In the top dropdown menu (Object Type), select **Instagram**.
3. Click **Subscribe to this object** (or **Edit Subscription**).
4. Enter the following details:
   * **Callback URL (Production)**: `https://YOUR-RENDER-SERVICE.onrender.com/api/webhooks/instagram`
   * *(If testing locally via Ngrok)*: `https://<your-ngrok-id>.ngrok-free.app/api/webhooks/instagram`
   * **Verify Token**: Enter exactly `verify_tsc`
5. Click **Verify and Save**.
   > **How the Handshake Works**: Meta instantly sends an HTTP `GET` request to your backend route (`server/routes/webhookRoutes.js`). The server verifies that `hub.verify_token` equals `verify_tsc` and responds with `hub.challenge`.

### Step 3: Subscribe to the `mentions` Field
1. After the handshake succeeds, a table of available Instagram webhook fields will load below.
2. Scroll down to find the `mentions` row and click **Subscribe**.
3. Your app will now receive an instant HTTP `POST` payload anytime an external Instagram account tags Harshad Golesar or the Harshaduhita Collective.

---

## 🔐 3. Authorizing Harshad / Duhita Accounts

To read live metrics (likes, saves, reach, reel views), your server requires a valid User Access Token linked to Harshad's professional Instagram account.

### Step 1: Verify Account Prerequisites
1. **Instagram Professional Account**: Open the Instagram mobile app -> Go to Harshad Golesar's profile -> **Settings > Account > Switch to Professional Account** (Select Creator or Business).
2. **Link to Official Facebook Page**: Open Facebook -> Navigate to Harshad's official Facebook Page -> **Settings > Linked Accounts > Instagram** -> Connect the professional Instagram account.

### Step 2: Generate Long-Lived Access Token
1. Go to **Tools > Graph API Explorer** in the Meta Developer Portal.
2. In the **Meta App** dropdown, select **TaskMaster Analytics**.
3. In **User or Page**, select **Get User Access Token**.
4. In the permissions list, check:
   * `instagram_basic`
   * `instagram_manage_insights`
   * `pages_show_list`
   * `pages_read_engagement`
5. Click **Generate Access Token**. Confirm the popup authorization with Harshad's Facebook account.
6. Click the small blue info icon `(i)` next to your generated short-lived token -> Click **Open in Access Token Tool** -> Click **Extend Access Token** to generate a 60-day or permanent token.

---

## 💾 4. Updating Backend Configuration & Database

### Step 1: Update `.env` File
In your server directory (`server/.env`), verify these keys match:

```env
META_APP_ID="733417183164639"
META_APP_SECRET="38dd5d9fbf952919532575704da019dd"
META_USER_TOKEN="<your_extended_60_day_or_permanent_user_token>"
META_VERIFY_TOKEN="verify_tsc"
META_WEBHOOK_VERIFY_TOKEN="verify_tsc"
```

### Step 2: Obtain Harshad's Instagram Graph Account ID
In Graph API Explorer, run the following `GET` query to retrieve the internal Instagram Graph ID:
```
GET /me/accounts?fields=id,name,instagram_business_account
```
Copy the numeric ID found inside `instagram_business_account.id`.

### Step 3: Update Harshad's Database Profile
Ensure Harshad's MongoDB artist record contains the correct ID under `oauthCredentials.meta.igAccountId`:

```json
{
  "name": "Harshad Golesar",
  "oauthCredentials": {
    "meta": {
      "igAccountId": "<copied_instagram_business_account_id>",
      "fbPageId": "<copied_facebook_page_id>"
    }
  }
}
```

Whenever the frontend or background job triggers `GET /api/artists/:id/analytics/meta`, `analyticsService.js` will seamlessly fetch live posts, reel stats, followers, and engagement rates directly from Graph API v19.0.

---

## 📡 5. Activating Account-Level Webhook Subscriptions (CRITICAL STEP 3)

As emphasized in Meta's Webhook documentation: **Configuring webhooks in the App Dashboard is not enough.** Each Instagram Professional account must explicitly enable its subscription via Graph API.

We have built a dedicated API endpoint in TaskMaster to execute this handshake instantly:

### How to Trigger the Subscription API
Send an HTTP `POST` request to your backend:

```http
POST /api/artists/<artist_id>/webhooks/subscribe
Content-Type: application/json

{
  "subscribed_fields": "mentions,comments,messages,story_insights"
}
```

### What Happens Behind the Scenes
The server executes an authenticated Graph API call on Harshad's behalf:
```
Once Meta returns `{"success": true}`, real-time webhooks for Harshad Golesar are fully operational. Payloads are securely validated using SHA256 HMAC against your App Secret.

---

## 🚀 6. Automated Dashboard Login & ID Discovery (No Manual Token Copying)

Instead of manually generating tokens in Graph API Explorer, TaskMaster includes an automated OAuth 2.0 callback flow (`POST /api/artists/:id/auth/meta/callback`) that allows artists to log in directly from the web dashboard.

### How the Automated Flow Works
1. **Frontend Trigger**: On the artist dashboard, clicking **"Connect Instagram / Facebook"** opens Meta's login dialog:
   ```js
   const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement&response_type=code`;
   window.location.href = authUrl;
   ```
2. **Backend Code Exchange**: When Meta redirects back with `?code=XYZ`, your frontend calls `POST /api/artists/:id/auth/meta/callback`.
3. **Automated Discovery**:
   * The backend exchanges `code` for a **60-day permanent user access token**.
   * The backend calls `GET /me/accounts` to automatically discover all connected Facebook Pages (`fbPageId`).
   * The backend inspects each page (`GET /<page_id>?fields=instagram_business_account`) to automatically extract the connected **Instagram Professional Account ID (`igAccountId`)**.
4. **Instant Persistence & Sync**: The backend saves these exact IDs directly into MongoDB (`artist.oauthCredentials.meta`) and instantly runs `syncArtistStats()` to populate live followers, reach, and reels data.

---

## 🛠️ 7. Troubleshooting "App Not Active" Error During Login

If you click **"Connect Instagram / Facebook"** and see a Meta error screen stating:  
> *"App not active. This app is not accessible right now and the app developer is aware of the issue."*

This occurs because your Meta App is currently in **Development Mode**. In Development Mode, Meta blocks all logins from regular Facebook accounts unless they are explicitly registered as Developers or Testers.

### How to Fix in 60 Seconds:
1. **Add Harshad/Artist to App Roles**:
   * Open [Meta App Dashboard](https://developers.facebook.com/) -> Select **TaskMaster Analytics** (`733417183164639`).
   * In the left sidebar, click **App Roles** -> **Roles**.
   * Click **Add People** -> Select **Tester** (or Developer) -> Enter Harshad's Facebook account name or email.
   * Harshad will receive a notification on Facebook to accept the role. Once accepted, login will work instantly!
2. **Alternatively, Switch App to Live Mode**:
   * If you are ready for production, toggle the mode switch at the top of the Meta App Dashboard from **Development** to **Live**. *(Note: Live mode requires completing basic business verification).*
3. **Ensure Redirect URI is Whitelisted**:
   * In the Meta Dashboard left sidebar under products, click **Facebook Login for Business** -> **Settings**.
   * Under **Valid OAuth Redirect URIs**, paste your callback URLs:
     * `http://localhost:5173/oauth/meta/callback`
     * `https://YOUR-RENDER-SERVICE.onrender.com/oauth/meta/callback`
   * Click **Save Changes**.


