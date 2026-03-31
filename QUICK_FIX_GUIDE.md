# QUICK START: Fix Production Login in 5 Steps

## Step 1: Restart Render Backend (2-3 minutes)

1. Go to: https://dashboard.render.com
2. Click your service: **taskmaster-jfw0**
3. Click **"Manual Deploy"** button (top right corner)
4. Select branch: **main**
5. Click **"Deploy"**
6. Wait for message: `Your service is live 🎉`
7. Check logs show: `[STARTUP] Server running on port 5000`

✅ **Done with Step 1**

---

## Step 2: Verify Environment Variables (1 minute)

1. In Render Dashboard (still showing your service)
2. Click **"Environment"** tab
3. Verify these 5 variables exist (if missing, add them):

```
MONGO_URI = mongodb+srv://raghavsobti37_db_user:9jWF1yYvcaKKNq18@main-cluster.lgafikg.mongodb.net/taskmaster?retryWrites=true&w=majority

JWT_SECRET = a_very_strong_and_secret_key_that_is_long

PORT = 5000

NODE_ENV = production

CORS_ALLOWED_ORIGINS = https://tsccoreknot.com,https://taskmaster-sand.vercel.app,http://localhost:5173,http://localhost:5174
```

**If you added/fixed any:** Click "Save, rebuild, and deploy" and wait 2-3 minutes

✅ **Done with Step 2**

---

## Step 3: Check Vercel Frontend (1 minute)

1. Go to: https://vercel.com/dashboard
2. Find your project: **taskmaster**
3. Check the **Deployments** tab
4. Latest deployment should show: ✅ **Ready**

If it shows ❌ **Failed**, click to rebuild

✅ **Done with Step 3**

---

## Step 4: Test Backend (2 minutes)

### Test in Browser Console:

1. Open any webpage
2. Press **F12** (DevTools)
3. Go to **Console** tab
4. Paste this:

```javascript
fetch('https://taskmaster-jfw0.onrender.com/api/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend OK:', d))
  .catch(e => console.error('❌ Backend Error:', e))
```

**Expected output:**
```
✅ Backend OK: {status: 'ok', timestamp: '...', corsOrigins: [...]}
```

**If error:** Backend not ready, wait 1 minute and try again

✅ **Done with Step 4**

---

## Step 5: Test Login (2 minutes)

1. Go to: https://tsccoreknot.com
2. Go to **Register** page
3. Create new account:
   - Email: `test@example.com`
   - Password: `TestPass123`
   - Username: `testuser`
4. Click **Register**
5. Should redirect to Dashboard

**If it worked:** ✅ **LOGIN IS FIXED!**

**If it didn't:**
- Open **DevTools** (F12) → **Network** tab
- Try register again
- Look for request to `/api/auth/register`
- Check the response (error message)
- Report the error message

---

## 🧭 If Production Shows Blank Screen

Use these fast checks when API calls are visible but UI is blank:

1. DevTools → Network → enable **Preserve log** + **Disable cache**
2. Hard refresh (`Ctrl+Shift+R`)
3. Check if `/api/auth/me` is stuck in **pending**
4. DevTools → Console, run:
   ```javascript
   const root = document.getElementById('root');
   console.log('root child count:', root?.childElementCount);
   ```
5. Re-test in Incognito (extensions disabled) to rule out extension script errors
6. Run:
   ```javascript
   fetch('https://taskmaster-jfw0.onrender.com/api/health').then(r => console.log('health', r.status));
   ```

If `/auth/me` hangs and health is fine, the blank state is usually auth bootstrapping waiting on user load.

---

## 🎉 That's It!

If all 5 steps completed successfully, your login should now work!

### If You Get Errors:

**Report these details:**

1. **Render Logs:**
   - Screenshot of last 10 lines in Render Dashboard → Logs

2. **Frontend Error:**
   - Open DevTools (F12) → Console
   - Try to login
   - Screenshot any red error messages

3. **Network Request:**
   - DevTools → Network tab
   - Try to login  
   - Screenshot the `/api/auth/login` request and response

---

## ⏱️ Estimated Total Time: 10-15 minutes

- Step 1: 3 minutes
- Step 2: 1 minute
- Step 3: 1 minute  
- Step 4: 2 minutes
- Step 5: 2 minutes
- Buffer: 5 minutes

**Ready? Go to Step 1! 🚀**
