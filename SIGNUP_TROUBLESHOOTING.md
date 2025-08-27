# Signup Issue Troubleshooting Guide

## Quick Fix Steps

### 1. Start the Backend Server
The most common issue is that the backend server is not running.

```bash
# Option A: Use the helper script
node start-backend.js

# Option B: Manual start
cd backend
npm install
npm run dev
```

Wait for this message: `🚀 Backend server running on port 3001`

### 2. Start the Frontend Server
In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Wait for: `Ready on http://localhost:3000`

### 3. Test the Signup
1. Open http://localhost:3000/auth/register
2. Fill in the form with test data
3. Click "Create Account"

## Common Issues and Solutions

### Issue 1: "Cannot connect to server" Error
**Symptoms:** Frontend shows connection error, registration fails immediately

**Solutions:**
1. Check if backend is running: `node check-backend-status.js`
2. Verify backend is on port 3001: http://localhost:3001/health
3. Check for port conflicts: `npx kill-port 3001`
4. Restart backend server

### Issue 2: Database Connection Errors
**Symptoms:** Backend starts but shows database errors in logs

**Solutions:**
1. Check `DATABASE_URL` in `backend/.env`
2. Verify database is accessible
3. Enable demo mode: Add `DEMO_MODE=true` to `backend/.env`
4. Restart backend after changes

### Issue 3: Email Service Errors
**Symptoms:** Registration works but shows email-related errors

**Solutions:**
1. Add to `backend/.env`:
   ```
   DEMO_MODE=true
   DISABLE_EMAIL_SENDING=true
   ```
2. Comment out AWS credentials in `.env`
3. Restart backend

### Issue 4: Redis Connection Errors
**Symptoms:** Backend shows Redis connection failures

**Solutions:**
1. Check `REDIS_URL` in `backend/.env`
2. Add to `backend/.env`: `DEMO_MODE=true`
3. Redis is optional in demo mode

### Issue 5: Frontend API Configuration
**Symptoms:** Frontend makes requests to wrong URL

**Solutions:**
1. Check `frontend/.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001/api
   ```
2. Restart frontend after changes

## Environment Configuration

### Required Backend Environment Variables
Create/update `backend/.env`:

```env
# Basic Configuration
PORT=3001
NODE_ENV=development
DEMO_MODE=true

# JWT Configuration
JWT_SECRET=dev-super-secret-jwt-key-for-development-only
JWT_REFRESH_SECRET=dev-super-secret-refresh-key-for-development-only

# Database (can be disabled with DEMO_MODE=true)
DATABASE_URL=your-database-url

# Redis (optional in demo mode)
REDIS_URL=your-redis-url

# Email (disabled in demo mode)
DISABLE_EMAIL_SENDING=true
PRIMARY_EMAIL_PROVIDER=mock

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3002
```

### Required Frontend Environment Variables
Create/update `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Testing Commands

### Test Backend Health
```bash
node check-backend-status.js
```

### Test Registration Endpoint
```bash
node test-signup-issue.js
```

### Debug Startup Issues
```bash
node debug-startup.js
```

## Demo Mode Benefits

Setting `DEMO_MODE=true` in `backend/.env` provides:
- ✅ No database required
- ✅ No Redis required  
- ✅ No email service required
- ✅ Simplified authentication
- ✅ Mock data for testing

Perfect for development and testing!

## Step-by-Step Startup Process

1. **Check Prerequisites**
   ```bash
   node --version  # Should be 16+
   npm --version   # Should be 8+
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   # Ensure .env file exists with DEMO_MODE=true
   npm run dev
   ```

3. **Setup Frontend** (in new terminal)
   ```bash
   cd frontend
   npm install
   # Ensure .env.local exists with correct API_URL
   npm run dev
   ```

4. **Test Everything**
   ```bash
   node check-backend-status.js
   # Open http://localhost:3000/auth/register
   ```

## Getting Help

If you're still having issues:

1. Check both terminal outputs for error messages
2. Run the diagnostic scripts provided
3. Ensure all environment variables are set correctly
4. Try demo mode first before configuring external services

The most important thing is getting both servers running first!