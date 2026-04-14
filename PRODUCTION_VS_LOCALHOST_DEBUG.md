# Production vs Localhost Debugging Guide

## Overview
This document explains the differences between local development and production environments, and how to debug issues on both.

---

## Environment Differences

### 1. **Database Connection**

| Aspect | Localhost | Production |
|--------|-----------|------------|
| Connection String | `mongodb://localhost:27017` | MongoDB Atlas URI (cloud) |
| Timeout | Instant (local) | Network dependent (0.5-2s) |
| Pooling | 2-10 connections | More aggressive pooling |
| IP Whitelist | N/A | Must be configured in MongoDB |
| Authentication | Usually None | Username/Password required |

**Debug Steps:**
```bash
# Localhost - Test connection directly
mongosh "mongodb://localhost:27017"

# Production - Check in Render logs
# Look for: "[DB] MongoDB Connected"
# Or error: "[DB] Connection error"
```

### 2. **CORS Origins**

| Aspect | Localhost | Production |
|--------|-----------|------------|
| Frontend URL | http://localhost:5173 | https://yourdomain.com |
| Backend URL | http://localhost:5000 | https://api.yourdomain.com (or Render URL) |
| Allowed Origins | Hardcoded in code | Env variable: `CORS_ALLOWED_ORIGINS` |
| Credentials | true | true (required) |

**Debug Steps:**
```javascript
// Browser Console
fetch('https://backend-url.com/api/health', {
  method: 'GET',
  credentials: 'include'
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Headers:', Object.fromEntries(r.headers));
  return r.json();
})
.then(d => console.log('Response:', d))
.catch(e => console.error('Error:', e.message));
```

### 3. **Environment Variables**

**Localhost (.env)**
```
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/taskmaster
JWT_SECRET=dev-secret-key
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
DEBUG=true
LOG_TO_CONSOLE=true
```

**Production (Render Dashboard)**
```
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/taskmaster
JWT_SECRET=production-secret-key
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://taskmaster.vercel.app
DEBUG=false
LOG_TO_CONSOLE=false
```

### 4. **Error Handling**

| Aspect | Localhost | Production |
|--------|-----------|------------|
| Error Stack | Shown to client | Hidden (security) |
| Logging | Console + File | File only |
| Request Logging | Verbose | Minimal |
| Debug Info | Detailed | Minimal |

---

## Debugging Strategies

### Local Debugging

**Enable Debug Mode:**
```bash
cd server
DEBUG=true npm run dev
```

**Check Logs:**
```bash
# Real-time logs
tail -f logs/app.log

# JSON parsing
cat logs/app.log | jq '.'

# Filter by level
cat logs/app.log | jq 'select(.level=="ERROR")'
```

**Test Endpoints:**
```bash
# Health check
curl http://localhost:5000/api/health

# With verbose output
curl -v http://localhost:5000/api/health

# With headers
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/auth/me
```

### Production Debugging

**Access Render Logs:**
1. Go to https://dashboard.render.com
2. Select your service
3. Click **Logs** tab
4. Watch real-time logs or search historical logs

**Search Render Logs:**
```
Search for keywords:
- "[STARTUP]" - Server start events
- "[ERROR]" - All errors
- "[LOGIN]" - Login attempts
- "[DB]" - Database events
- "Connection error" - Connection issues
```

**Manual Deploy & Debug:**
```
1. Go to Render Dashboard
2. Click your service
3. Click "Manual Deploy"
4. Watch logs during deployment
5. Check for: "Server running on port 5000"
```

### Common Issues & Solutions

#### Issue 1: Request Hangs in Production

**Symptoms:**
- Fetch request stuck in "pending" state
- No response after 30 seconds
- Works fine on localhost

**Debug Steps:**
```javascript
// 1. Test with timeout (browser console)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

fetch('https://api-url.com/api/health', { signal: controller.signal })
  .then(r => {
    clearTimeout(timeoutId);
    console.log('✓ Success:', r.status);
  })
  .catch(e => console.error('✗ Timeout:', e.message));

// 2. Check logs in Render for any errors
// 3. Check if service is actually running (green status)
// 4. Verify CORS_ALLOWED_ORIGINS includes your frontend URL
```

**Solutions:**
1. Restart service on Render
2. Check MongoDB connection is working
3. Verify environment variables are set correctly
4. Check service logs for startup errors

#### Issue 2: Login Returns 400 in Production Only

**Symptoms:**
- Login works on localhost
- Returns 400 in production
- Error message not clear

**Debug Steps:**
```javascript
// Browser console
const loginData = { login: 'user@email.com', password: 'password' };

fetch('https://api-url.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify(loginData)
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(d => console.log('Response:', JSON.stringify(d, null, 2)))
.catch(e => console.error('Error:', e.message));
```

**Solutions:**
1. Check user exists in production database
2. Check validation rules (email format, password length)
3. Review error logs in Render for detailed error message
4. Verify database connection is working

#### Issue 3: Cannot Connect to MongoDB in Production

**Symptoms:**
- Server starts but crashes immediately
- Or server starts but API returns errors
- Render logs show connection error

**Debug Steps:**
1. Go to Render Dashboard → Environment
2. Verify `MONGO_URI` is set correctly
3. Test MongoDB connection string:
   ```bash
   mongosh "your-mongo-uri-here"
   ```
4. Check MongoDB Atlas:
   - IP whitelist includes Render IP ranges
   - Database credentials are correct
   - Network access is enabled

**Solutions:**
1. Add Render IP to MongoDB Atlas whitelist (usually 0.0.0.0/0 or specific IPs)
2. Verify `MONGO_URI` format is correct
3. Check database password has no special characters (or properly URL encoded)
4. Restart service after changes

#### Issue 4: CORS Errors in Production

**Symptoms:**
- Browser console shows CORS error
- Preflight request (OPTIONS) fails
- Works on localhost

**Debug Steps:**
```javascript
// Check what origin is being sent
console.log('Current Origin:', window.location.origin);

// Try with explicit headers
fetch('https://api-url.com/api/health', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
.then(r => console.log('Status:', r.status))
```

**Solutions:**
1. Verify `CORS_ALLOWED_ORIGINS` includes your frontend domain
2. Check frontend is using correct API URL (https, not http)
3. Ensure CORS middleware is first in server.js
4. Check for typos in domain names

---

## Logging Best Practices

### What to Log

✅ **DO Log:**
- Application startup/shutdown
- Authentication attempts (success and failure)
- Database operations (connect, disconnect)
- API errors with full context
- Performance metrics (slow queries, timeouts)
- User actions (create, update, delete)

❌ **DON'T Log:**
- Passwords or sensitive tokens
- Full request/response bodies (PII)
- Credit card numbers
- API keys or secrets

### Using the Logger

```javascript
import { logger } from '../utils/logger.js';

// INFO level
logger.info('User logged in', 'AUTH', { userId: user.id });

// DEBUG level (only in dev mode)
logger.debug('Checking user password', 'AUTH', { userId: user.id });

// WARN level
logger.warn('Unusual activity detected', 'SECURITY', { userId: user.id, attempts: 5 });

// ERROR level
logger.error('Database connection failed', 'DB', error);

// CRITICAL level
logger.critical('Server cannot start', 'STARTUP', error);
```

### Viewing Logs

**Localhost:**
```bash
# Real-time
tail -f server/logs/app.log

# With JSON formatting
cat server/logs/app.log | jq '.' | less

# Filter by source
cat server/logs/app.log | jq 'select(.source=="AUTH")'

# Filter by level
cat server/logs/app.log | jq 'select(.level=="ERROR")'

# Last 20 errors
tail -20 server/logs/errors.log
```

**Production (Render):**
1. Go to Render Dashboard
2. Select service → **Logs** tab
3. Search for keywords: `ERROR`, `CRITICAL`, `[LOGIN]`, `[DB]`
4. Scroll through real-time logs

---

## Testing from Browser Console

### Health Check
```javascript
fetch('https://api-url.com/api/health')
  .then(r => r.json())
  .then(d => console.log(d));
```

### Login Test
```javascript
fetch('https://api-url.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    login: 'test@example.com',
    password: 'password'
  })
})
  .then(r => r.json())
  .then(d => console.log(d));
```

### Check Response Headers
```javascript
fetch('https://api-url.com/api/health')
  .then(r => {
    console.log('CORS Headers:');
    console.log('Access-Control-Allow-Origin:', r.headers.get('access-control-allow-origin'));
    console.log('Access-Control-Allow-Methods:', r.headers.get('access-control-allow-methods'));
    return r.json();
  })
  .then(d => console.log(d));
```

---

## Environment Checklist

### Before Deploying to Production

- [ ] `MONGO_URI` is set and correct
- [ ] `JWT_SECRET` is long and random
- [ ] `CORS_ALLOWED_ORIGINS` includes production domain
- [ ] `NODE_ENV=production`
- [ ] All environment variables are set in Render
- [ ] Database user has read/write permissions
- [ ] MongoDB Atlas IP whitelist is updated
- [ ] SSL certificate is valid (should be automatic on Render)
- [ ] Health check endpoint responds
- [ ] Test login with test account

### After Deploying to Production

- [ ] Check Render logs for startup errors
- [ ] Test health endpoint: `/api/health`
- [ ] Test login from production frontend
- [ ] Check browser console for CORS errors
- [ ] Check browser Network tab for 5xx errors
- [ ] Monitor Render logs for errors
- [ ] Test with fresh/incognito browser window

---

## Quick Reference

### Environment Variables by Stage

**Development**
```bash
NODE_ENV=development
DEBUG=true
LOG_TO_CONSOLE=true
```

**Production**
```bash
NODE_ENV=production
DEBUG=false
LOG_TO_CONSOLE=false
```

### Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request format, validation |
| 401 | Unauthorized | Check token, login |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Check URL, route exists |
| 409 | Conflict | Check for duplicates (email, username) |
| 500 | Server Error | Check logs, restart service |
| CORS Error | Origin not allowed | Check `CORS_ALLOWED_ORIGINS` |
| ECONNREFUSED | Cannot connect | Check service running, port correct |
| ENOTFOUND | Cannot resolve domain | Check DNS, domain name |

### Useful Commands

```bash
# Check service status (Render)
curl https://api-url.com/api/health

# View logs in real-time (local)
tail -f server/logs/app.log

# Filter errors (local)
grep "ERROR" server/logs/errors.log

# Format and view JSON logs (local)
cat server/logs/app.log | jq '.'

# Count log entries (local)
wc -l server/logs/app.log
```
