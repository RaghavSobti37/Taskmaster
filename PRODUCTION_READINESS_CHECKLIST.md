# Production Readiness Checklist

## Pre-Deployment Verification

### Backend Configuration
- [ ] All environment variables are set in Render dashboard
- [ ] `MONGO_URI` points to production MongoDB Atlas cluster
- [ ] `JWT_SECRET` is long, random, and secure (not default)
- [ ] `NODE_ENV=production`
- [ ] `CORS_ALLOWED_ORIGINS` includes production frontend domains
- [ ] Database user has minimal required permissions (not admin)
- [ ] MongoDB IP whitelist includes Render service IP ranges

### Database Preparation
- [ ] MongoDB Atlas cluster is accessible
- [ ] Database authentication credentials are correct
- [ ] Backup of production data exists
- [ ] Database indexes are created for frequently queried fields
- [ ] Data validation rules are enforced at database level

### Frontend Configuration
- [ ] `.env.production` has correct API URL (https)
- [ ] API URL points to production backend (Render URL)
- [ ] JWT token storage is secure (localStorage or secure cookie)
- [ ] No console.log statements with sensitive data
- [ ] CORS credentials are sent (credentials: 'include')

### Server Code
- [ ] All error handling is in place
- [ ] Logging is not too verbose (DEBUG=false in production)
- [ ] No hardcoded credentials in code
- [ ] HTTPS/TLS is enforced (automatic on Render)
- [ ] Input validation on all endpoints
- [ ] Rate limiting not configured (optional but recommended)

### Security
- [ ] CORS is properly configured
- [ ] JWT expiration is set (default: 24 hours)
- [ ] Password hashing uses bcrypt
- [ ] Sensitive data is not logged
- [ ] SQL injection prevention (using mongoose)
- [ ] XSS prevention (using helmet recommended)

### Testing & Validation
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Health endpoint responds
- [ ] Login flow tested in production
- [ ] Registration flow tested in production
- [ ] Error handling tested
- [ ] CORS configuration tested
- [ ] Performance benchmarks acceptable

### Monitoring & Logging
- [ ] Error logging is configured
- [ ] Access logs are being written
- [ ] Log rotation is setup (prevent disk full)
- [ ] Critical errors generate alerts
- [ ] Performance metrics are tracked
- [ ] Monitoring dashboard is setup

### Documentation
- [ ] README updated with production setup
- [ ] Environment variables documented
- [ ] Known issues documented
- [ ] Deployment procedure documented
- [ ] Rollback procedure documented
- [ ] Team has access to logs and dashboards

## Deployment Steps

### 1. Code Preparation
```bash
# Ensure all changes are committed
git status

# Pull latest from main
git pull origin main

# Run tests one final time
npm test

# Check for any linting issues
npm run lint  # if configured
```

### 2. Environment Variable Setup (Render Dashboard)

```
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/taskmaster
JWT_SECRET=<long-random-secret-key>
CORS_ALLOWED_ORIGINS=https://yourfrontend.com,https://app.yourfrontend.com
DEBUG=false
LOG_TO_CONSOLE=false
```

### 3. Manual Deploy

1. Go to https://dashboard.render.com
2. Select your service
3. Click **Manual Deploy**
4. Select branch: `main`
5. Click **Deploy**
6. Monitor logs for startup messages

### 4. Post-Deployment Testing

#### Health Check
```bash
curl https://your-api-url.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-15T...",
  "environment": "production",
  "corsOrigins": ["https://yourfrontend.com"],
  "uptime": 123.456
}
```

#### Test Login from Browser
1. Go to production frontend: https://yourfrontend.com
2. Open DevTools → Console
3. Test login:
```javascript
fetch('https://your-api-url.onrender.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    login: 'test@example.com',
    password: 'yourpassword'
  })
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(d => console.log('Response:', d))
.catch(e => console.error('Error:', e.message));
```

#### Check Render Logs
1. Go to Render Dashboard
2. Select service → **Logs** tab
3. Look for:
   - ✅ `[STARTUP] Server running on port 5000`
   - ✅ `[DB] MongoDB Connected`
   - ❌ `[ERROR]` or `[CRITICAL]` messages
   - ❌ `Connection error` or `failed`

#### Monitor for 24 Hours
- Check logs regularly for errors
- Test all major features (login, create task, etc.)
- Monitor performance metrics
- Check error rate remains low

## Rollback Procedure

If something goes wrong:

### Quick Rollback (Last Known Good Commit)
1. Go to Render Dashboard
2. Click **Deployments** tab
3. Find previous successful deployment
4. Click **Redeploy** button

### Manual Rollback
```bash
# Check git history
git log --oneline

# Revert to previous commit
git revert <commit-hash>
git push origin main

# Redeploy
# (Manual Deploy on Render Dashboard)
```

### Database Rollback
If database is affected:
1. Go to MongoDB Atlas
2. Check available backups
3. Contact MongoDB support if needed
4. Only restore if absolutely necessary

## Post-Deployment Monitoring

### Daily Checks
- [ ] System is responding (health check)
- [ ] Login works
- [ ] No errors in logs
- [ ] Performance is acceptable

### Weekly Checks
- [ ] Review error logs for patterns
- [ ] Check database size and cleanup if needed
- [ ] Verify backups are working
- [ ] Review user activity logs

### Monthly Checks
- [ ] Test disaster recovery procedures
- [ ] Review and update security settings
- [ ] Optimize slow queries if any
- [ ] Update dependencies (if safe)

## Common Production Issues

### Issue: Service Won't Start
**Symptoms:** Red status on Render Dashboard

**Check:**
1. Review startup logs for errors
2. Verify all environment variables are set
3. Check MongoDB connection string
4. Test connectivity to MongoDB Atlas

**Fix:**
```bash
# Manual deploy
# Render Dashboard → Manual Deploy → Deploy
```

### Issue: Requests Timing Out
**Symptoms:** Frontend requests hang for 30+ seconds

**Check:**
1. Health endpoint responds: `curl https://api.com/api/health`
2. Check Render service status (should be green)
3. Check MongoDB connection

**Fix:**
1. Restart service (Manual Deploy)
2. Check MongoDB IP whitelist includes 0.0.0.0/0
3. Check for slow database queries in logs

### Issue: CORS Errors in Browser
**Symptoms:** Browser console CORS error, preflight fails

**Check:**
1. Frontend domain is in `CORS_ALLOWED_ORIGINS`
2. Request uses correct protocol (https not http)
3. Preflight request is returning 200

**Fix:**
1. Update `CORS_ALLOWED_ORIGINS` in Render
2. Manually deploy to apply changes
3. Clear browser cache and try again

### Issue: Login Returns 401 (Unauthorized)
**Symptoms:** Valid credentials fail to login

**Check:**
1. User exists in production database
2. Password is correct
3. Database has proper indexes

**Fix:**
1. Check user exists: `db.users.findOne({email: 'test@example.com'})`
2. Verify password hash is valid
3. Check JWT_SECRET is the same

### Issue: Database Connection Drops
**Symptoms:** Random errors, inconsistent behavior

**Check:**
1. MongoDB Atlas cluster is running
2. Connection string is correct
3. IP whitelist allows Render

**Fix:**
1. Check MongoDB Atlas dashboard
2. Verify connection pool settings
3. Increase connection timeout in code

## Security Hardening

### Before Going Live
- [ ] Remove all console.log debugging statements
- [ ] Ensure HTTPS is enabled (automatic on Render)
- [ ] Set secure cookie flags if using cookies
- [ ] Implement rate limiting on auth endpoints
- [ ] Add helmet.js for security headers
- [ ] Validate and sanitize all inputs
- [ ] Implement CSRF protection if needed
- [ ] Setup firewall rules if available
- [ ] Enable request logging for audit trail
- [ ] Secure sensitive credentials

### Ongoing Security
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Monitor for suspicious activity
- [ ] Regular penetration testing
- [ ] Incident response plan
- [ ] Data privacy compliance (GDPR, etc.)

## Performance Optimization

### Database
- [ ] Indexes on frequently queried fields
- [ ] Connection pooling configured
- [ ] Query optimization (avoid N+1)
- [ ] Regular data cleanup/archival

### Backend
- [ ] Compression enabled (gzip)
- [ ] Caching implemented where appropriate
- [ ] Efficient error handling (no unnecessary logging)
- [ ] Async operations where possible

### Frontend
- [ ] Code splitting implemented
- [ ] Assets minified and bundled
- [ ] Images optimized
- [ ] Lazy loading for routes

## Success Metrics

- [ ] Health check responds in < 100ms
- [ ] Login completes in < 2 seconds
- [ ] Error rate < 0.1%
- [ ] Uptime > 99.5%
- [ ] P95 response time < 500ms
- [ ] No critical errors in logs
- [ ] Database queries < 100ms average
- [ ] CPU usage < 60%
- [ ] Memory usage stable
- [ ] Zero security incidents

## Contacts & Escalation

- **DevOps/Infrastructure**: [Contact info]
- **Database Admin**: [Contact info]
- **Security Team**: [Contact info]
- **On-Call Support**: [Contact info]
- **Emergency Hotline**: [Contact info]

## Sign-Off

- [ ] Development Lead: _____________ Date: _______
- [ ] QA Lead: _____________ Date: _______
- [ ] DevOps/Infra: _____________ Date: _______
- [ ] Product Owner: _____________ Date: _______

---

**Deployment Date**: ________________
**Deployed By**: ________________
**Approval**: ________________
