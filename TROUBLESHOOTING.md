# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Bulk Email Platform.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Application Startup Issues](#application-startup-issues)
- [Database Connection Issues](#database-connection-issues)
- [API Connection Issues](#api-connection-issues)
- [Authentication Issues](#authentication-issues)
- [Email Service Issues](#email-service-issues)
- [Payment Gateway Issues](#payment-gateway-issues)
- [Performance Issues](#performance-issues)
- [Security Monitoring Issues](#security-monitoring-issues)
- [Development Environment Issues](#development-environment-issues)
- [Production Deployment Issues](#production-deployment-issues)

## Quick Diagnostics

### Health Check Commands

Run these commands to quickly identify issues:

```bash
# Check environment configuration
npm run validate:env

# Test all backend connections
cd backend && node test-all-connections.js

# Check API health
curl http://localhost:8000/api/health

# Detailed health check
curl http://localhost:8000/api/health/detailed
```

### Log Locations

- **Backend logs**: `backend/logs/app.log`
- **Frontend logs**: Browser console
- **Admin logs**: Browser console
- **System logs**: Check your system's log directory

## Application Startup Issues

### Issue: "Port already in use"

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**
1. **Find and kill the process:**
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9
   ```

2. **Change the port:**
   ```bash
   # Frontend
   cd frontend && npm run dev -- --port 3001
   
   # Backend - update PORT in .env
   PORT=8001
   ```

### Issue: "Module not found"

**Error:**
```
Error: Cannot find module 'some-package'
```

**Solutions:**
1. **Reinstall dependencies:**
   ```bash
   npm run clean
   npm run install:all
   ```

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

3. **Delete node_modules and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Issue: "Environment variables not loaded"

**Error:**
```
Error: Environment variable not defined
```

**Solutions:**
1. **Check .env file exists:**
   ```bash
   ls -la frontend/.env backend/.env admin-frontend/.env
   ```

2. **Validate environment configuration:**
   ```bash
   npm run validate:env
   ```

3. **Recreate .env files:**
   ```bash
   npm run setup:env
   ```

## Database Connection Issues

### Issue: "Connection refused"

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**
1. **Check PostgreSQL is running:**
   ```bash
   # Windows
   sc query postgresql
   
   # macOS
   brew services list | grep postgresql
   
   # Linux
   systemctl status postgresql
   ```

2. **Start PostgreSQL:**
   ```bash
   # Windows
   net start postgresql
   
   # macOS
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   ```

3. **Verify connection details:**
   ```bash
   # Test connection manually
   psql -h localhost -p 5432 -U your_username -d bulk_email_platform
   ```

### Issue: "Authentication failed"

**Error:**
```
Error: password authentication failed for user "username"
```

**Solutions:**
1. **Check DATABASE_URL format:**
   ```bash
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   ```

2. **Reset PostgreSQL password:**
   ```sql
   ALTER USER your_username PASSWORD 'new_password';
   ```

3. **Check pg_hba.conf configuration:**
   - Ensure authentication method is set correctly
   - Restart PostgreSQL after changes

### Issue: "Database does not exist"

**Error:**
```
Error: database "bulk_email_platform" does not exist
```

**Solutions:**
1. **Create the database:**
   ```sql
   CREATE DATABASE bulk_email_platform;
   ```

2. **Run database setup script:**
   ```bash
   cd backend
   node create-database.js
   ```

## API Connection Issues

### Issue: "API not responding"

**Error:**
```
Error: Network Error / Connection refused
```

**Solutions:**
1. **Check backend is running:**
   ```bash
   curl http://localhost:8000/api/health
   ```

2. **Verify API URL configuration:**
   ```bash
   # Frontend .env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api
   ```

3. **Check CORS configuration:**
   ```bash
   # Backend .env
   CORS_ORIGIN=http://localhost:3000,http://localhost:3002
   ```

4. **Test with different endpoint:**
   ```bash
   curl -v http://localhost:8000/api/health
   ```

### Issue: "Circuit breaker is OPEN"

**Error:**
```
Error: Circuit breaker is OPEN. Recovery in 120s
```

**Solutions:**
1. **Wait for automatic recovery** (2 minutes by default)

2. **Check backend logs** for underlying issues

3. **Restart backend service:**
   ```bash
   cd backend && npm run dev
   ```

4. **Reset circuit breaker manually** (if implemented):
   ```bash
   curl -X POST http://localhost:8000/api/system/reset-circuit-breaker
   ```

### Issue: "Request timeout"

**Error:**
```
Error: Request timeout after 30000ms
```

**Solutions:**
1. **Check network connectivity**

2. **Increase timeout in API client:**
   ```javascript
   // In api-client.ts
   timeout: 60000 // 60 seconds
   ```

3. **Check backend performance:**
   ```bash
   curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/health
   ```

## Authentication Issues

### Issue: "Google OAuth not configured"

**Error:**
```
Error: Google OAuth is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

**Solutions:**
1. **Set Google Client ID:**
   ```bash
   # Frontend .env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
   
   # Backend .env
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

2. **Verify OAuth configuration in Google Console:**
   - Check authorized redirect URIs
   - Ensure OAuth consent screen is configured

3. **Test OAuth flow:**
   ```bash
   curl http://localhost:8000/api/auth/google
   ```

### Issue: "JWT token expired"

**Error:**
```
Error: Token expired
```

**Solutions:**
1. **Check token expiration settings:**
   ```bash
   # Backend .env
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   ```

2. **Implement token refresh** in frontend

3. **Clear stored tokens:**
   ```javascript
   localStorage.removeItem('accessToken');
   localStorage.removeItem('refreshToken');
   ```

### Issue: "Invalid JWT secret"

**Error:**
```
Error: Invalid signature
```

**Solutions:**
1. **Verify JWT secrets match:**
   ```bash
   # Backend .env
   JWT_SECRET=your-secret-key
   JWT_REFRESH_SECRET=your-refresh-secret-key
   ```

2. **Generate new secrets:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Email Service Issues

### Issue: "SendGrid API error"

**Error:**
```
Error: Unauthorized - API key invalid
```

**Solutions:**
1. **Verify SendGrid API key:**
   ```bash
   # Backend .env
   SENDGRID_API_KEY=SG.your-api-key
   ```

2. **Test API key:**
   ```bash
   curl -X GET "https://api.sendgrid.com/v3/user/profile" \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **Check SendGrid account status**

### Issue: "Email delivery failed"

**Error:**
```
Error: Email could not be delivered
```

**Solutions:**
1. **Check email service configuration:**
   ```bash
   # Backend .env
   PRIMARY_EMAIL_PROVIDER=sendgrid
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   ```

2. **Verify sender email is authorized**

3. **Check email service logs**

4. **Test with different email provider:**
   ```bash
   PRIMARY_EMAIL_PROVIDER=amazon-ses
   ```

## Payment Gateway Issues

### Issue: "Stripe key not configured"

**Error:**
```
Error: No API key provided
```

**Solutions:**
1. **Set Stripe keys:**
   ```bash
   # Backend .env
   STRIPE_SECRET_KEY=sk_test_your_test_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

2. **Use correct key format:**
   - Test keys: `sk_test_...`
   - Live keys: `sk_live_...`

3. **Verify key in Stripe dashboard**

### Issue: "Payment webhook failed"

**Error:**
```
Error: Webhook signature verification failed
```

**Solutions:**
1. **Check webhook secret:**
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

2. **Verify webhook endpoint URL** in Stripe dashboard

3. **Test webhook locally:**
   ```bash
   stripe listen --forward-to localhost:8000/api/payments/stripe/webhook
   ```

## Performance Issues

### Issue: "Slow API responses"

**Symptoms:**
- API calls taking > 5 seconds
- Frontend loading slowly
- Timeouts occurring

**Solutions:**
1. **Check database performance:**
   ```sql
   -- Check slow queries
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

2. **Enable Redis caching:**
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

3. **Optimize database queries:**
   - Add indexes for frequently queried columns
   - Use connection pooling

4. **Monitor resource usage:**
   ```bash
   # Check CPU and memory usage
   top
   htop
   ```

### Issue: "Memory leaks"

**Symptoms:**
- Increasing memory usage over time
- Application crashes with "out of memory"

**Solutions:**
1. **Monitor memory usage:**
   ```bash
   # Node.js memory usage
   node --inspect backend/src/index.js
   ```

2. **Increase memory limit:**
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096
   ```

3. **Check for memory leaks:**
   - Use Chrome DevTools
   - Monitor event listeners
   - Check for unclosed database connections

## Security Monitoring Issues

### Issue: "Security monitoring not working"

**Error:**
```
Error: Security monitoring service failed to initialize
```

**Solutions:**
1. **Check security monitoring configuration:**
   ```bash
   # Backend .env
   ENABLE_THREAT_DETECTION=true
   SECURITY_ALERT_EMAIL=security@yourdomain.com
   ```

2. **Verify database tables exist:**
   ```bash
   cd backend
   node run-security-migration.js
   ```

3. **Check security monitoring logs:**
   ```bash
   tail -f backend/logs/security.log
   ```

### Issue: "Threat detection false positives"

**Symptoms:**
- Too many security alerts
- Legitimate users being blocked

**Solutions:**
1. **Adjust threat detection thresholds:**
   ```bash
   FAILED_LOGIN_THRESHOLD=10
   SUSPICIOUS_ACTIVITY_THRESHOLD=20
   ```

2. **Whitelist trusted IPs:**
   ```javascript
   // In threat-detection.service.ts
   const trustedIPs = ['192.168.1.0/24'];
   ```

3. **Review security logs** for patterns

## Development Environment Issues

### Issue: "Hot reload not working"

**Symptoms:**
- Changes not reflected in browser
- Need to manually refresh

**Solutions:**
1. **Check file watchers:**
   ```bash
   # Increase file watcher limit (Linux)
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

2. **Restart development server:**
   ```bash
   npm run dev
   ```

3. **Clear browser cache**

### Issue: "TypeScript compilation errors"

**Error:**
```
Error: Type 'string' is not assignable to type 'number'
```

**Solutions:**
1. **Check TypeScript configuration:**
   ```bash
   npx tsc --noEmit
   ```

2. **Update type definitions:**
   ```bash
   npm install @types/node @types/react --save-dev
   ```

3. **Fix type errors** in code

## Production Deployment Issues

### Issue: "Build failures"

**Error:**
```
Error: Build failed with exit code 1
```

**Solutions:**
1. **Check build logs** for specific errors

2. **Verify environment variables** are set

3. **Test build locally:**
   ```bash
   npm run build
   ```

4. **Check for missing dependencies:**
   ```bash
   npm audit
   npm install
   ```

### Issue: "SSL/TLS certificate errors"

**Error:**
```
Error: certificate verify failed
```

**Solutions:**
1. **Check certificate configuration:**
   ```bash
   # Backend .env
   TLS_CERT_PATH=/path/to/cert.pem
   TLS_KEY_PATH=/path/to/key.pem
   ```

2. **Verify certificate validity:**
   ```bash
   openssl x509 -in cert.pem -text -noout
   ```

3. **Use Let's Encrypt** for free certificates:
   ```bash
   certbot --nginx -d yourdomain.com
   ```

### Issue: "Database migration failures"

**Error:**
```
Error: Migration failed
```

**Solutions:**
1. **Check migration scripts:**
   ```bash
   cd backend
   ls migrations/
   ```

2. **Run migrations manually:**
   ```bash
   node run-migrations.js
   ```

3. **Check database permissions**

4. **Backup database** before retrying

## Getting Help

If you're still experiencing issues:

1. **Check the logs** for detailed error messages
2. **Run diagnostic scripts** provided in the repository
3. **Search existing issues** in the project repository
4. **Create a detailed bug report** with:
   - Error messages
   - Steps to reproduce
   - Environment details
   - Log files

## Useful Commands

### Diagnostic Commands
```bash
# Environment validation
npm run validate:env

# Connection testing
cd backend && node test-all-connections.js

# API testing
cd backend && node test-api-simple.js

# Health checks
curl http://localhost:8000/api/health/detailed
```

### Reset Commands
```bash
# Reset environment
npm run setup:env

# Clean install
npm run clean && npm run install:all

# Reset database
cd backend && node reset-database.js

# Clear caches
npm cache clean --force
```

### Log Commands
```bash
# View backend logs
tail -f backend/logs/app.log

# View security logs
tail -f backend/logs/security.log

# View all logs
tail -f backend/logs/*.log
```