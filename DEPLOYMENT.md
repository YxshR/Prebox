# Deployment Guide

This project is a monorepo with multiple applications. Each application needs to be deployed separately on Vercel.

## Applications

1. **Frontend (User Dashboard)** - `frontend/` directory
2. **Admin Frontend (Admin Panel)** - `admin-frontend/` directory
3. **Backend (API)** - `backend/` directory (deploy on a different platform like Railway, Render, or AWS)

## Vercel Deployment Steps

### 1. Deploy Frontend (User Dashboard)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your repository
4. **Important**: Set the root directory to `frontend`
5. Framework Preset: Next.js
6. Build Command: `npm run build`
7. Install Command: `npm install --legacy-peer-deps`
8. Output Directory: `.next` (default)
9. Node.js Version: 18.x

### 2. Deploy Admin Frontend (Admin Panel)

1. Create another project on Vercel
2. Import the same repository
3. **Important**: Set the root directory to `admin-frontend`
4. Framework Preset: Next.js
5. Build Command: `npm run build`
6. Install Command: `npm install --legacy-peer-deps`
7. Output Directory: `.next` (default)
8. Node.js Version: 18.x

### 3. Environment Variables

For each deployment, add these environment variables in Vercel:

#### Frontend Environment Variables:
```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_APP_ENV=production
NODE_ENV=production
```

#### Admin Frontend Environment Variables:
```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_APP_ENV=production
NODE_ENV=production
```

### 4. Backend Deployment

The backend should be deployed on a platform that supports Node.js servers:

**Recommended Platforms:**
- Railway (easiest)
- Render
- AWS Elastic Beanstalk
- Google Cloud Run
- DigitalOcean App Platform

**Backend Environment Variables:**
```
NODE_ENV=production
DATABASE_URL=your-postgresql-connection-string
REDIS_URL=your-redis-connection-string
JWT_SECRET=your-jwt-secret
EMAIL_SERVICE_API_KEY=your-email-service-key
STRIPE_SECRET_KEY=your-stripe-secret-key
```

## Troubleshooting Common Issues

### 1. Build Failures

If you get build errors:
- Make sure you're setting the correct root directory
- Check that all dependencies are properly installed
- Verify TypeScript configuration

### 2. Dependency Issues

If you get dependency resolution errors:
- Use `--legacy-peer-deps` flag in install command
- Make sure shared packages are built before the main app

### 3. Environment Variables

- Double-check all environment variables are set
- Make sure API URLs don't have trailing slashes
- Verify database and Redis connections

### 4. Monorepo Issues

- Each app must be deployed as a separate Vercel project
- Set the correct root directory for each deployment
- Don't try to deploy the entire monorepo as one project

## Custom Domains

After successful deployment:
1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Configure DNS records as instructed

## Performance Optimization

The Next.js configurations include:
- Image optimization
- Bundle splitting
- Compression
- Security headers
- Performance monitoring

## Monitoring

Set up monitoring for:
- Application performance
- Error tracking
- Uptime monitoring
- Database performance

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test locally first
4. Check database connections
5. Review API endpoints