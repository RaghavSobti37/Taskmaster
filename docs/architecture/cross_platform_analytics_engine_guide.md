# Architecture & Setup Guide: Cross-Platform Music, Video, and Social Analytics Engine

This document outlines the complete architectural roadmap, data pipeline configurations, API integration specifications, and database structures for the multi-platform artist analytics engine. It provides explicit setup instructions for both Artists and Developers.

---

## 🛠️ Unified System Architecture

```
                              ┌──► [YouTube Data API v3] ────────► Public Video & Feature Metrics
                              │
                              ├──► [YouTube Analytics API] ──────► Private Channel Insights (CTR, Watch Time)
[Your Backend Node/Next.js] ──────┤
                              ├──► [Meta Graph API] ─────────────► Instagram/Facebook Profiles & Reels Insights
                              │
                              └──► [Unified Aggregators / OSS] ──► Music DSP Infrastructure Integration Layer
                                        │
                                        ▼
                          [PostgreSQL / Supabase Database / MongoDB]
                                        │
                                        ▼
                          [External Dashboard Interface]
                         (React + Tailwind UI / Metabase / Appsmith)
```

---

## 👥 Module 1: Artist Onboarding & Account Setup (For Artists)

### 1. YouTube Connection Prerequisites
* Ensure you are logged into the Google Account that owns or holds managerial access to your official YouTube Artist Channel.
* When prompted in the Taskmaster Artist Hub, click **Connect YouTube**.
* Review the consent screen granting access to view your YouTube analytics reports and video statistics.

### 2. Meta (Instagram & Facebook) Connection Prerequisites
* **Switch to Professional Account**: Open the Instagram Mobile App -> Settings -> Account -> Switch to Professional Account (Select Creator or Business). Personal accounts are blocked by Meta APIs.
* **Link to Facebook Page**: Open Facebook on desktop or mobile -> Navigate to your official Artist Facebook Page -> Page Settings -> Linked Accounts -> Instagram -> Connect your Instagram professional account.
* When prompted in the Taskmaster Artist Hub, click **Connect Instagram** and authorize all requested permissions.

---

## 👨‍💻 Module 2: Developer Console & Credentials Setup (For Developers)

### 1. Google Cloud Console Setup (YouTube Data & Analytics API)
1. Navigate to the Google Cloud Console and open your project.
2. Search for and enable the following APIs:
   * **YouTube Data API v3**
   * **YouTube Analytics API**
3. Navigate to **APIs & Services > OAuth consent screen**:
   * Set User Type to **External**. Fill in App Name and developer contact details.
   * Add the following scopes:
     * `https://www.googleapis.com/auth/youtube.readonly`
     * `https://www.googleapis.com/auth/yt-analytics.readonly`
4. Navigate to **APIs & Services > Credentials**:
   * Click **Create Credentials > OAuth client ID** (Web application).
   * **Authorized JavaScript Origins**:
     * `https://tsccoreknot.com`
     * `http://localhost:3000`
     * `http://localhost:5173`
   * **Authorized Redirect URIs**:
     * `https://tsccoreknot.com/login`
     * `http://localhost:5000/api/artists/auth/callback/youtube`
     * `http://127.0.0.1:5000/api/artists/auth/callback/youtube`
   * Copy the resulting Client ID and Client Secret into your `.env` configuration.

```env
YOUTUBE_CLIENT_ID="your_copied_client_id_here"
YOUTUBE_CLIENT_SECRET="your_copied_client_secret_here"
YOUTUBE_REDIRECT_URI_DEV="http://localhost:5000/api/artists/auth/callback/youtube"
YOUTUBE_REDIRECT_URI_PROD="https://tsccoreknot.com/login"
```

### 2. Meta Developer Portal Setup (Instagram Graph API & Webhooks)
For Meta App ID `733417183164639` in the modern Meta App Dashboard (Graph API v19.0+ / v20.0+):

#### A. Enabling the Right Use Cases
In the new Meta portal UI, permissions and features are structured around **Use cases**:
1. In the left navigation menu, click **Use cases**.
2. Locate **Manage messaging & content on Instagram** and click **Customize**. Under Permissions, add `instagram_basic` and `instagram_manage_insights`.
3. Locate **Manage everything on your Page** and click **Customize**. Under Permissions, add `pages_show_list` and `pages_read_engagement`.
4. *(Optional)* If you need comment/mention tracking, also ensure `instagram_manage_comments` is requested.

#### B. Finding and Configuring Webhooks (For Real-Time `mentions`)
If "Webhooks" is not visible in the left sidebar:
1. Click **Add use cases** (top right on the Use cases page) or go to **Dashboard > Add Product** and select **Webhooks**.
2. Once added, click **Webhooks** in the left sidebar (or access via **App settings > Advanced** or inside your Use case customization -> Configuration).
3. In the Webhooks dropdown menu at the top, select **Instagram** (or **Page** if tracking page events).
4. Click **Subscribe to this object** (or **Edit Subscription**).
5. **Callback URL**: Enter your live HTTPS endpoint.
   * For Render production: `https://taskmaster-jfw0.onrender.com/api/webhooks/instagram`
   * For local testing via Ngrok: `https://<your-ngrok-subdomain>.ngrok-free.app/api/webhooks/instagram`
6. **Verify Token**: Enter exactly `verify_tsc` (matching `META_VERIFY_TOKEN` in your server `.env`).
7. Click **Verify and save**. Meta will immediately send a `GET` handshake request. The Node server (`webhookRoutes.js`) will validate `verify_tsc` and return the challenge code.
8. Once verified, a list of subscription fields will appear. Scroll down to `mentions` and click **Subscribe** to receive real-time POST payloads whenever external accounts tag Harshad/Duhita.

#### C. Connecting Harshad / Duhita Account Credentials
1. **Professional Account**: Open Instagram mobile app -> Settings -> Account -> Switch to Professional/Creator Account.
2. **Link to Facebook Page**: Open Facebook Page -> Settings -> Linked Accounts -> Connect Instagram Professional Account.
3. Use the **Graph API Explorer** tool in Meta Developers to generate a User Access Token with the scopes listed above.
4. Update `server/.env` with your permanent token:
```env
META_APP_ID="733417183164639"
META_APP_SECRET="38dd5d9fbf952919532575704da019dd"
META_USER_TOKEN="your_generated_long_lived_user_token"
META_VERIFY_TOKEN="verify_tsc"
META_WEBHOOK_VERIFY_TOKEN="verify_tsc"
```
5. Ensure Harshad Golesar's MongoDB document (`oauthCredentials.meta.igAccountId`) matches his actual Instagram Graph Account ID (obtained via `GET /me/accounts?fields=instagram_business_account`).

---


## 💾 Module 3: Database Models & Data Pipeline Engineering

### 1. Unified Database Schemas (MongoDB Specification)
To maintain single sources of truth, the artist profile document contains dedicated sub-documents for OAuth credentials, historical insights, and tracked video/post assets.

```javascript
// Tracked Video Schema (Native & Featured Earned Media)
const TrackedVideoSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  channelName: { type: String },
  isNative: { type: Boolean, default: true }, // true: Artist channel, false: Guest feature
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  watchTimeMinutes: { type: Number, default: 0 }, // YouTube Analytics API
  thumbnailCtr: { type: Number, default: 0 },     // YouTube Analytics API
  lastUpdated: { type: Date, default: Date.now }
});

// Instagram Media Asset Schema
const InstaMediaSchema = new mongoose.Schema({
  mediaId: { type: String, required: true },
  caption: { type: String },
  mediaType: { type: String, enum: ['IMAGE', 'VIDEO', 'REEL', 'CAROUSEL_ALBUM'] },
  likeCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  plays: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  saved: { type: Number, default: 0 },
  isMention: { type: Boolean, default: false }, // true if discovered via Webhook
  publishedAt: { type: Date },
  lastUpdated: { type: Date, default: Date.now }
});
```

### 2. Quota Optimization & Batch Processing Pipelines
* **YouTube Data API v3 (10,000 daily limit)**: Never use `/search` for regular stat updates (costs 100 units). Instead, collect exact video IDs once and query `/videos?id=id1,id2...` in batches of 50 (costs 1 unit). This allows 500,000 video updates daily for free.
* **Meta Graph API (BUC Rate Limits)**: Avoid real-time client queries. Execute background workers 2-3 times daily, storing results in the database and serving UI requests strictly from cache.

### 3. Track Guest Appearances & Earned Media
* Provide a frontend input where artists/managers submit external YouTube URLs where the artist is featured.
* The backend extracts the video ID and stores it with `isNative = false`.
* The batch engine polls stats alongside native videos, allowing separate visualization of owned channel performance vs. ecosystem reach.
