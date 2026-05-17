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

### 2. Meta Developer Portal Setup (Instagram Graph API)
1. Go to the Meta for Developers Portal and create a **Business** App.
2. In the App Dashboard, add **Facebook Login for Business** and **Instagram Graph API**.
3. In App Settings > Basic, retrieve your **App ID** and **App Secret**.
4. Request the following scopes during OAuth flow:
   * `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`
5. Configure Webhooks: In the Meta App Dashboard -> Webhooks -> Select **Instagram** -> Subscribe to the `mentions` topic to receive real-time updates when external accounts tag your artist in posts or videos.
6. **Production Nginx Routing Configuration**: To prevent frontend React Router from intercepting webhook verification requests on single-domain deployments, configure Nginx proxy forwarding for API endpoints before frontend static fallback:
   ```nginx
   location /api/ {
       proxy_pass http://127.0.0.1:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_pass_request_arguments on;
   }
   ```

### 3. Open-Source Metabase UI Setup
1. Ensure Docker is installed on your local host or server infrastructure.
2. Run the Metabase container instance:
   ```bash
   docker run -d -p 3000:3000 --name metabase metabase/metabase
   ```
3. Open `http://localhost:3000` in your browser. Complete the wizard by connecting to your database instance to enable real-time dashboard visualizations.

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
