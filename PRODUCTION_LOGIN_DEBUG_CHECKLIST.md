# Production Login Debugging Checklist

## 🔴 ISSUE: Can't Login in Production

**Symptoms:**
- Backend is running and responding (server logs show it's live)
- HEAD / returns 404 (expected for API-only server)
- Login/Register attempts failing
- Frontend appears to be making requests but getting errors

---

## ✅ BACKEND CODE CHECKS

### 1. **Auth Routes Validation**
File: `server/routes/authRoutes.js`

**✓ Status:** POST routes exist for:
- `/login` - Accepts `{ login, password }`
- `/register` - Accepts `{ username, email, password }`
- `/me` - Protected route for getting current user

**Check:** Routes properly validate input using express-validator

### 2. **Auth Controller Logic**
File: `server/controllers/authController.js`

**✓ Status:** 
- `loginUser()` - Finds user by email OR username, compares password
- `registerUser()` - Creates new user with hashed password
- Both return JWT token and user data

**Check:** Error handling logs all failures with [LOGIN] and [REGISTER] tags

### 3. **Database Models**
File: `server/models/User.js`

**✓ Status:**
- User schema has: `username`, `email`, `password`, `role`, `profilePicture`
- Both username and email are `unique: true`

**Check:** Unique indexes created properly

### 4. **CORS Configuration**
File: `server/server.js`

**✓ Status:**
```javascript
app.use(cors({ 
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Check:** `allowedOrigins` includes `https://tsccoreknot.com`

### 5. **Error Handlers**
File: `server/server.js`

**✓ Status:**
- 404 handler returns JSON
- Global error handler catches all errors
- Returns JSON responses (not HTML)

---

## ✅ FRONTEND CODE CHECKS

### 1. **API Client Configuration**
File: `client/src/services/api.js`

**✓ Status:**
```javascript
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  ...
});
```

**Check:**
- ✓ Uses `import.meta.env.VITE_API_URL` from Vite
- ✓ Appends `/api` to base URL
- ✓ Sets `Content-Type: application/json`
- ✓ Adds Authorization header interceptor

### 2. **Auth Context**
File: `client/src/contexts/AuthContext.jsx`

**✓ Status:**
```javascript
const login = async (loginIdentifier, password) => {
  const { data } = await api.post('/auth/login', { 
    login: loginIdentifier, 
    password 
  });
  localStorage.setItem('token', data.token);
  setUser(data.user);
  navigate('/');
};
```

**Check:**
- ✓ Sends `{ login, password }` to `/auth/login`
- ✓ Saves token to localStorage
- ✓ Uses correct field name: `login` (not `email` or `username`)

### 3. **Login Page Form**
File: `client/src/pages/LoginPage.jsx`

**✓ Status:**
```javascript
<input 
  type="text" 
  id="login" 
  value={loginIdentifier} 
  onChange={(e) => setLoginIdentifier(e.target.value)} 
  required 
/>
```

**Check:**
- ✓ Collects email or username
- ✓ Collects password
- ✓ Passes to `login()` function

### 4. **Environment Files for Production**
- `client/.env` - Local dev: `VITE_API_URL=http://localhost:5000` ✓
- `client/.env.local` - Local dev: `VITE_API_URL=http://localhost:5000` ✓
- `client/.env.production` - Production: `VITE_API_URL=https://taskmaster-jfw0.onrender.com` ✓

**Check:** Vercel uses `.env.production` for builds

---

## 🔧 EXTERNAL CONFIGURATION CHECKS

### 1. **Render Backend Environment Variables**

**Required Variables:**
- [ ] `MONGO_URI` - Your MongoDB connection string
- [ ] `JWT_SECRET` - Secret key for signing JWTs
- [ ] `PORT` - Should be `5000`
- [ ] `NODE_ENV` - Should be `production`
- [ ] `CORS_ALLOWED_ORIGINS` - Should include `https://tsccoreknot.com`

**Action:** Go to [Render Dashboard](https://dashboard.render.com)
1. Select your service: `taskmaster-jfw0`
2. Click **Environment** tab
3. Verify all 5 variables are set correctly
4. If any are missing, add them and click "Save, rebuild, and deploy"

### 2. **Vercel Frontend Environment Variables**

**Required Variables:**
- [ ] None needed! Vercel uses `.env.production` from repo

**Action:** Go to [Vercel Dashboard](https://vercel.com/dashboard)
1. Select your project: `taskmaster` (or your project name)
2. Click **Settings** → **Environment Variables**
3. Should be empty (Vite reads from `.env` files in repo)
4. Verify build is using `.env.production`

### 3. **CORS Origin Check**

**Expected Flow:**
```
Browser: https://tsccoreknot.com
  ↓
Makes request to: https://taskmaster-jfw0.onrender.com/api/auth/login
  ↓
Server checks CORS: Is "https://tsccoreknot.com" in allowedOrigins?
  ↓
If YES → 200 OK
If NO → 403 Forbidden
```

**Render CORS_ALLOWED_ORIGINS should contain:**
```
https://tsccoreknot.com,https://taskmaster-sand.vercel.app,http://localhost:5173,http://localhost:5174
```

### 4. **MongoDB Connection**

**Verify:**
- [ ] MongoDB Atlas: Can you login to cluster?
- [ ] Cluster: Has "taskmaster" database?
- [ ] Database: Has "users" collection?
- [ ] IP Whitelist: Is Render IP whitelisted? (Usually 0.0.0.0/0 for safety)

---

## 🧪 MANUAL TESTING STEPS

### Test 1: Health Check
```bash
# Should return 200 OK
curl https://taskmaster-jfw0.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-30T...",
  "corsOrigins": ["https://tsccoreknot.com", ...]
}
```

### Test 2: Register New User
```bash
curl -X POST https://taskmaster-jfw0.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser123","email":"test@example.com","password":"password123"}'
```

Expected response: `201 Created` with `token` and `user` data

### Test 3: Login as Registered User
```bash
curl -X POST https://taskmaster-jfw0.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"test@example.com","password":"password123"}'
```

Expected response: `200 OK` with `token` and `user` data

### Test 4: Check CORS Headers
```bash
curl -i -X OPTIONS https://taskmaster-jfw0.onrender.com/api/auth/login \
  -H "Origin: https://tsccoreknot.com" \
  -H "Access-Control-Request-Method: POST"
```

Expected response headers:
```
Access-Control-Allow-Origin: https://tsccoreknot.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

---

## 🔍 BROWSER DEBUGGING

## 🧭 BLANK SCREEN (BUT API/TABLE DATA WORKS) - TARGETED DEBUG

If you can see successful API calls (for example team member data), but the page stays visually blank or mostly empty, use this flow.

### Step A: Confirm whether React mounted
1. Open `https://tsccoreknot.com/login`
2. Open DevTools → **Console**
3. Run:
  ```javascript
  const root = document.getElementById('root');
  console.log('root exists:', !!root);
  console.log('root child count:', root?.childElementCount);
  ```
4. Interpretation:
  - `root child count = 0`: app failed before rendering
  - `root child count > 0`: app rendered, likely CSS/layout/state issue

### Step B: Check for auth bootstrap hang (`/auth/me` pending)
1. Open DevTools → **Network**
2. Enable **Preserve log** and **Disable cache**
3. Hard refresh (`Ctrl+Shift+R`)
4. Filter by `auth/me`
5. If request stays **(pending)** for >10s, app can appear blank because `AuthProvider` waits for user load before rendering children.

### Step C: Verify this is not extension-injected JS noise
1. In Console, separate errors from your app files vs browser-extension files
2. Errors like `webpage_content_reporter.js` usually come from extensions
3. Re-test in Incognito (extensions off) or another browser profile
4. If blank screen disappears there, disable the offending extension for your production domain

### Step D: Validate runtime and asset loading
In Console, run:
```javascript
Promise.all([
  fetch('https://taskmaster-jfw0.onrender.com/api/health').then(r => ({ healthStatus: r.status })),
  fetch('https://taskmaster-jfw0.onrender.com/api/auth/me', {
   headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
  }).then(async r => ({ meStatus: r.status, meBody: await r.text() })).catch(e => ({ meError: e.message }))
]).then(console.log);
```

Expected:
- Health endpoint should return quickly (200)
- `/auth/me` should return 200 (valid token) or 401 (expired token), but not hang indefinitely

### Step E: Quick isolation checks
1. Clear token and retry:
  ```javascript
  localStorage.removeItem('token');
  location.reload();
  ```
2. Open `/login` directly and verify if form appears
3. If `/login` is blank while CSS loads, capture first Console error and first pending Network request

### Step F: Evidence bundle to capture
Collect these 4 items for faster root-cause confirmation:
1. Console screenshot (first red error)
2. Network screenshot showing status of `/auth/me`
3. Output of `root child count` check
4. Result of the health + `/auth/me` script above

---

### Step 1: Open DevTools
1. Go to `https://tsccoreknot.com`
2. Press `F12` to open Developer Tools
3. Go to **Network** tab

### Step 2: Attempt Login
1. Enter email/username and password
2. Click **Login**
3. Watch the Network tab

### Step 3: Check Request
- **URL:** Should be `https://taskmaster-jfw0.onrender.com/api/auth/login`
- **Method:** Should be `POST`
- **Status:** Should be `200` or `400` (not `403` CORS error)
- **Headers** → **Request:**
  ```
  Content-Type: application/json
  ```
- **Headers** → **Response:**
  Should include:
  ```
  Access-Control-Allow-Origin: https://tsccoreknot.com
  ```

### Step 4: Check Response
- **Successful (200):**
  ```json
  {
    "token": "eyJ...",
    "user": { "_id": "...", "email": "...", ... }
  }
  ```
- **Failed (400):**
  ```json
  { "message": "Invalid credentials" }
  ```
- **CORS Error (403):**
  ```
  No 'Access-Control-Allow-Origin' header present
  ```

### Step 5: Check Console
Look for error messages in **Console** tab:
- `Failed to login` - Login endpoint returned error
- `CORS policy: Response to preflight` - CORS misconfigured
- `Network error` - Backend unreachable

---

## ❌ COMMON ISSUES & FIXES

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `403 CORS error` | `CORS_ALLOWED_ORIGINS` missing or wrong | Add to Render env vars |
| `400 Bad Request` | Wrong field names in request | Check login sends `{ login, password }` |
| `User not found` | Email/username doesn't exist | Register new user first |
| `Invalid credentials` | Wrong password | Check caps lock, password correct |
| `500 Server error` | Backend error | Check Render logs for [ERROR] tags |
| `API request hangs` | Backend not responding | Check Render status page |
| `Token not saved` | localStorage issue | Check browser's localStorage |
| `Redirects to login loop` | Token not being sent | Check Authorization header in DevTools |

---

## 📋 VERIFICATION CHECKLIST

Before testing production, verify these are in place:

### Backend
- [ ] Server shows: `[STARTUP] Environment: PRODUCTION`
- [ ] Server shows: `[STARTUP] API base: https://taskmaster-jfw0.onrender.com/api`
- [ ] Server shows: `[DB] MongoDB Connected: ...`
- [ ] No `[ERROR]` messages in startup logs

### Frontend Build
- [ ] Vercel build is successful
- [ ] `.env.production` exists and has `VITE_API_URL=https://taskmaster-jfw0.onrender.com`
- [ ] Vercel is serving from `https://tsccoreknot.com` (or your domain)

### Environment Variables (Render)
- [ ] `CORS_ALLOWED_ORIGINS` contains `https://tsccoreknot.com`
- [ ] `MONGO_URI` is set and correct
- [ ] `JWT_SECRET` is set
- [ ] `NODE_ENV=production`

### API Endpoints Working
- [ ] `GET /api/health` returns 200
- [ ] `POST /api/auth/register` works
- [ ] `POST /api/auth/login` works

---

## 🚨 IF STILL NOT WORKING

1. **Check Render Logs**
   - Dashboard → Your service → Logs
   - Look for `[ERROR]` messages
   - Share exact error with specific lines

2. **Check Vercel Logs**
   - Dashboard → Your project → Deployments
   - Check build logs for errors

3. **Test Manually**
   - Use curl/Postman to test endpoints directly
   - See if it's frontend or backend issue

4. **Check Network Request**
   - DevTools → Network tab
   - See exact request being sent
   - See exact response being received

5. **Verify Environment Variables**
   - Double-check spelling
   - Test variable expansion

---

**NEXT ACTION:** Follow the verification checklist and report findings!
