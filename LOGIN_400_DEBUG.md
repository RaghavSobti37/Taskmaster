# LOGIN 400 BAD REQUEST - DEBUGGING

## 🟢 Status: Backend IS Alive!

Health endpoint ✅ Working:
```
{status: 'ok', timestamp: '2026-03-30T10:15:29.768Z', corsOrigins: Array(4)}
```

## 🔴 Issue: Login Returns 400 Bad Request

400 means the server received the request but it's malformed or invalid.

---

## 🔧 Debug Steps

### Step 1: Check What's Being Sent to Login

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Reload the page
4. Go to **https://tsccoreknot.com/login**
5. Try to login
6. Look for request to: `api/auth/login`
7. Click on that request
8. Go to **"Request"** tab
9. Scroll down to **"Request Body"**
10. Screenshot that - what fields are being sent?

**Expected to see:**
```json
{
  "login": "email@example.com",
  "password": "yourpassword"
}
```

### Step 2: Check What Error Backend is Returning

Same request in DevTools:
1. Click the login request
2. Go to **"Response"** tab
3. What does it show? (Screenshot)

**Expected response might be:**
```json
{
  "message": "Invalid credentials"
}
```

or

```json
{
  "message": "Email or Username is required",
  "errors": [...]
}
```

### Step 3: Test Login Manually in Console

Run this in browser console to see exact error:

```javascript
// Manually test login
fetch('https://taskmaster-jfw0.onrender.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    login: 'raghavishaan@gmail.com',  // Try with your actual email
    password: 'yourpassword'           // Try with your actual password
  })
})
  .then(r => r.json())
  .then(d => console.log('Response:', d))
  .catch(e => console.error('Error:', e))
```

This will show the exact error message from backend.

---

## 🚨 Common 400 Errors & Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Invalid credentials" | Email/username not found OR password wrong | Register new account first OR check password |
| "Email or Username is required" | `login` field empty | Enter email/username |
| "Password is required" | `password` field empty | Enter password |
| "Email/username and password are required" | Both fields missing | Enter credentials |

---

## 📋 What to Try

### Option 1: Register New Account First
If you haven't registered yet:
1. Go to **https://tsccoreknot.com/register**
2. Create account:
   - Username: `testuser123`
   - Email: `test@example.com`
   - Password: `Test@12345`
3. Click **Register**
4. Should redirect to dashboard
5. Then try **Login** with same credentials

### Option 2: Check if User Exists
If you already have an account, verify:
1. You're using correct email/username
2. You're using correct password
3. No extra spaces before/after

### Option 3: Check Database Directly
If you have MongoDB Atlas access:
1. Go to https://cloud.mongodb.com
2. Find your cluster
3. Click **Browse Collections**
4. Look in: `taskmaster` → `users` collection
5. Do you see any users? Or is collection empty?

---

## 🔍 Real-Time Debugging

**In the browser console, add this before trying to login:**

```javascript
// Intercept axios requests to see what's being sent
const originalFetch = fetch;
window.fetch = function(...args) {
  console.log('🔵 Fetch URL:', args[0]);
  console.log('🔵 Fetch Options:', args[1]);
  if (args[1]?.body) {
    console.log('🔵 Request Body:', JSON.parse(args[1].body));
  }
  return originalFetch.apply(this, args);
};
```

Then try logging in. You'll see exactly what's being sent!

---

## 🎯 Next Steps

1. **Screenshot the Network tab request** showing:
   - URL
   - Request body (what fields/values)
   - Response body (error message)

2. **Run the manual fetch test** above and share the response

3. **Check if you have an account** - might need to register first

Tell me what you find and I can pinpoint the exact issue! 🔍
