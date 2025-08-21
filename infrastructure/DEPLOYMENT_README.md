# Home Page Redesign Production Deployment Guide

This guide covers the complete deployment of the enhanced home page redesign with security features, CDN optimization, and monitoring systems.

## Overview

The deployment includes:

- **Enhanced Security Features**: Per-user JWT secrets, enhanced OTP system, pricing protection
- **CDN Infrastructure**: CloudFront CDN with media optimization
- **Monitoring & Alerting**: Security monitoring, performance dashboards, automated alerts
- **Database Migrations**: Security-focused database schema updates
- **Application Updates**: Phone-only auth, multimedia showcase, animated pricing

## Prerequisites

Before starting the deployment, ensure you have:

### Required Tools
- `kubectl` - Kubernetes command-line tool
- `aws` - AWS CLI configured with appropriate credentials
- `docker` - Docker for container operations
- `bash` - For running deployment scripts (Linux/Mac/WSL)

### Infrastructure Requirements
- Production Kubernetes cluster (EKS, GKE, or AKS)
- AWS account with S3 and CloudFront permissions
- Domain names registered and ready for DNS configuration
- SSL certificates for your domains

### Access Requirements
- Kubernetes cluster admin access
- AWS IAM permissions for S3, CloudFront, and SES
- Access to update DNS records for your domains

## Deployment Steps

### 1. Pre-Deployment Preparation

#### Update Environment Variables
```bash
# Copy and customize environment files
cp infrastructure/production.env.example infrastructure/production.env
cp infrastructure/frontend-production.env.example infrastructure/frontend-production.env

# Edit the files with your actual values
nano infrastructure/production.env
nano infrastructure/frontend-production.env
```

#### Update Kubernetes Secrets
```bash
# Copy and customize secrets template
cp infrastructure/kubernetes/production/secrets.yml secrets-production.yml

# Add your base64-encoded secret values
nano secrets-production.yml
```

#### Configure Domain Names
Update the following files with your actual domain names:
- `infrastructure/kubernetes/production/configmaps.yml`
- `infrastructure/cdn/cloudfront-config.yml`
- `infrastructure/scripts/deploy-production-complete.sh`

### 2. Run Complete Deployment

#### Option A: Complete Automated Deployment
```bash
# Make scripts executable (Linux/Mac)
chmod +x infrastructure/scripts/deploy-production-complete.sh
chmod +x infrastructure/scripts/deploy-security-migrations.sh

# Run complete deployment
./infrastructure/scripts/deploy-production-complete.sh
```

#### Option B: Step-by-Step Deployment
```bash
# 1. Deploy security infrastructure
kubectl apply -f infrastructure/scripts/security-migration-configmaps.yml
kubectl apply -f secrets-production.yml
kubectl apply -f infrastructure/kubernetes/production/configmaps.yml

# 2. Run database migrations
./infrastructure/scripts/deploy-security-migrations.sh

# 3. Deploy CDN infrastructure
kubectl apply -f infrastructure/cdn/cloudfront-config.yml
kubectl apply -f infrastructure/cdn/media-optimization.yml

# 4. Deploy monitoring
kubectl apply -f infrastructure/monitoring/security-monitoring.yml
kubectl apply -f infrastructure/monitoring/grafana-dashboards.yml

# 5. Update applications
kubectl patch deployment backend-deployment -n bulk-email-platform -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "env": [
            {"name": "ENABLE_PER_USER_JWT", "value": "true"},
            {"name": "ENABLE_PRICING_PROTECTION", "value": "true"},
            {"name": "ENABLE_ENHANCED_OTP", "value": "true"}
          ]
        }]
      }
    }
  }
}'
```

### 3. Post-Deployment Configuration

#### Configure DNS Records
Point your domains to the load balancer IP:
```bash
# Get load balancer IP
kubectl get service nginx-load-balancer-service -n bulk-email-platform -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Create DNS A records:
# perbox.com -> LOAD_BALANCER_IP
# api.perbox.com -> LOAD_BALANCER_IP
# media.perbox.com -> LOAD_BALANCER_IP
# cdn.perbox.com -> CloudFront distribution domain
```

#### Verify SSL Certificates
```bash
# Check certificate status
kubectl get certificates -n bulk-email-platform

# Test HTTPS endpoints
curl -I https://perbox.com
curl -I https://api.perbox.com/health
```

## Verification and Testing

### 1. Health Checks
```bash
# Check all pods are running
kubectl get pods -n bulk-email-platform

# Test API endpoints
curl https://api.perbox.com/health
curl https://api.perbox.com/api/auth/health

# Test database connectivity
kubectl exec -n bulk-email-platform $(kubectl get pods -l app=postgres-primary -o jsonpath='{.items[0].metadata.name}') -- pg_isready
```

### 2. Security Feature Testing
```bash
# Test JWT secret generation
kubectl exec -n bulk-email-platform $(kubectl get pods -l app=postgres-primary -o jsonpath='{.items[0].metadata.name}') -- psql -U postgres -d bulk_email_platform -c "SELECT COUNT(*) FROM users WHERE jwt_secret IS NOT NULL;"

# Test OTP system
curl -X POST https://api.perbox.com/api/auth/send-otp -H "Content-Type: application/json" -d '{"phoneNumber": "+1234567890"}'

# Test pricing protection
curl https://api.perbox.com/api/pricing/plans
```

### 3. CDN and Media Testing
```bash
# Test media optimization service
curl https://media.perbox.com/health

# Test CDN delivery
curl -I https://cdn.perbox.com/images/hero-background.webp
```

### 4. Monitoring and Alerting
- Access Grafana at `https://monitoring.perbox.com`
- Check security dashboard for any alerts
- Verify Prometheus is collecting metrics
- Test alert notifications

## Troubleshooting

### Common Issues

#### 1. Pod Startup Failures
```bash
# Check pod status and logs
kubectl describe pod <pod-name> -n bulk-email-platform
kubectl logs <pod-name> -n bulk-email-platform
```

#### 2. Database Connection Issues
```bash
# Test database connectivity
kubectl exec -it <postgres-pod> -n bulk-email-platform -- psql -U postgres

# Check database migrations
kubectl logs <migration-job> -n bulk-email-platform
```

#### 3. CDN Configuration Issues
```bash
# Check CloudFront distribution status
aws cloudfront list-distributions

# Test S3 bucket access
aws s3 ls s3://perbox-media-assets/
```

#### 4. SSL Certificate Issues
```bash
# Check certificate status
kubectl describe certificate <cert-name> -n bulk-email-platform

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

### Performance Issues

#### High Response Times
1. Check resource usage: `kubectl top pods -n bulk-email-platform`
2. Scale deployments if needed: `kubectl scale deployment <name> --replicas=5`
3. Check database performance metrics in Grafana

#### CDN Issues
1. Check CloudFront cache hit ratio
2. Verify S3 bucket policies
3. Test media optimization service logs

### Security Issues

#### Failed Authentication
1. Check security audit logs in database
2. Verify JWT secret generation
3. Check OTP rate limiting settings

#### Pricing Tampering Alerts
1. Review pricing audit logs
2. Verify JWT signature validation
3. Check for suspicious IP addresses

## Rollback Procedures

### Emergency Rollback
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/backend-deployment -n bulk-email-platform
kubectl rollout undo deployment/frontend-deployment -n bulk-email-platform

# Disable new security features
kubectl patch deployment backend-deployment -n bulk-email-platform -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "env": [
            {"name": "ENABLE_PER_USER_JWT", "value": "false"},
            {"name": "ENABLE_PRICING_PROTECTION", "value": "false"}
          ]
        }]
      }
    }
  }
}'
```

### Database Rollback
```bash
# Restore from backup (if needed)
kubectl exec -n bulk-email-platform <postgres-pod> -- psql -U postgres -d bulk_email_platform < backup-file.sql
```

## Monitoring and Maintenance

### Daily Checks
- Review security alerts in Grafana
- Check application error rates
- Monitor resource usage
- Verify backup completion

### Weekly Tasks
- Review security audit logs
- Update security patches
- Analyze performance metrics
- Test disaster recovery procedures

### Monthly Tasks
- Rotate JWT secrets for high-risk users
- Review and update security policies
- Optimize CDN cache settings
- Update SSL certificates if needed

## Support and Escalation

### Contact Information
- **Security Issues**: security@perbox.com
- **Infrastructure Issues**: ops@perbox.com
- **Application Issues**: dev@perbox.com

### Emergency Procedures
1. **Security Incident**: Immediately disable affected features and contact security team
2. **Service Outage**: Follow incident response playbook and notify stakeholders
3. **Data Breach**: Execute data breach response plan and notify legal team

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/docs/)

---

**Deployment Version**: Generated automatically during deployment
**Last Updated**: $(date)
**Maintained By**: Infrastructure Team