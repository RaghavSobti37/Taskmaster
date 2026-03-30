# BACKEND NOT RESPONDING - DIAGNOSTIC STEPS

## 🔴 Issue: Fetch Request Hanging (Pending Status)

Your request is stuck in "pending" state, which means Render backend isn't responding.

---

## 🔧 Diagnostic Steps (Do These NOW)

### Step 1: Check Render Service Status
1. Go to https://dashboard.render.com
2. Click your service: `taskmaster-jfw0`
3. Look at the status indicator
   - 🟢 Green = Running
   - 🟡 Yellow = Deploying
   - 🔴 Red = Failed
   - ⚫ Gray = Suspended

**What to do:**
- If 🟡 Yellow: Wait 2-3 minutes for deployment to finish
- If 🔴 Red: Check logs for errors, then manual deploy again
- If ⚫ Gray: Service is suspended (Render free tier issue), restart it
- If 🟢 Green: Proceed to Step 2

### Step 2: Check Render Logs for Errors
1. In Render Dashboard, click **Logs** tab
2. Look for:
   - ✅ `[STARTUP] Server running on port 5000` = Good
   - ❌ `[ERROR]` = Problem
   - ❌ `crashed` = Service crashed
   - ❌ `EADDRINUSE` = Port in use

**If you see errors:**
- Copy the error message
- Click **Manual Deploy** again
- Wait for clean startup

### Step 3: Test with Browser DevTools

**In browser console, run:**
```javascript
// Test with timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

fetch('https://taskmaster-jfw0.onrender.com/api/health', 
  { signal: controller.signal })
  .then(r => {
    clearTimeout(timeoutId);
    console.log('Status:', r.status);
    return r.json();
  })
  .then(d => console.log('✅ Response:', d))
  .catch(e => console.error('❌ Error:', e.message));
```

**Expected outcomes:**
- ✅ Success: Returns `{status: "ok", ...}`
- ❌ "abort" error: Backend timeout (not responding)
- ❌ CORS error: CORS misconfigured
- ❌ Network error: Backend unreachable

### Step 4: Force Render Restart

If backend still not responding:

1. Go to Render Dashboard → Your service: `taskmaster-jfw0`
2. Click **Manual Deploy**
3. Select branch: `main`
4. Click **Deploy**
5. **DO NOT CLICK ANYTHING ELSE** - Let it deploy
6. Watch logs real-time for: `[STARTUP] Server running on port 5000`
7. Once you see that, wait 30 seconds
8. Then try the health endpoint again

### Step 5: Check MongoDB Connection

In browser console:
```javascript
fetch('https://taskmaster-jfw0.onrender.com/api/health')
  .then(r => r.json())
  .then(d => console.log('DB Connected:', d))
  .catch(e => console.error('Failed:', e))
```

**If this also times out:** MongoDB connection might be failing, check:
1. Is `MONGO_URI` correct in Render? 
2. Is MongoDB cluster accepting connections?
3. Are IP whitelist rules correct?

---

## 🚨 Common Causes & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Request hangs (pending) | Backend not responding | Restart Render service |
| Service shows Red/Gray status | Deployment failed or crashed | Manual deploy again |
| Can't connect to MongoDB | Wrong connection string | Verify MONGO_URI in Render env |
| CORS error | CORS not properly configured | Check CORS_ALLOWED_ORIGINS |
| 500 error | Backend code error | Check Render logs for [ERROR] |

---

## ✅ Health Check Success Indicators

When backend is working, you should see:

**Console output:**
```
✅ Response: {
  status: "ok",
  timestamp: "2026-03-30T...",
  corsOrigins: [
    "https://tsccoreknot.com",
    ...
  ]
}
```

**Render logs should show:**
```
[STARTUP] Server running on port 5000
[DB] MongoDB Connected: ac-qoak662-shard-00-XX.lgafikg.mongodb.net
```

---

## 🆘 If Still Not Working

Do this and report back:

1. **Screenshot:**
   - Render Dashboard status (green/red/yellow/gray?)
   - Last 10 lines of Render logs
   - Browser console output

2. **Run this in console:**
   ```javascript
   fetch('https://taskmaster-jfw0.onrender.com/api/health', {signal: AbortSignal.timeout(5000)})
     .then(r => console.log('Status:', r.status, 'OK:', r.ok))
     .catch(e => console.error('Error:', e.message))
   ```
   
3. **Tell me:**
   - What's the error message?
   - What's the Render service status color?
   - When did you last deploy?

---

## 🔥 NUCLEAR OPTION (If nothing works)

1. Go to Render Dashboard
2. Find your service
3. Click **Settings** at bottom
4. Scroll to "Danger Zone"
5. Click **"Delete Service"**
6. Recreate the service and redeploy

(This is last resort - usually not needed)

---

**NEXT: Execute Step 1-3 above and report what you find! 🔍**
