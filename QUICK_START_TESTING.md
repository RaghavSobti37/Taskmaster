# Quick Start: Local Development & Testing

## Development Setup

### 1. Install Dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Setup

**Server (.env)**
```bash
cd server
cat > .env << EOF
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/taskmaster
JWT_SECRET=dev-secret-key
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
DEBUG=true
LOG_TO_CONSOLE=true
EOF
```

**Client (.env)**
```bash
cd client
cat > .env << EOF
VITE_API_URL=http://localhost:5000
EOF
```

### 3. Start MongoDB (Local)

**Option 1: Using Docker**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option 2: Using Installed MongoDB**
```bash
# Linux/Mac
mongod

# Windows (if installed)
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
```

**Verify Connection:**
```bash
mongosh "mongodb://localhost:27017"
# You should see a successful connection
```

### 4. Start Development Servers

**Terminal 1: Backend**
```bash
cd server
npm run dev
# You should see: "✓ Server is running" message
```

**Terminal 2: Frontend**
```bash
cd client
npm run dev
# You should see: "Local: http://localhost:5173"
```

### 5. Verify Everything Works

**Check Backend:**
```bash
curl http://localhost:5000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Check Frontend:**
Open http://localhost:5173 in your browser

---

## Running Tests

### Run All Tests
```bash
cd server
npm test
```

### Run Tests in Watch Mode
```bash
cd server
npm run test:watch
```

### Run Specific Test File
```bash
cd server
npm test -- tests/unit/logger.test.js
```

### Run with Coverage
```bash
cd server
npm run test:coverage
```

### Run E2E Tests Only
```bash
cd server
npm run test:e2e
```

### Debug Tests
```bash
cd server
npm run test:debug
```

---

## Debugging Locally

### Enable Debug Logging

**Option 1: Environment Variable**
```bash
# In server/.env
DEBUG=true
```

**Option 2: Command Line**
```bash
DEBUG=true npm run dev
```

### View Logs Real-Time
```bash
# In another terminal
tail -f server/logs/app.log
```

### View Errors Only
```bash
tail -f server/logs/errors.log
```

### View Debug Logs
```bash
tail -f server/logs/debug.log
```

### Pretty-Print JSON Logs
```bash
# One dump
cat server/logs/app.log | jq '.'

# Follow in real-time
tail -f server/logs/app.log | jq '.'
```

### Filter Logs by Level
```bash
# Errors only
cat server/logs/app.log | jq 'select(.level=="ERROR")'

# Info only
cat server/logs/app.log | jq 'select(.level=="INFO")'

# Specific source
cat server/logs/app.log | jq 'select(.source=="AUTH")'
```

---

## Common Development Tasks

### Test an Endpoint with cURL

**Health Check**
```bash
curl http://localhost:5000/api/health
```

**Login**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "login": "test@example.com",
    "password": "password"
  }'
```

**Register**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**With Authentication**
```bash
# Get token from login first
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"test@example.com","password":"password"}' | jq -r '.token')

# Use token
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/auth/me
```

### Test from Browser Console

```javascript
// Health check
fetch('http://localhost:5000/api/health')
  .then(r => r.json())
  .then(d => console.log(d));

// Login
fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    login: 'test@example.com',
    password: 'password'
  })
})
.then(r => r.json())
.then(d => {
  console.log('Token:', d.token);
  localStorage.setItem('token', d.token);
});

// Get current user
const token = localStorage.getItem('token');
fetch('http://localhost:5000/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(d => console.log('User:', d));
```

### Create Test Data

**Option 1: Use Seeder**
```bash
cd server
npm run data:import
```

**Option 2: Register via Frontend**
1. Go to http://localhost:5173
2. Click Register
3. Create test account

**Option 3: Direct MongoDB**
```bash
mongosh "mongodb://localhost:27017/taskmaster"

# Create user
db.users.insertOne({
  username: "testuser",
  email: "test@example.com",
  password: "$2a$10$...", // bcrypt hash of "password123"
  role: "user",
  createdAt: new Date()
})
```

---

## Troubleshooting

### MongoDB Connection Failed

**Error:** `ECONNREFUSED localhost:27017`

**Solution:**
```bash
# Check if MongoDB is running
mongosh

# If not, start it
# Option 1: Using Docker
docker start mongodb

# Option 2: Using installed MongoDB
mongod
```

### Port Already in Use

**Error:** `EADDRINUSE :::5000`

**Solution:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=5001 npm run dev
```

### Tests Failing

**Error:** Tests failing locally but passing in CI

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Jest cache
npm test -- --clearCache

# Run tests again
npm test
```

### CORS Error in Browser

**Error:** `Access-Control-Allow-Origin` missing

**Check:**
1. Backend is running
2. Frontend is on http://localhost:5173
3. Backend CORS includes localhost:5173
4. Check server logs for CORS info

```bash
# See CORS debug info
tail -f server/logs/app.log | jq 'select(.source=="CORS")'
```

### Changes Not Reflecting

**Issue:** Code changes not showing up

**Solution:**
```bash
# Server: Nodemon should auto-restart
# Make sure nodemon is running

# Frontend (Vite): Should auto-reload
# If not, try:
# 1. Refresh browser (Cmd/Ctrl + Shift + R)
# 2. Clear browser cache
# 3. Restart Vite: npm run dev
```

---

## Code Quality

### Check Code Style
```bash
cd server
npm run lint  # if configured
```

### Format Code
```bash
cd server
npm run format  # if configured
```

### Run All Checks
```bash
cd server
npm test && npm run lint  # if lint is configured
```

---

## Performance Profiling

### Check Memory Usage
```bash
# In Node.js server logs or:
node --inspect server.js

# Then visit chrome://inspect
```

### Database Query Performance
```bash
# Enable query logging in MongoDB
mongosh

# In the db:
db.setProfilingLevel(1)
db.system.profile.find().pretty()
```

### API Request Timing
```javascript
// Browser console
const start = performance.now();
fetch('http://localhost:5000/api/health')
  .then(() => {
    console.log('Time taken:', performance.now() - start, 'ms');
  });
```

---

## Git Workflow

### Before CommitOkting

```bash
# Check status
git status

# Stage changes
git add .

# Run tests
npm test

# Commit
git commit -m "Fix: issue description"

# Push
git push origin feature-branch
```

### Create Pull Request

1. Go to GitHub
2. Click "New Pull Request"
3. Select feature branch
4. Describe changes
5. Set reviewers
6. Submit

### Code Review

1. Address feedback
2. Update branch
3. Run tests
4. Mark resolved
5. Merge when approved

---

## Useful Commands Summary

```bash
# Server Development
npm run dev                # Start with nodemon
npm test                   # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
npm run data:import       # Load seed data
tail -f logs/app.log      # View logs

# Client Development
npm run dev               # Start dev server
npm run build            # Build for production
npm run preview          # Preview build
npm run lint             # Check for errors

# Database
mongosh                  # Connect to local MongoDB
mongo --version          # Check version
```

---

## Need Help?

1. **Check Logs**: `tail -f server/logs/app.log`
2. **Read Documentation**: [PRODUCTION_VS_LOCALHOST_DEBUG.md](PRODUCTION_VS_LOCALHOST_DEBUG.md)
3. **Check Tests**: `npm test` to ensure setup is correct
4. **Ask Team**: Share logs and error messages

---

## Next Steps

1. ✅ Setup complete
2. 🧪 Run tests to verify
3. 🚀 Start development
4. 📝 Check [TESTING_GUIDE.md](TESTING_GUIDE.md) for more
5. 🔍 Review [PRODUCTION_VS_LOCALHOST_DEBUG.md](PRODUCTION_VS_LOCALHOST_DEBUG.md) for debugging
